# Dark mode

## Zero config

Import `achroma.css` and set nothing. `@media (prefers-color-scheme: dark)`
re-points the 18 aliases and there is no other step:

```css
@import 'achroma/achroma.css';
```

`:root` also carries `color-scheme: light dark`, so form controls and scrollbars —
which are the UA's to paint, not the tokens' — follow the OS along with them.

## Forcing a mode

Two markers, either an attribute or a class, and both work in both directions:

```html
<html data-theme="dark">   <!-- or class="dark"  -->
<html data-theme="light">  <!-- or class="light" -->
```

They are not prefixed with `:root`, so they work on **any** element, not only
`<html>`. `<section class="dark">` inverts one region of an otherwise light page —
useful for a footer or a code panel, and the tokens inside it resolve normally
because everything downstream reads the aliases rather than the ramp.

Removing the marker returns the element to `prefers-color-scheme`.

## Class-based toggling (next-themes and friends)

next-themes writes `class="dark"` on `<html>`, which is one of the two markers, so
it works with no adapter:

```jsx
<ThemeProvider attribute="class" defaultTheme="system">
```

`attribute="data-theme"` works equally well — `[data-theme='dark']` is the other
marker. Either way the library's own `system` mode is what falls through to the
media query.

## Why `.light` has to exist

The light-class block is not symmetry for its own sake. Two things break without
it, and both bite **only when the OS is dark**:

1. `color-scheme: light dark` on `:root` resolves to **dark** under OS-dark no
   matter which tokens won. Measured: an `<input>` rendered at `rgb(59,59,59)`
   with white text on an `oklch(0.985 0 0)` page. Only `color-scheme: light` pins
   it, and only a positively-declared light block can set that.
2. The dark media query's `:not()` merely **suppresses** the dark block on a
   light-themed root; nothing declares light tokens. So `<body class="light">`
   under OS-dark inherited the dark `--bg` straight from `:root`.

It is also the last of the four blocks, so source order favours light if a light
and a dark marker somehow end up on the same element.

## Specificity — the part that is easy to get wrong

All four alias blocks are held at specificity **0,1,0**. That is deliberate, and it
is what makes a consumer override work:

| Block | Selector | Specificity |
|---|---|---|
| light | `:root` | 0,1,0 |
| dark | `:root:not(:where([data-theme='light'], .light))` | 0,1,0 |
| dark-class | `[data-theme='dark'], .dark` | 0,1,0 |
| light-class | `[data-theme='light'], .light` | 0,1,0 |

At 0,1,0 a consumer's own rule *ties*, and a tie is broken by source order — their
file is imported after `achroma.css`, so they win:

```css
@import 'achroma/achroma.css';

.dark {
  --bg: var(--n-950);   /* wins: same specificity, later in the source */
}
```

### The bug this replaced

An earlier draft wrote the dark block as `:root:not([data-theme='light'])`.
`:not()` contributes the specificity of its most specific argument, so with both
exclusions that selector was **0,3,0** — it outranked a consumer's `.dark {}` at
0,1,0 and silently reverted their override.

The reason this is worth a section: it only did so **when the OS was in dark
mode**. Measured before the fix, a consumer setting `--bg` on `.dark` got *their*
value under OS-light and *ours* under OS-dark. A developer testing on a light
machine saw their override work perfectly and shipped. That is the worst available
way to be wrong, and no amount of eyeballing one machine would find it.

The fix is `:where()`, which contributes zero specificity to whatever it wraps.
`test/contrast.mjs` now rejects any `:not()` in the file whose argument is not
wrapped in `:where()`, and separately rejects any `:root`-prefixed class or
attribute block — `:root[data-theme='dark']` is 0,2,0 and would outrank a
consumer's bare `[data-theme='dark']` in *both* modes.

## Each mode is written twice, and both copies are load-bearing

There are four blocks for two modes, because the media query and the class serve
different consumers:

- the media query serves consumers that follow the OS;
- the class serves consumers with a toggle.

Neither can be derived from the other in CSS, so the values are duplicated: four
blocks of 18 aliases plus `--grain-opacity`.

`test/contrast.mjs` asserts that `dark` and `dark-class` are declaration-identical,
and likewise `light` and `light-class`. **Nothing else would catch them drifting.**
A stale copy renders perfectly — just in the wrong mode — and the contrast tables
read only the `light` and `dark` blocks, so they never look at the class blocks at
all. Verified: changing `--fg-dim` in the `dark-class` block alone left every
printed ratio byte-identical. The parity check is what fails.

## What a browser has to check

Specificity, `color-scheme` resolution and layer order are not visible in the
source, and four defects here rendered correctly on the machine they were written
on. `npm run test:cascade` drives whatever Chrome is installed over CDP and asserts
the 14-cell light/dark mode matrix, consumer-override precedence, Tailwind layer
order, the focus ring and the `prefers-*` queries.

Without a browser it prints a loud warning and exits 0. CI sets
`ACHROMA_REQUIRE_BROWSER=1`, which turns a missing Chrome into a failure — this is
the suite whose absence would be least noticeable, and a silent skip is
indistinguishable from a pass.
