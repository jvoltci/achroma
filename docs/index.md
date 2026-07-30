# achroma

An achromatic design system: black, white and greys, with hue reserved for
meaning. Plain CSS custom properties — zero dependencies, no build step, no
runtime, so React, Next, Vite, Astro and a bare `.html` file consume the
identical file.

## Install

```bash
npm i achroma
```

```css
@import 'achroma/achroma.css';
```

No tooling:

```html
<link rel="stylesheet" href="https://unpkg.com/achroma@0/achroma.css">
```

The major version in that URL is pinned deliberately. A copy-pasted `<link>` has
no lockfile and no way to notice a breaking token rename — it would just quietly
lose its styling.

For Tailwind v4 and shadcn there is a third import, and the order is
load-bearing. See [Tailwind and shadcn](tailwind.md).

## The two rules

1. **The ramp is absolute.** All 16 `--n-*` steps are chroma `0`, hue `0`, and
   identical in both modes. A stray `0.01` is invisible by eye and would reach
   every site that installs this, so `npm test` fails if that stops being true.
2. **Aliases are what flip.** Each mode re-points 21 aliases at different ramp
   steps. It is not a second palette to keep in sync.

Both rules are the reference page's subject: [Tokens](tokens.md).

## Colour is never decoration

Hue appears in `--danger-*`, `--warn-*` and `--ok-*` and nowhere else. Those nine
tokens are the entire colour budget of the system.

The line that decides what is in scope is **interface versus content**. The
interface is achroma's to govern. Content — anything a user *chose* or a document
*contains* — is not, and forcing it into the ramp would destroy information:

- **A yellow highlighter has to be yellow.** The colour is the user's choice and
  it is the data. Rendering their yellow, green and pink highlights as three
  greys loses which is which.
- **A confidence heat-map has to run green to amber.** Its hue *is* the quantity
  being encoded. An achromatic version does not read as "less decorated", it
  reads as unlabelled.

Charts fall on the content side of that line for the same reason, which is why
the Tailwind bridge deliberately ships no chart colours — see
[what the bridge does not provide](tailwind.md#what-the-bridge-does-not-provide).

Each semantic has three tokens because one cannot do three jobs: `-text` clears
4.5:1 on the page background, `-line` clears 3:1 for borders, `-bg` is a subtle
fill. Amber is the proof — `oklch(0.62 0.13 75)` on paper is 3.57:1, so an amber
bright enough to read as a warning border can never also be legible body text.

**Info is the fourth state and it is grey.** The other three earn a hue because each
asks you to act; info is the state that says nothing is wrong. Spending a fourth hue
on the absence of a problem would devalue the other three, so `--info-*` keeps the
same three-token shape and the same floors without any colour — see
[Info is the fourth state](tokens.md#info-is-the-fourth-state-and-it-carries-no-hue).

## Elevation, and the 23× rule

Giving up hue costs a hierarchy channel, so shadow is load-bearing rather than
decorative. `--shadow-1/2/3` and `--scrim` are **black at alpha**, never a tinted
grey, and that is asserted.

Because browsers composite in gamma-encoded sRGB, darkening the page by one ramp
step costs **α 0.023 in light and α 0.528 in dark** — 23× apart. Two consequences:

- **In light mode the shadow is not optional.** `--bg-raised` on `--bg` is 1.044:1,
  below the 1.15:1 floor set for a decorative hairline, so a borderless card has no
  edge unless a shadow gives it one.
- **In dark mode the scrim cannot separate surfaces.** No alpha gets a scrimmed
  backdrop past ~1.19:1 from the dialog surface, so dark dialogs lean on
  `--bg-raised`, `--shadow-3` and a hairline instead.

Full measurements in [Elevation](tokens.md#elevation).

## The signature ships as two classes

`.display` is huge, thin and tight; `.label` is tiny, wide, uppercase and mono. The
tension between them is the look, and both live in the package rather than only in
these docs. `.grain` and `.wash` are the opt-in texture pair.

## The live reference

<https://jvoltci.github.io/achroma/> renders `proof.html`: every ramp step, every
alias, both modes, the type scale, the semantic callouts and the grain, all read
back from *computed* values. If a swatch there renders transparent, that token is
missing — the page cannot claim a token exists when it does not.

## The claims are machine-asserted

```bash
npm test               # tokens: ramp, parity, gamut, contrast. Fast, no browser.
npm run test:cascade   # cascade: needs Chrome. Not part of npm test.
```

`npm test` asserts chroma is exactly 0 on all 16 ramp steps, that the ramp is
monotonic, that the four alias blocks agree, that every chromatic token is inside
the sRGB gamut, that elevation is black at alpha and heavier in dark at every
layer, and every contrast target on this site — 19 of them, in each mode. It prints
each ratio whether it passes or not, because a pass/fail line tells you less than
the numbers do.

That is what makes the numbers on these pages checkable rather than aspirational.
The ones `npm test` cannot see are called out where they appear: the grain and the
wash both composite over content, so both compress contrast, and the ceilings
they impose are documented in [Tokens](tokens.md#texture-and-its-ceilings).

`test:cascade` drives whatever Chrome is installed over CDP and asserts the
14-cell light/dark mode matrix, consumer-override precedence, Tailwind layer
order, the focus ring and the `prefers-*` queries. None of that is reachable from
a regex. Without a browser it prints a loud warning and exits 0, so CI sets
`ACHROMA_REQUIRE_BROWSER=1` — a silent skip is indistinguishable from a pass.
