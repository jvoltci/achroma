# Tokens

Everything in this file is read out of `achroma.css`, and every ratio is what
`npm test` prints. Where a number cannot be computed from the bare tokens — the
grain and the wash both composite over content — it was measured from painted
pixels, and that is said explicitly.

## The ramp — 16 steps, chroma exactly 0

Chroma and hue are exactly `0` on every step. That collapses the OKLCH-to-sRGB
chain to `Y = L³` for the whole ladder: with `C = 0` the OKLab `a` and `b` terms
vanish, all three LMS values equal `L³`, and the three sRGB matrix rows sum to 1,
so the WCAG relative luminance is `L³` exactly. Not approximately — the column
below and the cube of the column beside it agree to every digit shown.

That is the practical reason the ramp is achromatic and not merely desaturated:
any contrast ratio on it can be checked by hand with a calculator, and
`oklch.test.mjs` pins the identity as its own assertion.

| Token | OKLCH | Relative luminance `Y = L³` |
|---|---|---|
| `--n-0` | `oklch(1.000 0 0)` | 1.0000 |
| `--n-25` | `oklch(0.985 0 0)` | 0.9557 |
| `--n-50` | `oklch(0.968 0 0)` | 0.9070 |
| `--n-100` | `oklch(0.945 0 0)` | 0.8439 |
| `--n-150` | `oklch(0.922 0 0)` | 0.7838 |
| `--n-200` | `oklch(0.900 0 0)` | 0.7290 |
| `--n-300` | `oklch(0.840 0 0)` | 0.5927 |
| `--n-400` | `oklch(0.720 0 0)` | 0.3732 |
| `--n-500` | `oklch(0.620 0 0)` | 0.2383 |
| `--n-600` | `oklch(0.520 0 0)` | 0.1406 |
| `--n-700` | `oklch(0.400 0 0)` | 0.0640 |
| `--n-800` | `oklch(0.300 0 0)` | 0.0270 |
| `--n-850` | `oklch(0.220 0 0)` | 0.0106 |
| `--n-900` | `oklch(0.170 0 0)` | 0.0049 |
| `--n-950` | `oklch(0.130 0 0)` | 0.0022 |
| `--n-1000` | `oklch(0.090 0 0)` | 0.0007 |

Two assertions guard the ladder. `chroma must be exactly 0` rejects a stray
`0.01`, which no eye would catch and which would propagate to every installed
site. `ramp out of order` rejects a step that is not darker than the one above it,
because otherwise "one step darker" is a lie the aliases are built on.

!!! warning "Chroma-zero is a **source**-level guarantee"

    A minifier targeting old browsers rewrites the ramp out of `oklch()`
    altogether — Lightning CSS at `defaults` emits
    `lab(96.288% -.0000298023 0)`, which is neither chroma 0 nor checkable by the
    parser. `package.json` therefore pins
    `browserslist: ["chrome >= 111", "safari >= 16.4", "firefox >= 113"]`, modern
    enough that `oklch()` passes through untouched. Widen that list and the
    guarantee leaves with it.

!!! note "Computed ratios versus a pixel-sampling checker"

    `test/oklch.mjs` computes from continuous `L`; WCAG decodes from 8-bit
    quantized channels. The two disagree by about 0.02 on mid-ramp ratios
    (`L=0.17` on `L=0.52` is 3.4711 computed and 3.4917 quantized) and by up to
    about 0.05 near 21:1. That is roughly 100× the tolerance the coefficient tests
    admit, so quantization dominates the error. It flips no threshold today, but
    do not tighten a limit to 3.48 on the strength of a computed 3.4711 — a
    third-party checker reading 3.49 would disagree with you.

## The 18 aliases — what a mode change actually does

A mode change re-points these and touches nothing else. Nine are neutral, and the
table gives the ramp step each mode aims them at. The other nine carry hue and
are listed in [Semantics](#semantics-the-only-colour-in-the-system).

| Alias | Light | Dark | What it is for | Asserted target | Light | Dark |
|---|---|---|---|---|---|---|
| `--bg` | `--n-25` | `--n-900` | The page. Light is `--n-25`, not `--n-0`, so `--bg-raised` has a lighter step left to move to | — | — | — |
| `--bg-raised` | `--n-0` | `--n-850` | Cards, popovers, menus — one step toward the viewer | — | — | — |
| `--bg-sunken` | `--n-50` | `--n-950` | Wells, sidebars, inset panels, muted fills | — | — | — |
| `--fg` | `--n-950` | `--n-50` | Body text and anything that must be read first | ≥ 7.0 on `--bg` | 19.27:1 | 17.43:1 |
| `--fg-dim` | `--n-600` | `--n-400` | Secondary text — still body copy, so it keeps the AA floor | ≥ 4.5 on `--bg` | 5.28:1 | 7.71:1 |
| `--fg-faint` | `--n-500` | `--n-500` | Labels, captions, metadata. Large/incidental text only | ≥ 3.0 on `--bg` | 3.49:1 | 5.25:1 |
| `--hairline` | `--n-150` | `--n-800` | The default border. Visible, deliberately barely | ≥ 1.15 on `--bg` | 1.21:1 | 1.40:1 |
| `--rule` | `--n-300` | `--n-700` | The stronger line: form-control borders, section dividers | ≥ 1.4 on `--bg` | 1.56:1 | 2.08:1 |
| `--ring` | `var(--fg)` | `var(--fg)` | The focus outline. A token, not `--fg` directly, so an inverted surface can flip it in one declaration | — | — | — |

`--fg-faint` is the one alias that does not move between modes: `--n-500` at
`Y = 0.2383` sits far enough from both `--n-25` and `--n-900` to clear 3:1 either
way, so there is nothing to flip.

The thresholds are not decoration. `TARGETS` in `test/contrast.mjs` is a list of
`[alias, against, minimum]` triples, described there as *"the reason each token
exists, as a number"*. `--hairline` at 1.15 and `--rule` at 1.4 are floors on
*visibility*, not WCAG levels — a border nobody can see is not subtle, it is
absent.

## Semantics — the only colour in the system

Nine tokens, three per state, and the split is not stylistic. One token cannot do
three jobs at three different contrast requirements:

| Suffix | Job | Requirement |
|---|---|---|
| `-text` | Label and body text inside the callout, icon glyphs | 4.5:1 on `--bg` **and** 4.5:1 on its own `-bg` |
| `-line` | Borders, left rails, underlines, chart strokes | 3:1 on `--bg` |
| `-bg` | The fill behind the callout | Carries `-text` at 4.5:1 |

**Amber is why one token per semantic is not enough.** `oklch(0.62 0.13 75)` on
paper is **3.57:1**. That is a perfectly good border and an illegal paragraph. An
amber bright enough to read as a warning border can never also be legible body
text, so either the border is too dark to read as amber or the text fails AA.
Splitting the token is the only way out.

| Token | Light | Dark | On `--bg` (light / dark) | On its `-bg` (light / dark) |
|---|---|---|---|---|
| `--danger-text` | `oklch(0.50 0.19 27)` | `oklch(0.72 0.16 25)` | 6.34:1 / 7.19:1 (≥ 4.5) | 5.96:1 / 6.27:1 (≥ 4.5) |
| `--danger-line` | `oklch(0.62 0.17 27)` | `oklch(0.53 0.15 27)` | 3.78:1 / 3.36:1 (≥ 3.0) | — |
| `--danger-bg` | `oklch(0.965 0.015 27)` | `oklch(0.240 0.045 27)` | — | — |
| `--warn-text` | `oklch(0.48 0.10 75)` | `oklch(0.82 0.13 82)` | 6.38:1 / 10.85:1 (≥ 4.5) | 6.07:1 / 9.36:1 (≥ 4.5) |
| `--warn-line` | `oklch(0.62 0.12 78)` | `oklch(0.55 0.11 78)` | 3.55:1 / 3.88:1 (≥ 3.0) | — |
| `--warn-bg` | `oklch(0.968 0.022 85)` | `oklch(0.240 0.040 80)` | — | — |
| `--ok-text` | `oklch(0.48 0.12 150)` | `oklch(0.78 0.13 155)` | 5.92:1 / 10.06:1 (≥ 4.5) | 5.62:1 / 8.79:1 (≥ 4.5) |
| `--ok-line` | `oklch(0.58 0.12 150)` | `oklch(0.52 0.11 152)` | 3.89:1 / 3.66:1 (≥ 3.0) | — |
| `--ok-bg` | `oklch(0.965 0.018 150)` | `oklch(0.230 0.040 152)` | — | — |

Every value above was measured, not estimated. Three earlier drafts did not
survive: `--warn-text` was outside the sRGB gamut, `--warn-line` had no margin at
3.03:1, and dark `--danger-line` failed at 2.95:1.

### Why the gamut check exists

An out-of-gamut colour is clamped on its way to a luminance, and the clamped value
can report a *better* ratio than the colour a browser will paint. The worked
example: `oklch(0.62 0.30 75)` has a blue channel of `-0.1252`; clamping lifts it
to `Y = 0.2256` and it claims 3.65:1, where the in-gamut colour manages 3.57:1. A
chromatic token that passes its threshold while out of gamut is a false pass —
exactly the shape the test file exists to prevent. The ramp cannot hit this
(chroma 0 with `L` in `[0,1]` always lands in gamut), which is why the check is
scoped to the tokens that carry hue.

## Type

| Token | Value |
|---|---|
| `--font-sans` | `'Geist Variable', ui-sans-serif, system-ui, -apple-system, sans-serif` |
| `--font-mono` | `'Geist Mono Variable', ui-monospace, 'SF Mono', Menlo, monospace` |
| `--text-2xs` | `0.6875rem` |
| `--text-xs` | `0.75rem` |
| `--text-sm` | `0.8125rem` |
| `--text-base` | `0.9375rem` |
| `--text-md` | `1.0625rem` |
| `--text-lg` | `1.25rem` |
| `--text-xl` | `1.5rem` |
| `--text-2xl` | `1.875rem` |
| `--text-display` | `clamp(2.5rem, 6vw, 5rem)` |
| `--w-thin` | `200` |
| `--w-light` | `300` |
| `--w-regular` | `400` |
| `--w-medium` | `500` |
| `--track-display` | `-0.035em` |
| `--track-tight` | `-0.015em` |
| `--track-normal` | `0` |
| `--track-label` | `0.14em` |
| `--lh-display` | `1.02` |
| `--lh-tight` | `1.25` |
| `--lh-body` | `1.6` |

The scale tops out at 500; there is no bold. Huge-and-thin against tiny-and-wide
is the signature, and the weight axis is not where hierarchy is carried.

`body` ships at `--text-base` / `--w-light` / `--lh-body`. Headings are pinned to
`--w-medium`, `--track-tight`, `--lh-tight` and map onto the same scale — `h1` is
`--text-2xl` through to `h6` at `--text-sm`. Note that `h5` lands on `--text-base`
(body size) and `h6` below it: past `h4` a heading is a label, and weight plus
tracking carry the hierarchy. The huge-and-thin display treatment stays opt-in
through `--text-display` / `--track-display`; it is not an `h1` default.

The heading pin exists because the two consumers disagree about every metric
otherwise. Measured from `achroma.css` alone: `h1` was 700/30px in a plain page
and 300/15px in a Tailwind one, because the UA sheet makes headings bold and
`h1` 2em while Tailwind's preflight resets them to `font-size: inherit` and
`font-weight: inherit`.

Font coverage is `latin`, `latin-ext` and `cyrillic`, and nothing else.
Vietnamese precomposed forms (U+1EC7, U+1EBF, …), box-drawing glyphs (U+250C, …),
Devanagari, Arabic, Greek, Korean, Tamil, Telugu and Thai are in no declared
range and fall back **per glyph** — so `Việt` renders V-i-t in Geist with ệ from
the system sans, a font change mid-word. Fontsource ships `vietnamese` and
`symbols2` subsets if that becomes a problem; this package deliberately does not
vendor them.

## Space — 4px base

| Token | Value | | Token | Value |
|---|---|---|---|---|
| `--s-1` | `0.25rem` | | `--s-8` | `2rem` |
| `--s-2` | `0.5rem` | | `--s-10` | `2.5rem` |
| `--s-3` | `0.75rem` | | `--s-12` | `3rem` |
| `--s-4` | `1rem` | | `--s-16` | `4rem` |
| `--s-5` | `1.25rem` | | `--s-20` | `5rem` |
| `--s-6` | `1.5rem` | | `--s-24` | `6rem` |

## Radius — near-sharp on purpose

| Token | Value |
|---|---|
| `--r-0` | `0` |
| `--r-sm` | `2px` |
| `--r-md` | `4px` |
| `--r-lg` | `8px` |

## Motion

| Token | Value |
|---|---|
| `--ease-spring` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--ease-out` | `cubic-bezier(0.33, 1, 0.68, 1)` |
| `--dur-1` | `120ms` |
| `--dur-2` | `180ms` |
| `--dur-3` | `280ms` |
| `--dur-4` | `420ms` |
| `--stagger` | `40ms` |

Under `prefers-reduced-motion: reduce` all five durations become `0ms`, and a
universal `*` rule additionally forces `animation-duration`,
`transition-duration` and `scroll-behavior` — both halves are needed, because the
tokens only reach CSS that consumes them and the universal rule catches
third-party and Radix animations that never heard of them.

It is deliberately **not** `animation-iteration-count: 1`. That runs a
`spin 1s infinite` loading indicator for one 0.01ms iteration and freezes it on
its final frame, leaving a reduced-motion user unable to tell "loading" from
"hung". Non-decorative progress indicators are the standard carve-out; removing
the duration is enough.

## Texture, and its ceilings

Two tokens, and the non-obvious part of both is the **maximum**, not the value.
Both sit above or behind content, so both composite with foreground *and*
background and compress every ratio in the file. `test/contrast.mjs` computes from
the bare token values and **cannot see either one**. The tables below are measured
from painted pixels; they are the only evidence there is.

| Token | Light | Dark |
|---|---|---|
| `--grain-opacity` | `0.10` | `0.07` |
| `--wash` | `radial-gradient(120% 70% at 50% -15%, var(--n-0) 0%, transparent 55%)` | same gradient, `var(--n-850)` |

### `--grain-opacity`

The overlay sits above everything at `z-index: 9999`, so it composites over text.
Measured from painted pixels, light mode, `--fg-dim` on `--bg` against its 4.5:1
floor:

| opacity | off | 0.05 | 0.10 | 0.12 | 0.15 | 0.18 | 0.25 |
|---|---|---|---|---|---|---|---|
| ratio | 5.260 | 5.019 | **4.807** | 4.722 | 4.598 | 4.487 | 4.229 |

`0.18` — which is what reads as "clearly grainy" — puts `--fg-dim` **below WCAG
AA** at 4.487:1. The shipped `0.10` leaves 0.307 of margin. Do not raise it past
about 0.15, and if you do, re-measure rather than assume: the failure is body text
quietly dropping below 4.5:1, and no assertion in the repo will catch it.

Two further constraints on the grain, both counter-intuitive enough to state:

- **The data URI must stay inline in the `.grain` rule, in the comma form.**
  Moving it into a custom property, or switching to `;base64` or `;utf8`,
  truncates it at the first semicolon when `test/contrast.mjs` parses the file —
  93% of the value gone, no error, every other check still green, and a grain that
  quietly stops working. That was reproduced, and it printed *"all ramp assertions
  passed"*. It is enforced by four assertions now, not only by a comment.
- **`background-size` stays at 180px**, matching the SVG's own viewport. Chrome
  re-rasterises the filter at device resolution rather than upscaling a 180×180
  bitmap — at 2× only 0.5% of horizontally adjacent device pixels are identical,
  where nearest-neighbour upscaling would give ~100% — so noise *amplitude* is
  untouched by DPI (per-pixel luminance sd ~1.16 light, ~1.38 dark, across every
  combination of 90px/180px and 1×/2×). What changes is spatial frequency. sd of
  6-CSS-pixel block means, equal physical area at both DPIs: light 1× 0.1402 →
  0.1566 (+12%), light 2× 0.0860 → 0.0641 (−26%), dark 1× 0.1639 → 0.2317 (+41%),
  dark 2× 0.0951 → 0.0820 (−14%) going from 180px to 90px. Halving the tile helps
  at 1× and hurts at 2×, which is the wrong trade when most of the audience is on
  a retina display. If the grain ever needs to read stronger at 2×, the lever is a
  *larger* `background-size`, or a `min-resolution` query raising the opacity.

The grain is hidden under `prefers-reduced-transparency: reduce`,
`prefers-contrast: more` and `print`. It is deliberately *not* hidden under
`prefers-reduced-motion`: it is a static SVG background with no animation,
transition or transform, and "Reduce motion" is widely enabled for battery
reasons, so hiding it there cost those users the system's headline detail for no
motion benefit.

### `--wash`

A single top-light gradient, **one ramp step** and no more, fading out by 55% of
the viewport. Achromatic systems read flat, and this is the cheapest depth
available that introduces no hue.

It is capped for the same reason as the grain: a wash changes `--bg` locally, so
every ratio computed from the bare token becomes optimistic. In **light** the wash
lightens the page, pushing dark text further clear — harmless. In **dark** it also
lightens, which pushes light text *toward* failing, so dark is the side that
constrains the value. Measured on painted pixels at the top of the page, where the
wash is strongest:

| | bg `Y` | `--fg` | `--fg-dim` |
|---|---|---|---|
| light top | 0.97345 | 19.63 | 5.35 |
| light base | 0.95597 | 19.30 | 5.26 |
| dark top | 0.00700 | 16.75 | **7.39** |
| dark base | 0.00478 | 17.43 | 7.69 |

Floors are 7.0 and 4.5. The wash costs dark `--fg-dim` **0.30** — 7.69 down to
7.39 — which one step can afford and two cannot. Two ramp steps would put dark
`--fg-dim` near its floor and `contrast.mjs` would keep reporting its bare-token
7.71, having never seen the wash. (7.71 computed against 7.69 painted is the
quantization gap noted above, not a disagreement about the token.)

The wash is **not applied by default**; a design system should not decide that
every consumer's page has atmosphere. Opt in with
`background-image: var(--wash)` on `body` — see
[Recipes](recipes.md#the-wash-opt-in).

## How to add a token

Three rules, and each of them exists because breaking it fails quietly.

**A neutral must be chroma 0, hue 0.** `oklch(0.62 0.01 250)` looks identical on
your monitor and puts a blue cast on every surface of every site that installs
this. The chroma-zero assertion is the only thing between that value and a
release.

**A chromatic token must be added to *both* `COLOUR_ALIASES` and `TARGETS` in
`test/contrast.mjs`.** The gamut loop skips any token it cannot resolve, which is
only safe because every chromatic token also has a contrast target — there, an
unresolvable value is a loud `cannot resolve` failure. Add a hue-carrying alias to
`COLOUR_ALIASES` and forget `TARGETS`, and it becomes gamut-skippable: no
assertion covers it and nothing warns. That coupling is invisible enough that the
test file asserts it directly — *"carries hue but appears in no `TARGETS` entry"*.

**A value added to one alias block must be added to all four.** `light`, `dark`,
`dark-class` and `light-class` are four copies of 18 values plus
`--grain-opacity`, and the parity check is the only thing that catches drift
between them. A stale copy renders perfectly — just in the wrong mode. Verified:
changing `--fg-dim` in the `dark-class` block alone left every printed ratio
byte-identical, because the contrast tables read only `light` and `dark` and never
look at the class blocks at all.

The four blocks are found by parsing `/* @achroma light */`,
`/* @achroma dark */`, `/* @achroma dark-class */` and
`/* @achroma light-class */`. Those marker comments are load-bearing: the test
fails if there are not exactly four, and all component CSS must stay after the
last one.
