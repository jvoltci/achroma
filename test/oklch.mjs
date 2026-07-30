// OKLCH -> linear sRGB -> WCAG relative luminance.
//
// Hand-written because the alternative is a dependency in a package that
// promises none, and because these numbers decide whether the ramp ships. A
// wrong coefficient would not throw — it would return plausible contrast ratios
// that are wrong. oklch.test.mjs pins it to the sRGB primaries.
//
// Matrices: Bjorn Ottosson's OKLab, https://bottosson.github.io/posts/oklab/

/** @typedef {{ L: number, C: number, h: number }} Oklch */

/**
 * Parse `oklch(L C H)` with unitless components.
 * @returns {Oklch | null} null when the value is not a plain oklch() literal.
 */
export function parseOklch(value) {
  const m = /^oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)$/.exec(String(value).trim());
  if (!m) return null;
  return { L: Number(m[1]), C: Number(m[2]), h: Number(m[3]) };
}

/**
 * OKLCH to linear-light sRGB. Deliberately unclamped: a channel outside [0,1]
 * means the colour is outside the sRGB gamut, and callers may want to know.
 * @param {Oklch} colour
 */
export function oklchToLinearSrgb({ L, C, h }) {
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  };
}

/**
 * WCAG 2.x relative luminance. The input is already linear-light, which is what
 * WCAG's gamma-decode step produces, so there is no further decoding to do.
 * Out-of-gamut channels are clamped, because a display cannot show them.
 */
export function luminance({ r, g, b }) {
  const c = (v) => Math.min(1, Math.max(0, v));
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}

/**
 * WCAG 2.x contrast ratio, 1..21.
 * @param {Oklch} a
 * @param {Oklch} b
 */
export function contrast(a, b) {
  const ya = luminance(oklchToLinearSrgb(a));
  const yb = luminance(oklchToLinearSrgb(b));
  const [hi, lo] = ya >= yb ? [ya, yb] : [yb, ya];
  return (hi + 0.05) / (lo + 0.05);
}
