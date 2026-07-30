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
});

test('parseOklch returns null for anything else', () => {
  assert.equal(parseOklch('var(--n-25)'), null);
  assert.equal(parseOklch('#fafafa'), null);
  assert.equal(parseOklch('oklch(0.5 0.19)'), null);
});

test('white is luminance 1, black is luminance 0', () => {
  close(luminance(oklchToLinearSrgb({ L: 1, C: 0, h: 0 })), 1, 0.002, 'white');
  close(luminance(oklchToLinearSrgb({ L: 0, C: 0, h: 0 })), 0, 0.002, 'black');
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
test('an achromatic colour has luminance L cubed', () => {
  for (const L of [0.09, 0.17, 0.52, 0.84, 0.922, 0.985]) {
    close(luminance(oklchToLinearSrgb({ L, C: 0, h: 0 })), L ** 3, 0.0005, `L=${L}`);
  }
});

console.log(`\n${passed} passed`);
