// Asserts the things about achroma.css that cannot be seen by reading it.
//
// Eight classes of check, in order of how quietly they would otherwise fail:
//
//   1. grain          a data URI moved into a custom property is truncated at
//                     its first semicolon by this very parser — 93% of the
//                     value gone, and every other check still green
//   2. chroma-zero    a stray 0.01 in the ramp is invisible by eye and would
//                     propagate to every site that installs this
//   3. block parity   each mode's aliases are written twice (media query +
//                     class), four blocks of 18 values, and drift between the
//                     copies is undetectable by hand
//   4. monotonicity   a ramp step out of order makes "one step darker" a lie
//   5. gamut          an out-of-gamut hue reports a better ratio than it paints
//   6. cascade        specificity and layer bugs render correctly in one OS
//                     mode and wrongly in the other, so eyeballing one machine
//                     proves nothing
//   7. bridge         a var() aimed at a renamed token is the empty string, so
//                     the shadcn component renders unstyled and nothing warns
//   8. contrast       computed, never assumed
//
// Prints every ratio whether it passes or not. A pass/fail line tells you less
// than the numbers do.
//
// Note on skips: parseOklch returns null only for values that are not oklch()
// literals at all, and throws for an oklch() it cannot measure (alpha, or a
// percentage lightness). So `if (!c) continue` below skips var() aliases and
// nothing else — an unmeasurable colour crashes the run rather than silently
// dropping out of the report.

import { readFileSync, readdirSync } from 'node:fs';
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

/** The 26 aliases that must be defined in every mode. This list is the contract. */
const COLOUR_ALIASES = [
  '--bg', '--bg-raised', '--bg-sunken',
  '--fg', '--fg-dim', '--fg-faint',
  '--hairline', '--rule', '--ring',
  '--danger-text', '--danger-line', '--danger-bg',
  '--warn-text', '--warn-line', '--warn-bg',
  '--ok-text', '--ok-line', '--ok-bg',
  '--info-text', '--info-line', '--info-bg',
  '--accent-text', '--accent-line', '--accent-bg',
  '--accent-fill', '--accent-on-fill',
];

/**
 * `[alias, against, minimum]` — the reason each token exists, as a number.
 *
 * contrast() is symmetric, so the pair order is presentation only.
 *
 * The last two entries are PINS, not accessibility floors, and the distinction
 * matters. A surface-against-surface step has no WCAG threshold — nobody reads
 * text off the boundary between two backgrounds. They are here because the
 * numbers turned out to be a finding:
 *
 *                       raised vs --bg   sunken vs --bg
 *   light               1.044            1.051
 *   dark                1.104            1.052
 *
 * Light's raised step is 1.044:1 — BELOW the 1.15:1 floor this same table sets
 * for --hairline, a purely decorative line. So a raised surface in light mode is
 * invisible on tone alone, and every card, popover and dropdown must carry a
 * --hairline or a --shadow-* to have an edge at all. Dark is 2.4x better and
 * carries its own step, which is the asymmetry the elevation comment in
 * achroma.css is built on.
 *
 * Nothing tested this before, so the ramp could have been flattened further
 * without a single assertion noticing.
 */
const TARGETS = [
  ['--fg', '--bg', 7.0],
  ['--fg-dim', '--bg', 4.5],
  ['--fg-faint', '--bg', 3.0],
  ['--rule', '--bg', 1.4],
  ['--hairline', '--bg', 1.15],
  ['--danger-text', '--bg', 4.5],
  ['--warn-text', '--bg', 4.5],
  ['--ok-text', '--bg', 4.5],
  ['--info-text', '--bg', 4.5],
  ['--danger-line', '--bg', 3.0],
  ['--warn-line', '--bg', 3.0],
  ['--ok-line', '--bg', 3.0],
  ['--info-line', '--bg', 3.0],
  ['--danger-text', '--danger-bg', 4.5],
  ['--warn-text', '--warn-bg', 4.5],
  ['--ok-text', '--ok-bg', 4.5],
  ['--info-text', '--info-bg', 4.5],
  ['--accent-text', '--bg', 4.5],
  ['--accent-line', '--bg', 3.0],
  ['--accent-text', '--accent-bg', 4.5],
  // The filled primary button. Its own ink must be legible ON it, which is a
  // requirement none of the status semantics have — they never carry text on a
  // saturated fill.
  ['--accent-on-fill', '--accent-fill', 4.5],
  ['--bg-raised', '--bg', 1.04],
  ['--bg-sunken', '--bg', 1.04],
];

/**
 * Comments removed, but the `@achroma` markers kept — they are comments too,
 * and blocks() splits on them.
 *
 * This is not tidiness. decls() below takes the LAST definition of a token, and
 * achroma.css documents its own tokens in prose: a comment reading
 * `.inverted { --ring: var(--bg) }` was parsed as a real declaration and
 * overrode the light-class block's actual --ring. That direction fails loudly.
 * The other direction does not — a comment example that happens to match is
 * indistinguishable from a real declaration, so a block could pass the parity
 * check for a token its rule never declares at all. Verified both ways.
 */
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) =>
    /^\/\*\s*@achroma\s+[a-z-]+\s*\*\/$/.test(m) ? m : ' ',
  );

/** Split the file on the `@achroma <name>` marker comments. */
function blocks(source) {
  const marks = [...source.matchAll(/\/\*\s*@achroma\s+([a-z-]+)\s*\*\//g)];
  check(
    marks.length === 4,
    `expected 4 @achroma markers (light, dark, dark-class, light-class), found ${marks.length}`,
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

/**
 * Resolve a declaration to OKLCH, following var() through the alias table and
 * into the ramp.
 *
 * One level was enough while every alias pointed straight at a ramp step. The
 * info semantics are aliases OF aliases — `--info-text: var(--fg-dim)` ->
 * `var(--n-600)` -> a literal — so this walks the chain.
 *
 * The depth cap and the seen-set are not defensive noise. `--a: var(--b)` with
 * `--b: var(--a)` is valid CSS that a browser resolves to nothing, and it would
 * spin here forever. A suite that hangs reads as a stuck CI job, not a failure.
 */
function resolve(value, table, ramp) {
  const seen = new Set();
  let v = value;
  for (let depth = 0; depth < 8; depth++) {
    const direct = parseOklch(v);
    if (direct) return direct;
    const m = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(String(v).trim());
    if (!m) return null;
    const name = m[1];
    if (ramp.has(name)) return ramp.get(name);
    if (seen.has(name) || !table.has(name)) return null;
    seen.add(name);
    v = table.get(name);
  }
  return null;
}

const parts = blocks(stripComments(css));
const light = decls(parts.get('light') ?? '');
const dark = decls(parts.get('dark') ?? '');
const darkClass = decls(parts.get('dark-class') ?? '');
const lightClass = decls(parts.get('light-class') ?? '');

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

// ── 3. the duplicated alias blocks agree ──────────────────────────────
//
// Each mode's alias set is written TWICE, and both copies are load-bearing:
//
//   dark        `@media (prefers-color-scheme: dark)` — consumers that follow
//               the OS.
//   dark-class  `[data-theme='dark'], .dark` — consumers with a toggle
//               (next-themes sets .dark).
//   light       `:root` — the default, and the only block that carries the ramp.
//   light-class `[data-theme='light'], .light` — needed because the dark media
//               query's :not() only SUPPRESSES itself on a light-themed root;
//               without a block that positively declares light tokens,
//               `<body class="light">` under OS-dark inherited dark ones. It
//               also pins `color-scheme: light`, which `light dark` cannot do.
//
// That is four copies of 18 values. Nothing but this check would catch two of
// them drifting — a stale copy renders perfectly, just in the wrong mode, and
// the contrast tables below read only `light` and `dark`, so they never see
// `dark-class` or `light-class` at all. Verified: changing --fg-dim in the
// dark-class block alone left every printed ratio byte-identical.
const PARITY = [
  ['dark', dark, 'dark-class', darkClass],
  ['light', light, 'light-class', lightClass],
];
for (const [aName, a, bName, b] of PARITY) {
  for (const alias of COLOUR_ALIASES) {
    check(a.has(alias), `${aName} block is missing ${alias}`);
    check(b.has(alias), `${bName} block is missing ${alias}`);
    if (a.has(alias) && b.has(alias)) {
      check(
        a.get(alias) === b.get(alias),
        `${aName} and ${bName} disagree on ${alias}: ` +
          `${aName} says ${a.get(alias)}, ${bName} says ${b.get(alias)}`,
      );
    }
  }
}

// These are not colours, so COLOUR_ALIASES does not cover them — but they are
// duplicated across all four blocks just the same, so drift is just as invisible.
//
// Only --grain-opacity was checked before. --wash had been duplicated four ways
// since it was added with nothing comparing the copies, and the shadows and the
// scrim would have joined it.
const NON_COLOUR_PARITY = [
  '--grain-opacity',
  '--wash',
  '--shadow-1',
  '--shadow-2',
  '--shadow-3',
  '--scrim',
];

// Whitespace inside a CSS value is not semantic, and --shadow-2/--shadow-3 are
// written across several lines at two different indent depths — the media query
// block is nested one level deeper than the class block. Compare normalised, or
// every multi-line token reports a false drift.
const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

for (const [aName, a, bName, b] of PARITY) {
  for (const token of NON_COLOUR_PARITY) {
    check(a.has(token), `${aName} block is missing ${token}`);
    check(b.has(token), `${bName} block is missing ${token}`);
    if (a.has(token) && b.has(token)) {
      check(
        norm(a.get(token)) === norm(b.get(token)),
        `${aName} and ${bName} disagree on ${token}: ` +
          `${aName} says ${norm(a.get(token))}, ${bName} says ${norm(b.get(token))}`,
      );
    }
  }
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
const CHROMATIC = COLOUR_ALIASES.filter((n) => /^--(danger|warn|ok|accent)-/.test(n));

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
    const c = resolve(table.get(name) ?? '', table, ramp);
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
  /\.ac-grain\s*\{[^}]*background-image\s*:/.test(code),
  '.ac-grain declares no background-image — the overlay would paint nothing',
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

// ── 6. cascade ────────────────────────────────────────────────────────
//
// Four defects lived here, and every one of them rendered correctly on the
// machine it was written on. These are regex checks on the source, which is
// weaker than a browser but catches the three structural properties that
// actually went wrong. The full 14-cell mode matrix was verified separately in
// real Chrome over CDP; these assertions are what survive in the repo.

// (a) Specificity of the dark media block. `:not()` takes the specificity of
// its most specific argument, so `:root:not([data-theme='light']):not(.light)`
// is 0,3,0 and beat a consumer's own `.dark { --bg }` (0,1,0) — but only under
// OS-dark, so a consumer testing in light mode saw their override work.
// `:where()` is the zero-specificity wrapper that fixes it.
for (const m of code.matchAll(/:not\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g)) {
  check(
    m[1].trimStart().startsWith(':where('),
    `:not(${m[1]}) does not wrap its arguments in :where(). :not() contributes ` +
      `its most specific argument, which lifts the rule above a consumer's own ` +
      `0,1,0 override — and only when the OS matches, so it looks fine locally.`,
  );
}

// (b) The class/attribute alias blocks must not be prefixed with `:root`.
// `:root[data-theme='dark']` is 0,2,0 and outranks a consumer's
// `[data-theme='dark']` in BOTH modes; bare selectors tie and source order
// decides, which puts the consumer's later file on top.
for (const sel of ["[data-theme='dark']", "[data-theme='light']", '.dark', '.light']) {
  const escaped = sel.replace(/[.[\]'$]/g, (c) => `\\${c}`);
  check(
    !new RegExp(`:root\\s*${escaped}`).test(code),
    `the ${sel} alias block is prefixed with :root, making it 0,2,0 — it ` +
      `outranks a consumer's own ${sel} rule instead of tying with it.`,
  );
}

// (c) The base rules must be inside `@layer base`, and the token blocks must
// not be. Unlayered declarations outrank EVERY layered one — layer order is
// compared before specificity — so an unlayered `body { font-weight: 300 }`
// defeated Tailwind's font-bold, bg-white, text-2xl and m-4 utilities at once.
// The layer name must be exactly `base`: Tailwind declares
// `@layer theme, base, components, utilities`, and an unrecognised name is
// appended after utilities, which changes nothing.
const layerAt = code.indexOf('@layer base {');
if (check(layerAt !== -1, 'achroma.css declares no `@layer base {` — the base rules are unlayered and outrank every Tailwind utility')) {
  let depth = 0;
  let end = layerAt;
  for (let i = code.indexOf('{', layerAt); i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}' && --depth === 0) { end = i; break; }
  }
  const layered = code.slice(layerAt, end);
  const outside = code.slice(0, layerAt) + code.slice(end);
  for (const sel of ['body', '.ac-grain', '.ac-wash', '.ac-label', '.ac-display', ':focus-visible', 'h1']) {
    check(
      new RegExp(`(^|[,{}\\s])${sel.replace(/[.:]/g, (c) => `\\${c}`)}\\s*[,{]`, 'm').test(layered),
      `the \`${sel}\` rule is not inside @layer base — unlayered, it beats every ` +
        `layered utility a consumer writes.`,
    );
  }
  check(
    !/--n-0\s*:/.test(layered),
    'the ramp is inside @layer base. Token blocks belong unlayered, so a ' +
      'consumer can override them without layer machinery.',
  );
  check(
    /--n-0\s*:/.test(outside),
    'the ramp is not outside @layer base — token blocks must stay unlayered.',
  );
}

// ── 7. the Tailwind bridge resolves ───────────────────────────────────
//
// achroma.tailwind.css maps shadcn's variable names onto Achroma tokens, so it
// is nothing but `var()` indirections. A var() pointing at a token that was
// renamed or removed resolves to the empty string — the component renders
// unstyled, in the browser, with no error anywhere. Nothing in the CSS pipeline
// warns about it.
//
// So: every token the bridge references must exist, and the bridge must declare
// no colour of its own. The second half matters because a literal in the bridge
// would be a colour outside the ramp, invisible to every other check in this
// file.
//
// Both optional files get the same treatment, because they fail the same way.
// achroma.tailwind.css maps shadcn's names onto tokens; achroma.components.css
// builds the nine essential primitives out of them. Neither declares a colour of
// its own, so a renamed token in achroma.css silently empties a var() in both.
//
// A var() with a FALLBACK is skipped by the regex below, which is what lets
// achroma.components.css define its own --ac-container and --ac-gap knobs without
// tripping the check — they are always written `var(--ac-gap, var(--s-4))`, and the
// inner token is still verified.
for (const file of ['achroma.tailwind.css', 'achroma.components.css']) {
  let text = null;
  try {
    text = readFileSync(join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  } catch {
    continue; // Not yet written. Absent is fine; broken is not.
  }

  const defined = new Set([...code.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const referenced = new Set([...text.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/g)].map((m) => m[1]));

  check(referenced.size > 0, `${file} references no tokens at all`);

  for (const name of referenced) {
    check(
      defined.has(name),
      `${file} references ${name}, which achroma.css does not define. An ` +
        `unresolved var() is the empty string, so the rule renders unstyled with ` +
        `no error anywhere.`,
    );
  }

  for (const m of text.matchAll(/(oklch\(|rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8})/g)) {
    check(
      false,
      `${file} declares a literal colour (${m[1]}). These files must be pure ` +
        `indirection — a literal here is a colour outside the ramp that no other ` +
        `check in this file can see.`,
    );
  }

  // The layer name is load-bearing in both files and wrong in different ways.
  // Tailwind declares `theme, base, components, utilities`; an unrecognised name
  // is appended AFTER utilities, so `.ac-btn` would beat `px-6` and utilities
  // would stop working on our own components.
  if (file === 'achroma.components.css') {
    check(
      /@layer\s+components\s*\{/.test(text),
      `${file} does not open \`@layer components\`. Unlayered, every primitive in ` +
        `it outranks every Tailwind utility a consumer writes.`,
    );
  }
}

// ── 7b. every stylesheet in the repo is actually shipped ──────────────
//
// A file can be flawless and still never reach a consumer. package.json holds two
// independent gates, and missing either one fails silently in a DIFFERENT way:
//
//   files    absent -> the file is not in the npm tarball at all.
//   exports  absent -> `@import 'achroma/<name>'` throws
//                      ERR_PACKAGE_PATH_NOT_EXPORTED even though the file shipped.
//
// This is not hypothetical. achroma.components.css was added to both, and then a
// `git checkout -- package.json` while unwinding an unrelated release commit
// reverted them. The component layer would have published as nothing whatsoever —
// present in the repo, absent from the package — with every other assertion in this
// file passing, the tests green, and the docs describing nine primitives that no
// consumer could import.
{
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const sheets = readdirSync(root).filter((f) => /^achroma.*\.css$/.test(f));

  check(sheets.length > 0, 'no achroma*.css found in the repo root — nothing to ship');

  for (const name of sheets) {
    check(
      (pkg.files ?? []).includes(name),
      `${name} is missing from package.json "files", so it will not be in the npm ` +
        `tarball. The file is right here and would simply not exist for consumers.`,
    );
    check(
      Object.hasOwn(pkg.exports ?? {}, `./${name}`),
      `${name} is missing from package.json "exports", so ` +
        `\`@import 'achroma/${name}'\` throws ERR_PACKAGE_PATH_NOT_EXPORTED even ` +
        `though the file itself ships.`,
    );
  }
}

// ── 8. elevation is achromatic, and it is per-mode ────────────────────
//
// Two ways to get this wrong, and both render beautifully.
//
// (a) A tinted shadow. Everyone reaches for a slate or blue-grey at low alpha —
//     it is what most systems ship, usually without meaning to. In a file whose
//     entire claim is that nothing is tinted, it is also the one colour no other
//     check here can see: --shadow-* is absent from COLOUR_ALIASES because it is
//     not a colour, it is a box-shadow list, and the gamut and contrast passes
//     only ever look at colours.
//
// (b) One shadow set shared by both modes. Browsers composite in gamma-encoded
//     sRGB, so the alpha that darkens --bg by exactly one ramp step is 0.023 in
//     light and 0.528 in dark — 23x apart. A light-tuned shadow is not subtle on
//     a dark page, it is absent, which is why so many dark themes have flat
//     cards. Asserting dark > light at every layer is what keeps the two sets
//     from being casually unified by someone tidying up.
{
  const ELEVATION = ['--shadow-1', '--shadow-2', '--shadow-3', '--scrim'];

  for (const [mode, table] of [['light', light], ['dark', dark]]) {
    for (const name of ELEVATION) {
      const value = table.get(name);
      if (!check(value !== undefined, `${mode}: ${name} is not declared`)) continue;

      const colours = [...value.matchAll(/oklch\(([^)]*)\)/g)];
      check(colours.length > 0, `${mode}: ${name} declares no oklch() colour`);
      for (const [, body] of colours) {
        check(
          /^\s*0\s+0\s+0\s*\/\s*[\d.]+\s*$/.test(body),
          `${mode}: ${name} uses oklch(${body.trim()}) — elevation must be black at ` +
            `alpha, oklch(0 0 0 / a). A tinted shadow is the one colour in this file ` +
            `that no other assertion can see.`,
        );
      }

      // A hex or rgba() would slip past the check above entirely, since it only
      // inspects what is inside oklch().
      check(
        !/(rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8})/.test(value),
        `${mode}: ${name} uses a non-oklch colour notation, which the achromatic ` +
          `check above reads straight past.`,
      );
    }
  }

  const alphas = (v) =>
    [...(v ?? '').matchAll(/oklch\(\s*0\s+0\s+0\s*\/\s*([\d.]+)\s*\)/g)].map((m) =>
      Number(m[1]),
    );

  for (const name of ELEVATION) {
    const l = alphas(light.get(name));
    const d = alphas(dark.get(name));
    if (
      !check(
        l.length > 0 && l.length === d.length,
        `${name}: light and dark declare different numbers of shadow layers ` +
          `(${l.length} vs ${d.length}) — one mode is not the other's counterpart`,
      )
    ) {
      continue;
    }
    check(
      d.every((a, i) => a > l[i]),
      `${name}: dark alpha is not greater than light at every layer ` +
        `(light ${l.join('/')}, dark ${d.join('/')}). One ramp step of darkening ` +
        `costs alpha 0.023 in light and 0.528 in dark, so a light-tuned value is ` +
        `invisible on a dark page rather than merely quieter.`,
    );
  }
}

// ── 9. contrast ───────────────────────────────────────────────────────
for (const [mode, table] of [['light', light], ['dark', new Map([...light, ...dark])]]) {
  console.log(`\n${mode}`);
  for (const [fg, bg, min] of TARGETS) {
    const a = resolve(table.get(fg) ?? '', table, ramp);
    const b = resolve(table.get(bg) ?? '', table, ramp);
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
