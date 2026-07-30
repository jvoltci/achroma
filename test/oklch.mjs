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
 *
 * `null` means "not an oklch() literal at all" — a `var()`, a hex, a keyword —
 * and callers are expected to skip those. An `oklch()` literal that this cannot
 * parse throws instead, because the two cases must not look alike. Percentages,
 * angle units, signed hues and `/ alpha` are all valid CSS that this
 * deliberately does not measure; a caller skipping them silently would report a
 * colour as passing when it was never checked at all.
 *
 * @returns {Oklch | null} null when the value is not an oklch() literal.
 * @throws {Error} when it is an oklch() literal in an unsupported form.
 */
export function parseOklch(value) {
  const text = String(value).trim();
  if (!/^oklch\(/i.test(text)) return null;

  const m = /^oklch\(\s*(\d*\.?\d+)\s+(\d*\.?\d+)\s+(\d*\.?\d+)\s*\)$/i.exec(text);
  if (!m) {
    throw new Error(
      `parseOklch: unsupported oklch() form ${JSON.stringify(text)} — expected three ` +
        `unitless components, so no percentages, angle units, signed hues or alpha. ` +
        `An unmeasurable colour must fail loudly rather than be skipped.`,
    );
  }
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
 *
 * One caveat, and it is the largest error in this file: WCAG decodes from 8-bit
 * quantized channels, whereas this computes from continuous L. So a third-party
 * checker sampling rendered pixels can disagree — measured at ~0.02 on mid-ramp
 * ratios (L=0.17 on 0.52: 3.4711 here, 3.4917 quantized) and up to ~0.05 near
 * 21:1. That is ~100x the tolerance the coefficient tests admit, so quantization
 * dominates. It flips no threshold today, but do not tighten a limit to 3.48 on
 * the strength of a computed 3.4711 — a checker reading 3.49 would disagree.
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
