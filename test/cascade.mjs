// Asserts the things about achroma.css that only a browser can decide.
//
// test/contrast.mjs reads the source with regexes. That catches a great deal,
// but it cannot resolve a cascade: specificity, cascade layers, `color-scheme`
// and `prefers-*` queries are all things a stylesheet does only once a browser
// has assembled it. Four Critical defects lived exactly there, and every one of
// them rendered correctly on the machine it was written on:
//
//   - `:root:not([data-theme='light']):not(.light)` is 0,3,0 because :not()
//     contributes its most specific argument, so it beat a consumer's own
//     `.dark { --bg }` at 0,1,0 — but ONLY when the OS was in dark mode.
//   - `color-scheme: light dark` resolves to dark under OS-dark whichever
//     tokens won, so form controls rendered dark on a near-white page.
//   - Nothing declared light tokens, so `<body class="light">` under OS-dark
//     inherited dark ones.
//   - Unlayered base rules outrank every layered one, so `body { font-weight }`
//     defeated Tailwind's font-bold, bg-white, text-2xl, m-4 and box-content.
//
// Zero dependencies, same as the rest of the package: Node's built-in WebSocket
// speaking CDP to whatever Chrome the machine already has.
//
// Not part of `npm test`, which stays fast and browser-free. Run it with
// `npm run test:cascade`, and in CI with ACHROMA_REQUIRE_BROWSER=1 so that a
// missing browser is a failure rather than a skip.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CSS = join(ROOT, 'achroma.css');
const REQUIRE_BROWSER = process.env.ACHROMA_REQUIRE_BROWSER === '1';

// ── find a browser ────────────────────────────────────────────────────
function findChrome() {
  if (process.env.CHROME_PATH) {
    return existsSync(process.env.CHROME_PATH) ? process.env.CHROME_PATH : null;
  }
  const fixed = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ];
  for (const p of fixed) if (existsSync(p)) return p;
  const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome'];
  for (const dir of (process.env.PATH ?? '').split(':')) {
    for (const n of names) {
      const p = join(dir, n);
      if (dir && existsSync(p)) return p;
    }
  }
  return null;
}

// A silent skip is indistinguishable from a pass, so say exactly what went
// unchecked and make the flag able to turn it into a failure.
const UNCHECKED = [
  '14 mode-matrix cells (OS light/dark x no-override, [data-theme], .light/.dark on html and body)',
  '4 consumer-override cells (C1: does a consumer .dark {} beat ours in BOTH OS modes)',
  '10 Tailwind layer cells (C4: do utilities beat our @layer base)',
  '4 focus-ring cells (I1: --ring resolves and flips)',
  '5 preference-query cells (I5/I6: grain under reduced-motion / transparency / contrast / print)',
  '4 alias-of-alias cells (I7: does --info-* flip inside a nested section.dark)',
  '9 elevation cells (I8: do --shadow-*/--scrim resolve and get heavier in dark)',
];

const CHROME = findChrome();
if (!CHROME) {
  const bar = '='.repeat(72);
  const say = REQUIRE_BROWSER ? console.error : console.warn;
  say(`\n${bar}`);
  say(REQUIRE_BROWSER
    ? 'FAIL: no Chrome/Chromium found, and ACHROMA_REQUIRE_BROWSER=1'
    : 'WARNING: no Chrome/Chromium found — THE CASCADE MATRIX WAS NOT VERIFIED');
  say(bar);
  say('These assertions did NOT run, and nothing else in the suite covers them:');
  for (const u of UNCHECKED) say(`  - ${u}`);
  say('');
  say('Set CHROME_PATH, or install Chrome/Chromium. Use ACHROMA_REQUIRE_BROWSER=1');
  say('to make this a failure (that is how CI should run it).');
  say(`${bar}\n`);
  process.exit(REQUIRE_BROWSER ? 1 : 0);
}

// ── expected token values, derived from achroma.css, never duplicated ──
// Hardcoding oklch() strings here would be a second copy of the palette, which
// is the failure this project has already had twice. Read them instead.
const css = readFileSync(CSS, 'utf8');
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => (/^\/\*\s*@achroma\s+[a-z-]+\s*\*\/$/.test(m) ? m : ' '));
const src = stripComments(css);
const ramp = new Map(
  [...src.matchAll(/(--n-\d+)\s*:\s*(oklch\([^;]+\));/g)].map((m) => [m[1], m[2]]),
);
function blockOf(marker) {
  const marks = [...src.matchAll(/\/\*\s*@achroma\s+([a-z-]+)\s*\*\//g)];
  const i = marks.findIndex((m) => m[1] === marker);
  if (i < 0) throw new Error(`no @achroma ${marker} marker in achroma.css`);
  const end = i + 1 < marks.length ? marks[i + 1].index : src.length;
  return src.slice(marks[i].index, end);
}
function aliasValue(marker, alias) {
  const m = new RegExp(`${alias}\\s*:\\s*var\\((--n-\\d+)\\)`).exec(blockOf(marker));
  if (!m) throw new Error(`${alias} not found as a ramp reference in the ${marker} block`);
  return ramp.get(m[1]);
}
const LIGHT_BG = aliasValue('light', '--bg');
const DARK_BG = aliasValue('dark', '--bg');
const LIGHT_FG = aliasValue('light', '--fg');
const DARK_FG = aliasValue('dark', '--fg');

const nums = (s) => (s.match(/-?\d*\.?\d+/g) ?? []).map(Number);
const sameColour = (a, b) => {
  const [x, y] = [nums(a), nums(b)];
  return x.length === y.length && x.every((v, i) => Math.abs(v - y[i]) < 1e-6);
};

// ── minimal CDP ───────────────────────────────────────────────────────
const PORT = 9200 + Math.floor(Math.random() * 700);
const profile = mkdtempSync(join(tmpdir(), 'achroma-chrome-'));
const work = mkdtempSync(join(tmpdir(), 'achroma-cascade-'));

const proc = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--force-color-profile=srgb', '--hide-scrollbars', 'about:blank',
], { stdio: 'ignore' });

function cleanup() {
  try { proc.kill(); } catch {}
  for (const d of [profile, work]) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
}
process.on('exit', cleanup);

let version;
for (let i = 0; i < 150; i++) {
  try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; }
  catch { await new Promise((r) => setTimeout(r, 100)); }
}
if (!version) {
  console.error(`\nFAIL: ${CHROME} was found but never opened a debugging port on ${PORT}.`);
  console.error('A browser that is present but unusable is an error, not a skip.\n');
  process.exit(1);
}

const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let msgId = 0;
const pending = new Map();
let sessionId = null;
const events = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
  } else if (m.method) events.push(m);
};
const send = (method, params = {}, sid = sessionId) => {
  const id = ++msgId;
  ws.send(JSON.stringify(sid ? { id, method, params, sessionId: sid } : { id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
};

const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null);
({ sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }, null));
await send('Page.enable');
await send('Runtime.enable');

const evaluate = async (expression, awaitPromise = false) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval failed');
  return r.result.value;
};
async function navigate(url) {
  const before = events.length;
  await send('Page.navigate', { url });
  for (let i = 0; i < 200; i++) {
    if (events.slice(before).some((m) => m.method === 'Page.loadEventFired')) break;
    await new Promise((r) => setTimeout(r, 25));
  }
  await evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))', true);
}
const emulate = (features = [], media = '') => send('Emulation.setEmulatedMedia', { media, features });
const scheme = (v) => emulate([{ name: 'prefers-color-scheme', value: v }]);

// ── fixtures ──────────────────────────────────────────────────────────
const fixture = (name, body) => {
  const p = join(work, name);
  writeFileSync(p, body);
  return `file://${p}`;
};
const sheet = (name, body) => { writeFileSync(join(work, name), body); return `file://${join(work, name)}`; };

const ACHROMA = `<link rel="stylesheet" href="file://${CSS}">`;
const page = (head, bodyClass = '') => `<!doctype html><html><head><meta charset="utf-8">
${head}</head><body class="${bodyClass}">
<h1 id="h">H</h1><p><strong id="s">s</strong></p>
<input id="inp"><button id="btn">b</button>
<div class="ac-grain" aria-hidden="true"></div></body></html>`;

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); return ok; };
let checks = 0;
const expect = (actual, wanted, what, cmp = (a, b) => a === b) => {
  checks++;
  check(cmp(actual, wanted), `${what}: expected ${wanted}, got ${actual}`);
};

// ── 1. the mode matrix ────────────────────────────────────────────────
// An explicit light/dark marker beats the OS; with no marker the OS decides.
// The <input> is the probe for the RESOLVED color-scheme, because
// `color-scheme: light dark` computes to "light dark" in both modes and so
// tells you nothing about what a form control will actually paint.
const CELLS = [
  ['no override',           "h.removeAttribute('data-theme'); h.className=''"],
  ["html[data-theme=light]", "h.setAttribute('data-theme','light')"],
  ["html[data-theme=dark]",  "h.setAttribute('data-theme','dark')"],
  ['html.light',            "h.classList.add('light')"],
  ['html.dark',             "h.classList.add('dark')"],
  ['body.light',            "b.classList.add('light')"],
  ['body.dark',             "b.classList.add('dark')"],
];
const MATRIX_URL = fixture('matrix.html', page(ACHROMA));
const PROBE = `(() => { const cs = (el) => getComputedStyle(el); return {
  bodyBg: cs(document.body).getPropertyValue('--bg').trim(),
  bodyFg: cs(document.body).getPropertyValue('--fg').trim(),
  inputBg: cs(document.getElementById('inp')).backgroundColor,
}; })()`;

for (const os of ['light', 'dark']) {
  await scheme(os);
  await navigate(MATRIX_URL);
  for (const [name, apply] of CELLS) {
    await evaluate(`(() => { const h = document.documentElement, b = document.body;
      h.removeAttribute('data-theme'); h.className = '';
      b.removeAttribute('data-theme'); b.className = '';
      ${apply}; return true; })()`);
    const m = await evaluate(PROBE);
    const wantDark = /dark/.test(name) || (name === 'no override' && os === 'dark');
    const where = `matrix: OS ${os} + ${name}`;
    expect(m.bodyBg, wantDark ? DARK_BG : LIGHT_BG, `${where} --bg`, sameColour);
    expect(m.bodyFg, wantDark ? DARK_FG : LIGHT_FG, `${where} --fg`, sameColour);
    // A dark surface must render dark controls; light must not.
    const dark = m.inputBg !== 'rgb(255, 255, 255)';
    checks++;
    check(dark === wantDark,
      `${where}: <input> painted ${m.inputBg}, which is ${dark ? 'dark' : 'light'} — ` +
      `expected ${wantDark ? 'dark' : 'light'}. color-scheme did not follow the tokens.`);
  }
}

// ── 2. C1: a consumer's own rule must win, in BOTH OS modes ───────────
const CONSUMER = sheet('consumer.css',
  ".dark { --bg: oklch(0.05 0 0); }\n[data-theme='dark'] { --bg: oklch(0.05 0 0); }\n");
const C1_URL = fixture('c1.html', page(`${ACHROMA}\n<link rel="stylesheet" href="${CONSUMER}">`));
for (const os of ['light', 'dark']) {
  await scheme(os);
  await navigate(C1_URL);
  for (const [name, apply] of [
    ['.dark', "h.classList.add('dark')"],
    ["[data-theme='dark']", "h.setAttribute('data-theme','dark')"],
  ]) {
    await evaluate(`(() => { const h = document.documentElement;
      h.removeAttribute('data-theme'); h.className = ''; ${apply}; return true; })()`);
    const bg = await evaluate("getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()");
    checks++;
    check(sameColour(bg, 'oklch(0.05 0 0)'),
      `C1: OS ${os}, consumer's own ${name} { --bg } lost to achroma (got ${bg}). ` +
      `All four alias blocks must be 0,1,0 so the consumer's later file wins.`);
  }
}

// ── 3. C4: Tailwind utilities must beat our @layer base ───────────────
const TW_LAYERS = '<style>@layer theme, base, components, utilities;</style>';
const TW_PREFLIGHT = sheet('tw-preflight.css', `@layer base {
  h1,h2,h3,h4,h5,h6 { font-size: inherit; font-weight: inherit; }
  b, strong { font-weight: bolder; }
  body { margin: 0; }
}
`);
const TW_UTILITIES = sheet('tw-utilities.css', `@layer utilities {
  .font-bold { font-weight: 700; }
  .bg-white { background-color: #fff; }
  .text-2xl { font-size: 24px; }
  .m-4 { margin: 16px; }
  .box-content { box-sizing: content-box; }
}
`);
const UTIL_CLASSES = 'font-bold bg-white text-2xl m-4 box-content';
const WANT = {
  fontWeight: '700', backgroundColor: 'rgb(255, 255, 255)',
  fontSize: '24px', marginTop: '16px', boxSizing: 'content-box',
};
await scheme('light');
for (const [order, head] of [
  ['achroma before tailwind', `${TW_LAYERS}${ACHROMA}<link rel="stylesheet" href="${TW_PREFLIGHT}"><link rel="stylesheet" href="${TW_UTILITIES}">`],
  ['achroma after tailwind',  `${TW_LAYERS}<link rel="stylesheet" href="${TW_PREFLIGHT}">${ACHROMA}<link rel="stylesheet" href="${TW_UTILITIES}">`],
]) {
  await navigate(fixture('c4.html', page(head, UTIL_CLASSES)));
  const got = await evaluate(`(() => { const cs = getComputedStyle(document.body); return {
    fontWeight: cs.fontWeight, backgroundColor: cs.backgroundColor, fontSize: cs.fontSize,
    marginTop: cs.marginTop, boxSizing: cs.boxSizing }; })()`);
  for (const [prop, wanted] of Object.entries(WANT)) {
    checks++;
    check(got[prop] === wanted,
      `C4 (${order}): utility for ${prop} was defeated — expected ${wanted}, got ${got[prop]}. ` +
      `An unlayered base rule outranks every layered utility.`);
  }
}

// ── 4. I1: the focus ring comes from --ring and can be flipped ────────
for (const [os, wantFg] of [['light', LIGHT_FG], ['dark', DARK_FG]]) {
  await scheme(os);
  await navigate(fixture('ring.html', page(ACHROMA)));
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
  await evaluate('new Promise(r => requestAnimationFrame(r))', true);
  const m = await evaluate(`(() => { const b = document.getElementById('inp');
    return { visible: b.matches(':focus-visible'), colour: getComputedStyle(b).outlineColor }; })()`);
  checks++;
  check(m.visible, `I1: OS ${os}: nothing matched :focus-visible, so the ring was never measured`);
  expect(m.colour, wantFg, `I1: OS ${os} ring colour`, sameColour);

  // An inverted surface must be able to flip the ring in one declaration.
  await evaluate(`document.getElementById('inp').style.setProperty('--ring', 'var(--bg)'); true`);
  await evaluate('new Promise(r => requestAnimationFrame(r))', true);
  const flipped = await evaluate("getComputedStyle(document.getElementById('inp')).outlineColor");
  expect(flipped, os === 'dark' ? DARK_BG : LIGHT_BG, `I1: OS ${os} flipped ring colour`, sameColour);
}

// ── 5. I5/I6: which preferences hide the grain, and which must not ────
// The grain is a static SVG background with no animation, so reduced motion is
// the wrong query for it; reduced transparency, more contrast and print are the
// right ones. And a `spin ... infinite` indicator must keep iterating, or a
// reduced-motion user cannot tell "loading" from "hung".
const GRAIN_URL = fixture('grain.html', `<!doctype html><html><head><meta charset="utf-8">
${ACHROMA}<style>@keyframes spin { to { transform: rotate(360deg) } }
#spin { animation: spin 1s linear infinite; }</style></head>
<body><div id="spin"></div><div class="ac-grain" aria-hidden="true"></div></body></html>`);
const GRAIN_CASES = [
  ['no preference', [], '', 'block'],
  ['prefers-reduced-motion: reduce', [{ name: 'prefers-reduced-motion', value: 'reduce' }], '', 'block'],
  ['prefers-reduced-transparency: reduce', [{ name: 'prefers-reduced-transparency', value: 'reduce' }], '', 'none'],
  ['prefers-contrast: more', [{ name: 'prefers-contrast', value: 'more' }], '', 'none'],
  ['print', [], 'print', 'none'],
];
for (const [name, features, media, wantDisplay] of GRAIN_CASES) {
  await emulate(features, media);
  await navigate(GRAIN_URL);
  const m = await evaluate(`(() => ({
    grain: getComputedStyle(document.querySelector('.ac-grain')).display,
    iterations: getComputedStyle(document.getElementById('spin')).animationIterationCount,
  }))()`);
  expect(m.grain, wantDisplay, `I5: grain display under ${name}`);
  if (name.includes('reduced-motion')) {
    checks++;
    check(m.iterations === 'infinite',
      `I6: under reduced motion a spinner's iteration count became ${m.iterations}. ` +
      `Capping it to 1 freezes loading indicators on their final frame.`);
  }
}
await emulate([], '');

// ── 6. I7: an alias OF an alias must still flip ───────────────────────
//
// --info-text is `var(--fg-dim)`, not a ramp reference, and that makes it the
// only shape in the file whose correctness is a spec detail rather than a value.
//
// A custom property's computed value is its specified value WITH VARIABLES
// ALREADY SUBSTITUTED. So a single `--info-text: var(--fg-dim)` on :root would
// compute once, against light's --fg-dim, and inherit that finished colour into
// a nested `<section class="dark">` — the section would flip --bg, --fg and
// every ramp-referencing alias, and silently keep the light info grey. The fix
// is to repeat the declaration in all four blocks, which achroma.css does; this
// asserts the fix actually works rather than trusting the reasoning.
//
// The nested region is the case that matters. A whole-page toggle would pass
// even if the declaration existed only on :root, because :root is where the
// substitution would have happened anyway.
const NESTED_URL = fixture('nested.html', `<!doctype html><html><head><meta charset="utf-8">
${ACHROMA}</head><body>
<span id="outer">outer</span>
<section class="dark"><span id="inner">inner</span></section>
</body></html>`);
const LIGHT_DIM = aliasValue('light', '--fg-dim');
const DARK_DIM = aliasValue('dark', '--fg-dim');
const LIGHT_SUNKEN = aliasValue('light', '--bg-sunken');
const DARK_SUNKEN = aliasValue('dark', '--bg-sunken');

await scheme('light');
await navigate(NESTED_URL);
for (const [id, wantText, wantBg, where] of [
  ['outer', LIGHT_DIM, LIGHT_SUNKEN, 'page (light)'],
  ['inner', DARK_DIM, DARK_SUNKEN, 'nested section.dark'],
]) {
  const m = await evaluate(`(() => { const cs = getComputedStyle(document.getElementById('${id}'));
    return { text: cs.getPropertyValue('--info-text').trim(),
             bg: cs.getPropertyValue('--info-bg').trim() }; })()`);
  expect(m.text, wantText, `I7: --info-text in ${where}`, sameColour);
  expect(m.bg, wantBg, `I7: --info-bg in ${where}`, sameColour);
}

// ── 7. I8: elevation flips, and dark is the heavier side ──────────────
//
// One shadow set shared by both modes is invisible in dark: browsers composite
// in gamma-encoded sRGB, so one ramp step of darkening costs alpha 0.023 in
// light and 0.528 in dark. contrast.mjs asserts the source values differ; this
// asserts a browser actually resolves them per mode, which is the part a regex
// cannot see.
const alphaOf = (v) => {
  const a = [...v.matchAll(/\/\s*([\d.]+)\s*\)/g)].map((m) => Number(m[1]));
  return a.length ? Math.max(...a) : null;
};
const ELEV_URL = fixture('elev.html', page(ACHROMA));
const seen = {};
for (const os of ['light', 'dark']) {
  await scheme(os);
  await navigate(ELEV_URL);
  seen[os] = await evaluate(`(() => { const cs = getComputedStyle(document.documentElement);
    return { s1: cs.getPropertyValue('--shadow-1').trim(),
             s3: cs.getPropertyValue('--shadow-3').trim(),
             scrim: cs.getPropertyValue('--scrim').trim() }; })()`);
  for (const [k, v] of Object.entries(seen[os])) {
    checks++;
    check(alphaOf(v) !== null, `I8: OS ${os}, --${k} resolved to ${JSON.stringify(v)} with no alpha — the token did not resolve`);
  }
}
for (const k of ['s1', 's3', 'scrim']) {
  const [l, d] = [alphaOf(seen.light[k]), alphaOf(seen.dark[k])];
  checks++;
  check(l !== null && d !== null && d > l,
    `I8: ${k} alpha did not increase in dark (light ${l}, dark ${d}). A light-tuned ` +
    `shadow is absent on a dark page, not subtler — the gap is 23x.`);
}
await scheme('light');

// ── report ────────────────────────────────────────────────────────────
console.log(`\n${version.Browser}  (${CHROME})`);
console.log(`${checks} browser assertions`);
if (failures.length) {
  console.error(`\n${failures.length} failure(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  cleanup();
  process.exit(1);
}
console.log('all cascade assertions passed');
cleanup();
