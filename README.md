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
@import 'achroma/achroma.tailwind.css';
```

## The two rules

1. **The ramp is absolute.** Every `--n-*` is chroma `0`, hue `0`, and identical
   in both modes. `npm test` fails if that stops being true.
2. **Aliases are what flip.** Dark mode re-points ~17 aliases at different ramp
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
next-themes) works too: `.dark` or `[data-theme='dark']`.

## Tokens

See `achroma.css` — it is the documentation. `proof.html` renders all of it.
