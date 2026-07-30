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
2. **Aliases are what flip.** Each mode re-points 21 aliases at different ramp
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

**Info is the fourth state and it carries no hue.** The other three earn a colour
because each one asks you to do something; info is the state that says nothing is
wrong. Spending a fourth hue on the absence of a problem would devalue the other
three. `--info-*` keeps the same three-token shape and clears the same floors, in
grey.

## One accent, and it means affordance

There are exactly two kinds of colour here:

- **Status** — `--danger`, `--warn`, `--ok`. What happened.
- **Affordance** — `--accent`. What you can do.

`--accent-*` is indigo, hue 285. It is not decoration: a fully achromatic page
reads muted because "you can act on this" has nowhere to go, so weight and
position have to carry it alone. Giving affordance its own hue is the same argument
that gives danger one.

Hue 285 was picked against blue, teal and magenta on measured grounds. Max
in-gamut chroma at the shipped lightness of `0.520`:

| Hue | Chroma | |
|---|---|---|
| indigo 285 | **0.200** | chosen |
| magenta 340 | 0.196 | reads consumer in light mode |
| blue 250 | 0.128 | what Vercel, Stripe and Things already use |
| teal 200 | 0.077 | sRGB has almost no chroma in blue-green at mid lightness |

285 also sits far from all three status hues — 27, 78 and 152 — so an accent
border can never be misread as a warning.

Five tokens: `--accent-text`, `--accent-line`, `--accent-bg`, `--accent-fill` and
`--accent-on-fill`. The last two do not flip between modes, because white ink on
that fill clears 4.5:1 on paper *and* on ink.

**Use it for 1–3% of the pixels.** The greys are still the system. `::selection`
is the highest-leverage place it appears — a visitor triggers it by reflex, dozens
of times a session.

Want no hue at all? One line puts the ink button back:

```css
:root { --color-primary: var(--fg); --color-primary-foreground: var(--bg) }
```

## Components — the essentials

```css
@import 'achroma/achroma.css';
@import 'achroma/achroma.components.css';   /* optional */
```

Nine primitives in `@layer components`: `.ac-btn` (+ `-fill`, `-ink`, `-ghost`,
`-sm`), `.ac-field`, `.ac-card`, `.ac-badge`, `.ac-note`, `.ac-table`, `.ac-meter`,
`.ac-link`, and three layout primitives — `.ac-container`, `.ac-stack`,
`.ac-cluster` — plus `.ac-prose` for markdown you do not control.

A separate file on purpose. achroma.css is a token spine and its value is that it
fights nobody; a shadcn or MUI consumer wants the tokens and already owns their
components.

**Deliberately absent: dialog, dropdown, tabs, tooltip, accordion, toast.** Every
one needs focus trapping, ARIA wiring and keyboard handling to be correct, and CSS
alone produces something that looks right and is unusable with a keyboard. Use
Radix or shadcn and let the bridge style them.

## Elevation, and the 23× rule

Giving up hue costs you a hierarchy channel, so shadow is not decoration here.
`--shadow-1/2/3` and `--scrim` are **black at alpha** — never a tinted grey — and
`npm test` asserts chroma and hue are literally 0.

The alphas are per-mode and the gap is bigger than it looks. Browsers composite in
gamma-encoded sRGB, so darkening the page by one ramp step costs **α 0.023 in light
and α 0.528 in dark**. That is why one shadow set shared across modes has an
invisible dark mode, and why the dark values look absurd written down and read as
subtle on screen.

Two consequences worth knowing before you use them:

- **In light mode the shadow is not optional.** `--bg-raised` on `--bg` is 1.044:1,
  below the 1.15:1 floor this system sets for a decorative hairline. A borderless
  card in light mode has no edge unless a shadow gives it one.
- **In dark mode the scrim cannot separate surfaces.** There are ~2 ramp steps of
  room below `--bg` before pure black, so a scrimmed backdrop sits 1.17:1 from the
  dialog at α 0.65 and 1.19:1 at α 0.80. Dark dialogs get their separation from
  `--bg-raised`, `--shadow-3` and a hairline.

## The signature ships as four classes

`.ac-display` is huge, thin and tight; `.ac-label` is tiny, wide, uppercase and
mono. The tension between the two is the look, and both are in the package rather
than only in these docs. `.ac-grain` and `.ac-wash` are the opt-in texture pair.

Every class carries the `ac-` prefix, and that is not decoration. They live in
`@layer base`, so **any** consumer rule of the same name wins silently — a plain
`.label {}` in your own CSS would beat achroma's with no error anywhere. `display`
and `label` are common enough that the collision is a matter of time.

```html
<h1 class="ac-display">Achromatic.</h1>
<p class="ac-label">token reference</p>
<body class="ac-wash">…<div class="ac-grain" aria-hidden="true"></div></body>
```

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

`npm test` is 10 unit assertions plus 19 contrast pairs in each mode, the four-way
block parity, the gamut check and the elevation checks.

`test:cascade` drives whatever Chrome is installed over CDP (no dependencies —
Node's built-in `WebSocket`) and is 81 browser assertions: the 14-cell light/dark
mode matrix, consumer-override precedence, Tailwind layer order, the focus ring, the
`prefers-*` queries, and two things a regex cannot reach — that `--info-*` still
flips inside a nested `<section class="dark">` despite being an alias of an alias,
and that `--shadow-*`/`--scrim` resolve per mode.

Without a browser it prints a loud warning and exits 0. **CI should set
`ACHROMA_REQUIRE_BROWSER=1`**, which turns a missing browser into a failure — a
silent skip is indistinguishable from a pass.
