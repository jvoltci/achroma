# Tailwind and shadcn

`achroma.tailwind.css` maps shadcn's semantic variable names onto Achroma tokens,
so Radix components inherit the system with no edits to their own files. It
declares no colour of its own — every value in it is an indirection.

Plain-CSS consumers do not need it. `achroma.css` alone is the whole system.

## What to import, and in what order

```css
@import 'tailwindcss';
@import 'achroma/achroma.css';
@import 'achroma/achroma.tailwind.css';
```

**Tailwind first.** This is not a style preference and it is not optional.

achroma's element defaults live in `@layer base`, and so does Tailwind's
preflight. Within a single layer, specificity ties are broken by **source order**,
and `h1` against `h1` is a tie — so whichever file is imported last wins. The
preflight's own rules are the collision:

```css
h1, h2, h3, h4, h5, h6 { font-size: inherit; font-weight: inherit }
b, strong { font-weight: bolder }
```

Get the order backwards and it **fails silently**. Nothing errors, no build
warning: headings render at the inherited body weight of 300, and `<strong>` at
400. Measured with achroma imported first: `h1` at weight 300 instead of 500,
`strong` at 400 instead of 500, `h1` at 15px instead of 30px.

Utilities are unaffected either way, because `@layer utilities` outranks
`@layer base` regardless of import order. It is only the element defaults that
flip.

!!! note "Why achroma's base rules are layered at all"

    Unlayered declarations outrank **every** layered one — layer order is compared
    before specificity. An unlayered `body { font-weight: 300 }` therefore defeated
    Tailwind's `font-bold`, and `m-4`, `bg-white` and `text-2xl` with it. The layer
    name must be exactly `base`, because Tailwind declares
    `@layer theme, base, components, utilities` and an unrecognised name like
    `achroma.base` is appended *after* utilities and fixes nothing. Verified both
    ways, and asserted by `test/contrast.mjs`.

    The `:root` token blocks stay deliberately unlayered: they define custom
    properties, which no utility competes for, and unlayered means a consumer needs
    no layer machinery to override them.

## The mapping

Every entry is a `var()` into an Achroma token. Nothing here is a literal.

### Surfaces

| shadcn | Achroma |
|---|---|
| `--color-background` | `--bg` |
| `--color-foreground` | `--fg` |
| `--color-card` | `--bg-raised` |
| `--color-card-foreground` | `--fg` |
| `--color-popover` | `--bg-raised` |
| `--color-popover-foreground` | `--fg` |

### Interaction

| shadcn | Achroma |
|---|---|
| `--color-primary` | `--fg` |
| `--color-primary-foreground` | `--bg` |
| `--color-secondary` | `--bg-sunken` |
| `--color-secondary-foreground` | `--fg` |
| `--color-muted` | `--bg-sunken` |
| `--color-muted-foreground` | `--fg-dim` |
| `--color-accent` | `--bg-sunken` |
| `--color-accent-foreground` | `--fg` |

`--color-primary: var(--fg)` is **the single line that makes a shadcn app
achromatic**. `--primary` is where shadcn's accent hue lived; here it is ink. A
filled primary button becomes `--fg` on `--bg`, which is why
`--color-primary-foreground` is the *background* rather than a light neutral —
inverting the pair is the whole treatment.

### Semantic

| shadcn | Achroma |
|---|---|
| `--color-destructive` | `--danger-text` |
| `--color-destructive-foreground` | `--n-0` |

shadcn has only `destructive`. `warn`, `ok` and `info` have no mapping here and
must be used through the Achroma tokens directly. Note that `destructive` maps to
`--danger-text`, the variant that clears 4.5:1; `--danger-line` would not.

`info` needs no mapping in practice: it is neutral, so `--color-muted-foreground`
already resolves to the same `--fg-dim` that `--info-text` does.

| shadcn / Tailwind | Achroma |
|---|---|
| `--color-scrim` | `--scrim` |

`--color-scrim` exists so you can replace shadcn's hardcoded `bg-black/50` overlay
with `bg-scrim` and get the per-mode value. **Do not also apply a `/50` modifier** —
`--scrim` already carries its own alpha, and Tailwind would override it and hand
back the light value in both modes.

### Lines and focus

| shadcn | Achroma |
|---|---|
| `--color-border` | `--hairline` |
| `--color-input` | `--rule` |
| `--color-ring` | `--ring` |

`border` gets the subtle hairline and `input` the stronger rule, because a form
control that reads as faintly as a divider is a usability problem rather than a
style choice. `--color-ring` points at the Achroma `--ring` token so an inked
surface can invert it locally — see
[the focus ring recipe](recipes.md#input-with-a-focus-ring).

### Sidebar

shadcn treats the sidebar as its own surface set:

| shadcn | Achroma |
|---|---|
| `--color-sidebar` | `--bg-sunken` |
| `--color-sidebar-foreground` | `--fg` |
| `--color-sidebar-primary` | `--fg` |
| `--color-sidebar-primary-foreground` | `--bg` |
| `--color-sidebar-accent` | `--bg-raised` |
| `--color-sidebar-accent-foreground` | `--fg` |
| `--color-sidebar-border` | `--hairline` |
| `--color-sidebar-ring` | `--ring` |

### Type and shape

| shadcn / Tailwind | Achroma |
|---|---|
| `--font-sans` | `--font-sans` |
| `--font-mono` | `--font-mono` |
| `--radius-sm` | `--r-sm` |
| `--radius-md` | `--r-md` |
| `--radius-lg` | `--r-lg` |
| `--radius-xl` | `--r-lg` |

`--radius-xl` collapses onto `--r-lg` (8px) on purpose: the radius scale is
near-sharp and stops there.

`--radius-full` is deliberately **not** mapped. Tailwind's own default is
`calc(infinity * 1px)`, which pills correctly at any height; achroma ships
`--r-full: 999px` instead because `calc()` infinity is outside this package's
browserslist floor. Overriding Tailwind's with ours would be a downgrade for no
gain — the two are indistinguishable below about 2000px.

### Elevation

All seven of Tailwind's shadow names are remapped, and the completeness is the
point:

| Tailwind | Achroma |
|---|---|
| `--shadow-2xs` | `--shadow-1` |
| `--shadow-xs` | `--shadow-1` |
| `--shadow-sm` | `--shadow-1` |
| `--shadow-md` | `--shadow-2` |
| `--shadow-lg` | `--shadow-2` |
| `--shadow-xl` | `--shadow-3` |
| `--shadow-2xl` | `--shadow-3` |

Tailwind ships **one** shadow scale for both modes. Because browsers composite in
gamma-encoded sRGB, the alpha that darkens the page by one ramp step is 0.023 in
light and 0.528 in dark — 23× apart — so any Tailwind default left unmapped is not
a subtler shadow in dark mode, it is **no shadow at all**. A single surviving
`shadow-2xl` would be the one flat card on the page. See
[Elevation](tokens.md#elevation) for the measurements.

Seven names collapse onto three levels because achroma has three, and that is lossy
on purpose: a fourth elevation level is a sign the layout needs fixing rather than
the shadow. shadcn reaches for `xs`, `sm`, `md` and `lg`.

One consequence worth knowing: Tailwind's `shadow-<color>` utilities will not
recolour these, because it cannot find a colour slot to substitute in a value it did
not generate. In an achromatic system that is the desired outcome.

The bridge uses `@theme inline`, and for shadows that is load-bearing rather than
stylistic. Without `inline`, Tailwind would emit `--shadow-md: var(--shadow-2)` onto
`:root`, where it would compute **once** against light's value and then never flip —
the same substitution trap that forces `--info-*` to be written out per block.

## The bridge is asserted, because a broken `var()` is silent

A `var()` aimed at a renamed or removed token resolves to the **empty string**.
The component then renders unstyled, in the browser, with no error anywhere —
nothing in the CSS pipeline warns about it. So `test/contrast.mjs` checks two
things about this file:

- every token it references is defined in `achroma.css`;
- it declares **no** literal colour — no `oklch()`, `rgb()`, `hsl()` or hex. A
  literal here would be a colour outside the ramp, invisible to every other check
  in the repo.

## What the bridge does not provide

**`--color-chart-1` … `--color-chart-5` are deliberately absent.**

A five-grey substitution would be the wrong answer rather than a partial one.
Series in an achromatic system cannot be told apart by hue, and five neutrals
close enough to sit on one background are not reliably distinguishable from **each
other** either — particularly in dark mode, where the usable lightness range is
compressed.

An achromatic chart needs a lightness ramp carrying at most three or four series,
plus a **non-colour channel** for the rest: dash pattern, fill texture, or direct
labelling instead of a legend. That is a data-visualisation problem with its own
constraints, and guessing at it here would leave a consumer with five muddy greys
and no legend they can read.

Until that is designed, charts keep their own colours. **Charts are content, not
interface** — the same carve-out that lets a highlighter be yellow. See
[colour is never decoration](index.md#colour-is-never-decoration).
