// Asserts the things about achroma.css that cannot be seen by reading it.
//
// Six classes of check, in order of how quietly they would otherwise fail:
//
//   1. grain          a data URI moved into a custom property is truncated at
//                     its first semicolon by this very parser — 93% of the
//                     value gone, and every other check still green
//   2. chroma-zero    a stray 0.01 in the ramp is invisible by eye and would
//                     propagate to every site that installs this
//   3. block parity   the dark values are written twice (media query + class)
//                     and drift between the copies is undetectable by hand
//   4. monotonicity   a ramp step out of order makes "one step darker" a lie
//   5. gamut          an out-of-gamut hue reports a better ratio than it paints
//   6. contrast       computed, never assumed
//
// Prints every ratio whether it passes or not. A pass/fail line tells you less
// than the numbers do.
//
// Note on skips: parseOklch returns null only for values that are not oklch()
// literals at all, and throws for an oklch() it cannot measure (alpha, or a
// percentage lightness). So `if (!c) continue` below skips var() aliases and
// nothing else — an unmeasurable colour crashes the run rather than silently
// dropping out of the report.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseOklch, contrast, oklchToLinearSrgb } from './oklch.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const css = readFileSync(join(root, 'achroma.css'), 'utf8');

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  return ok;
};

/** The 17 aliases that must be defined in both modes. This list is the contract. */
const COLOUR_ALIASES = [
  '--bg', '--bg-raised', '--bg-sunken',
  '--fg', '--fg-dim', '--fg-faint',
  '--hairline', '--rule',
  '--danger-text', '--danger-line', '--danger-bg',
  '--warn-text', '--warn-line', '--warn-bg',
  '--ok-text', '--ok-line', '--ok-bg',
];

/** `[alias, against, minimum]` — the reason each token exists, as a number. */
const TARGETS = [
  ['--fg', '--bg', 7.0],
  ['--fg-dim', '--bg', 4.5],
  ['--fg-faint', '--bg', 3.0],
  ['--rule', '--bg', 1.4],
  ['--hairline', '--bg', 1.15],
  ['--danger-text', '--bg', 4.5],
  ['--warn-text', '--bg', 4.5],
  ['--ok-text', '--bg', 4.5],
  ['--danger-line', '--bg', 3.0],
  ['--warn-line', '--bg', 3.0],
  ['--ok-line', '--bg', 3.0],
  ['--danger-text', '--danger-bg', 4.5],
  ['--warn-text', '--warn-bg', 4.5],
  ['--ok-text', '--ok-bg', 4.5],
];

/** Split the file on the `@achroma <name>` marker comments. */
function blocks(source) {
  const marks = [...source.matchAll(/\/\*\s*@achroma\s+([a-z-]+)\s*\*\//g)];
  check(
    marks.length === 3,
    `expected 3 @achroma markers (light, dark, dark-class), found ${marks.length}`,
  );
  const out = new Map();
  marks.forEach((mark, i) => {
    const start = mark.index + mark[0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index : source.length;
    out.set(mark[1], source.slice(start, end));
  });
  return out;
}

/** Every `--token: value;` in a chunk, last definition winning. */
function decls(chunk) {
  const out = new Map();
  for (const m of chunk.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1], m[2].trim());
  }
  return out;
}

/** Resolve a declaration to OKLCH, following one level of var() into the ramp. */
function resolve(value, ramp) {
  const direct = parseOklch(value);
  if (direct) return direct;
  const v = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(value);
  return v && ramp.has(v[1]) ? ramp.get(v[1]) : null;
}

const parts = blocks(css);
const light = decls(parts.get('light') ?? '');
const dark = decls(parts.get('dark') ?? '');
const darkClass = decls(parts.get('dark-class') ?? '');

// ── 1. the ramp is achromatic ─────────────────────────────────────────
const ramp = new Map();
for (const [name, value] of light) {
  if (!/^--n-\d+$/.test(name)) continue;
  const c = parseOklch(value);
  if (!check(c !== null, `${name}: not a plain oklch() literal — got ${value}`)) continue;
  check(c.C === 0, `${name}: chroma must be exactly 0, got ${c.C} — this is not achromatic`);
  check(c.h === 0, `${name}: hue must be exactly 0, got ${c.h}`);
  ramp.set(name, c);
}
check(ramp.size === 16, `expected 16 ramp steps, found ${ramp.size}`);

// ── 2. the ramp is ordered ────────────────────────────────────────────
const ordered = [...ramp.entries()].sort(
  (a, b) => Number(a[0].slice(4)) - Number(b[0].slice(4)),
);
for (let i = 1; i < ordered.length; i++) {
  const [prevName, prev] = ordered[i - 1];
  const [name, cur] = ordered[i];
  check(
    cur.L < prev.L,
    `ramp out of order: ${name} (L=${cur.L}) is not darker than ${prevName} (L=${prev.L})`,
  );
}

// ── 3. the two dark blocks agree ──────────────────────────────────────
// They are written twice on purpose — a media query for OS preference, a class
// for next-themes. Nothing but this check would catch them diverging.
for (const alias of COLOUR_ALIASES) {
  check(dark.has(alias), `--dark block is missing ${alias}`);
  check(darkClass.has(alias), `--dark-class block is missing ${alias}`);
  if (dark.has(alias) && darkClass.has(alias)) {
    check(
      dark.get(alias) === darkClass.get(alias),
      `dark blocks disagree on ${alias}: media says ${dark.get(alias)}, class says ${darkClass.get(alias)}`,
    );
  }
  check(light.has(alias), `light block is missing ${alias}`);
}

// ── 4. the semantics are inside the sRGB gamut ────────────────────────
//
// An out-of-gamut colour gets clamped on its way to a luminance, and the
// clamped value can report a BETTER contrast ratio than the colour a browser
// will actually paint. oklch(0.62 0.30 75) is the worked example: its blue
// channel is -0.1252, clamping lifts it to Y = 0.2256, and it claims 3.65:1
// where the in-gamut colour manages 3.57:1.
//
// So a chromatic token that passes its threshold while out of gamut is a false
// pass — precisely the shape this file exists to prevent. The ramp cannot hit
// this (chroma 0 and L in [0,1] always lands in gamut), which is why the check
// is scoped to tokens that actually carry hue.
const CHROMATIC = COLOUR_ALIASES.filter((n) => /^--(danger|warn|ok)-/.test(n));

// The loop below skips a token it cannot resolve, which is only safe because
// every chromatic token also has a contrast target — and there, an unresolvable
// value is a loud `cannot resolve` failure. That coupling is load-bearing and
// invisible, so assert it: a chromatic alias added here but forgotten in TARGETS
// would become gamut-skippable, and nothing else would notice.
for (const name of CHROMATIC) {
  check(
    TARGETS.some(([fg, bg]) => fg === name || bg === name),
    `${name} carries hue but appears in no TARGETS entry — the gamut check could skip it silently`,
  );
}

for (const [mode, table] of [['light', light], ['dark', new Map([...light, ...dark])]]) {
  for (const name of CHROMATIC) {
    const c = resolve(table.get(name) ?? '', ramp);
    if (!c) continue;
    const { r, g, b } = oklchToLinearSrgb(c);
    const worst = Math.min(r, g, b);
    const over = Math.max(r, g, b);
    check(
      worst >= -0.001 && over <= 1.001,
      `${mode}: ${name} is outside the sRGB gamut (linear rgb ${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)}) — ` +
        `its measured ratio is not what a browser will paint. Reduce chroma.`,
    );
  }
}

// ── 5. the grain data URI survived this parser ─────────────────────────
//
// The grain overlay is the system's headline visual feature, and its inline data
// URI is the one value in achroma.css that this file can destroy silently.
// `decls()` ends a value at the first `;`, so `--grain-image:
// url("data:image/svg+xml;base64,…")` is read as 23 of 349 characters — 93% gone
// — while all 17 aliases still resolve and the run exits 0. Measured, not
// assumed: that truncation was reproduced and it printed "all ramp assertions
// passed".
//
// achroma.css states the rule in a comment. A comment is not enforcement, so the
// three ways to break it are assertions now. Note that the fix is never to make
// the parser tolerant — the value belongs inline, in the rule that uses it.
//
// Comments are stripped first, because achroma.css documents this rule in prose
// that quotes the very strings being matched. Without the strip, commenting the
// whole grain rule out satisfies all three assertions — verified, it did.
const code = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

check(
  /feTurbulence/.test(code),
  'the grain is gone: no feTurbulence in achroma.css',
);
check(
  code.includes('%3C/svg%3E'),
  'the grain data URI has no closing %3C/svg%3E — a value cut at a semicolon ' +
    'loses the end of the SVG first, so this is what truncation looks like',
);
check(
  /\.grain\s*\{[^}]*background-image\s*:/.test(code),
  '.grain declares no background-image — the overlay would paint nothing',
);

// Every custom property in the file, not only the ones between the markers: the
// blind spot belongs to the regex, so it is file-wide.
for (const [name, value] of decls(code)) {
  check(
    !value.includes('data:'),
    `${name} holds a data URI. This parser stops a value at its first ';', so a ` +
      `data URI in a custom property is truncated with no error at all — just a ` +
      `dead image. Keep it inline in the rule that uses it.`,
  );
}

check(
  !code.includes('svg+xml;'),
  "an svg+xml data URI uses the ';base64' or ';utf8' form — everything after " +
    'that semicolon is invisible to this parser. Use the comma form instead: ' +
    'url("data:image/svg+xml,%3Csvg …").',
);

// ── 6. contrast ───────────────────────────────────────────────────────
for (const [mode, table] of [['light', light], ['dark', new Map([...light, ...dark])]]) {
  console.log(`\n${mode}`);
  for (const [fg, bg, min] of TARGETS) {
    const a = resolve(table.get(fg) ?? '', ramp);
    const b = resolve(table.get(bg) ?? '', ramp);
    if (!check(a && b, `${mode}: cannot resolve ${fg} on ${bg}`)) continue;
    const ratio = contrast(a, b);
    const ok = ratio >= min;
    check(ok, `${mode}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1, need >= ${min}:1`);
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'} ${fg} on ${bg}  ${ratio.toFixed(2)}:1  (>= ${min})`,
    );
  }
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nall ramp assertions passed');
