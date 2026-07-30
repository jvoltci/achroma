// Pins the OKLCH conversion to values that are not opinions.
//
// The sRGB primaries have exact OKLCH coordinates and exact WCAG luminances, so
// a wrong matrix coefficient shows up here rather than as a contrast ratio that
// looks reasonable and is wrong.

import assert from 'node:assert/strict';
import { parseOklch, oklchToLinearSrgb, luminance, contrast } from './oklch.mjs';

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
};
const close = (actual, expected, tol, what) =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${what}: expected ${expected} ± ${tol}, got ${actual}`,
  );

test('parseOklch reads all three components', () => {
  assert.deepEqual(parseOklch('oklch(0.985 0 0)'), { L: 0.985, C: 0, h: 0 });
  assert.deepEqual(parseOklch('  oklch(0.5 0.19 27)  '), { L: 0.5, C: 0.19, h: 27 });
  // CSS function names are ASCII case-insensitive, so this IS an oklch()
  // literal. Without the regex's `i` flag it returned null and would have been
  // skipped as "not a colour" — the same silent-skip hole, one keystroke away.
  assert.deepEqual(parseOklch('OKLCH(0.985 0 0)'), { L: 0.985, C: 0, h: 0 });
  assert.deepEqual(parseOklch('Oklch(0.5 0.19 27)'), { L: 0.5, C: 0.19, h: 27 });
});

// null is reserved for "not an oklch() literal", which a caller may skip freely.
test('parseOklch returns null for values that are not oklch() literals', () => {
  assert.equal(parseOklch('var(--n-25)'), null);
  assert.equal(parseOklch('#fafafa'), null);
});

// An oklch() literal it cannot parse must throw. If it returned null instead,
// Task 3's `if (!c) continue;` would skip a real colour and still report the
// suite as green — a token silently unmeasured rather than checked and passing.
// All of these are valid CSS that this deliberately does not measure.
test('parseOklch throws on oklch() forms it cannot measure', () => {
  for (const value of [
    'oklch(0 0 0 / 0.12)', // alpha: unmeasurable without compositing
    'oklch(98.5% 0 0)', // percentage lightness
    'oklch(0.985 0 0deg)', // angle unit
    'oklch(0.5 0.1 -20)', // signed hue
    'oklch(0.5 0.19)', // too few components
    'oklch(1.2.3 0 0)', // malformed number, would otherwise yield NaN
    'OKLCH(98.5% 0 0)', // uppercase is still an oklch() literal, still unmeasurable
  ]) {
    assert.throws(() => parseOklch(value), /unsupported oklch\(\) form/, value);
  }
  // The message must name the offending value, or a maintainer cannot find it.
  assert.throws(() => parseOklch('oklch(98.5% 0 0)'), /98\.5%/);
});

// The luminance assertions cannot fail on their own: luminance clamps, so any
// positive row-sum error still reads exactly 1 at white — even r0 += 2.0 passes.
// The raw channels are what actually pin each matrix row to summing to 1.
test('white is luminance 1, black is luminance 0', () => {
  const white = oklchToLinearSrgb({ L: 1, C: 0, h: 0 });
  close(white.r, 1, 0.002, 'white.r');
  close(white.g, 1, 0.002, 'white.g');
  close(white.b, 1, 0.002, 'white.b');
  close(luminance(white), 1, 0.002, 'white');

  const black = oklchToLinearSrgb({ L: 0, C: 0, h: 0 });
  close(black.r, 0, 0.002, 'black.r');
  close(black.g, 0, 0.002, 'black.g');
  close(black.b, 0, 0.002, 'black.b');
  close(luminance(black), 0, 0.002, 'black');
});

test('the sRGB red primary round-trips', () => {
  const { r, g, b } = oklchToLinearSrgb({ L: 0.62796, C: 0.25768, h: 29.234 });
  close(r, 1, 0.01, 'red.r');
  close(g, 0, 0.01, 'red.g');
  close(b, 0, 0.01, 'red.b');
  close(luminance({ r, g, b }), 0.2126, 0.005, 'red luminance');
});

test('the sRGB green primary round-trips', () => {
  const { r, g, b } = oklchToLinearSrgb({ L: 0.86644, C: 0.29483, h: 142.495 });
  close(r, 0, 0.01, 'green.r');
  close(g, 1, 0.01, 'green.g');
  close(b, 0, 0.01, 'green.b');
  close(luminance({ r, g, b }), 0.7152, 0.005, 'green luminance');
});

test('the sRGB blue primary round-trips', () => {
  const { r, g, b } = oklchToLinearSrgb({ L: 0.45201, C: 0.31321, h: 264.052 });
  close(r, 0, 0.01, 'blue.r');
  close(g, 0, 0.01, 'blue.g');
  close(b, 1, 0.01, 'blue.b');
  close(luminance({ r, g, b }), 0.0722, 0.005, 'blue luminance');
});

test('black on white is 21:1', () => {
  close(contrast({ L: 0, C: 0, h: 0 }, { L: 1, C: 0, h: 0 }), 21, 0.05, 'max contrast');
});

test('contrast is symmetric', () => {
  const a = { L: 0.13, C: 0, h: 0 };
  const b = { L: 0.985, C: 0, h: 0 };
  assert.equal(contrast(a, b), contrast(b, a));
});

// The whole ramp relies on this identity: with chroma 0 the OKLab a and b terms
// vanish, l_ = m_ = s_ = L, and the linear-sRGB matrix rows sum to 1 — so
// luminance is exactly L cubed. It is what makes the ramp checkable by hand.
//
// The tolerance is 1e-12 rather than the primaries' 0.01 because these inputs
// carry no rounding: C=0 makes cos/sin exact, so the only error is float noise,
// measured at 3.4e-16 across L in 0..1. This is the file's sharpest instrument
// and detects row-sum drift down to ~1e-12.
test('an achromatic colour has luminance L cubed', () => {
  for (const L of [0.09, 0.17, 0.52, 0.84, 0.922, 0.985]) {
    close(luminance(oklchToLinearSrgb({ L, C: 0, h: 0 })), L ** 3, 1e-12, `L=${L}`);
  }
});

// A renamed or deleted test would otherwise vanish without a trace, and a silent
// skip is indistinguishable from a pass.
assert.equal(passed, 10, `expected 10 tests to run, ${passed} did`);

console.log(`\n${passed} passed`);
