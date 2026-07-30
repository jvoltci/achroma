# achroma

An achromatic design system. Black, white and greys, with hue reserved for
meaning.

Zero dependencies. Plain CSS custom properties, no build step, no runtime. React,
Next, Vite, Astro and a bare `.html` file all consume the identical file.

Live token reference: <https://jvoltci.github.io/achroma/>

## Install

```bash
npm i achroma
```

```css
@import 'achroma/achroma.css';
```

No tooling? `<link rel="stylesheet" href="https://unpkg.com/achroma@0/achroma.css">`

The major version is pinned deliberately. A copy-pasted `<link>` has no lockfile
and no way to notice a breaking token rename — it would just quietly lose its
styling.

Tailwind v4 + shadcn, additionally:

```css
@import 'tailwindcss';
@import 'achroma/achroma.css';
@import 'achroma/achroma.tailwind.css';
```

**Import Tailwind first.** achroma's element defaults live in `@layer base`, and
so does Tailwind's preflight — within one layer the last rule wins. Reversed, the
preflight's `h1…h6 { font-weight: inherit }` overwrites achroma's headings and
they render at the body weight of 300 instead of 500. Nothing errors; the page
just looks wrong. Utilities are unaffected either way, because `@layer utilities`
outranks `@layer base` regardless of import order.

## The two rules

1. **The ramp is absolute.** Every `--n-*` is chroma `0`, hue `0`, and identical
   in both modes. `npm test` fails if that stops being true.
2. **Aliases are what flip.** Each mode re-points 18 aliases at different ramp
   steps. It is not a second palette to keep in sync.

## Colour is never decoration

Hue appears only in `--danger-*`, `--warn-*` and `--ok-*`, and it never governs
content. Anything a user *chose* or a document *contains* is outside this system's
reach — a yellow highlighter has to be yellow, and a confidence heat-map has to
run green to amber.

Each semantic has three tokens because one cannot do three jobs: `-text` clears
4.5:1 on the page background, `-line` clears 3:1 for borders, `-bg` is a subtle
fill. Amber is why — `oklch(0.62 0.13 75)` on paper is 3.57:1, so an amber bright
enough to read as a warning border can never also be legible body text.

## Dark mode

Set nothing and it follows `prefers-color-scheme`. Class-based toggling (e.g.
next-themes) works too: `.dark` or `[data-theme='dark']`, and `.light` /
`[data-theme='light']` to pin light even when the OS is dark.

All four blocks are specificity `0,1,0` on purpose, so your own `.dark { … }`
written after this file always wins. They work on any element, not just `<html>`,
so `<section class="dark">` inverts a single region.

## Tokens

See `achroma.css` — it is the documentation. `proof.html` renders all of it.

## Tests

```bash
npm test           # tokens: ramp, parity, gamut, contrast. Fast, no browser.
npm run test:cascade   # cascade: needs Chrome. Not part of npm test.
```

`test:cascade` drives whatever Chrome is installed over CDP (no dependencies —
Node's built-in `WebSocket`) and asserts the 14-cell light/dark mode matrix,
consumer-override precedence, Tailwind layer order, the focus ring and the
`prefers-*` queries. None of that is reachable from a regex.

Without a browser it prints a loud warning and exits 0. **CI should set
`ACHROMA_REQUIRE_BROWSER=1`**, which turns a missing browser into a failure — a
silent skip is indistinguishable from a pass.
