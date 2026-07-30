# Recipes

Copy-paste blocks, each the minimum that works. Every value is a token — a
hardcoded colour, size or duration in any of these would be a finding.

## Card on a raised surface

```css
.card {
  background: var(--bg-raised);
  border: 1px solid var(--hairline);
  border-radius: var(--r-md);
  padding: var(--s-5);
}
```

Depth comes from tone and a hairline, not a shadow. The border is what defines the
edge; the tonal step is deliberately slight — `--n-25` to `--n-0` in light,
`--n-900` to `--n-850` in dark. A sunken variant is one declaration:

```css
.card.sunken {
  background: var(--bg-sunken);
}
```

## Filled ink button, and its hover

```css
button {
  font: inherit;
  font-size: var(--text-sm);
  background: transparent;
  color: var(--fg-dim);
  border: 1px solid var(--rule);
  border-radius: var(--r-sm);
  padding: var(--s-2) var(--s-3);
  cursor: pointer;
  transition:
    color var(--dur-1) var(--ease-out),
    border-color var(--dur-1) var(--ease-out),
    transform var(--dur-1) var(--ease-spring);
}

button:hover {
  color: var(--fg);
  border-color: var(--fg);
  transform: translateY(-1px);
}

button.filled {
  background: var(--fg);
  color: var(--bg);
  border-color: var(--fg);
  font-weight: var(--w-medium);
}
```

The hover moves `--fg-dim` to `--fg` and the border from `--rule` to `--fg`. With
no hue to shift, the state change has to be carried by tone, weight and 1px of
`translateY`.

The durations are tokens, so `prefers-reduced-motion: reduce` zeroes all three
transitions without this block knowing about it.

## Input with a focus ring

```css
input[type='text'],
select {
  font: inherit;
  font-size: var(--text-sm);
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--rule);
  border-radius: var(--r-sm);
  padding: var(--s-2) var(--s-3);
  width: 100%;
}
```

The ring itself already ships, on everything:

```css
:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

`--ring` is `var(--fg)` in both modes. It is a separate token rather than `--fg`
used directly for exactly one reason:

!!! warning "A filled ink element must set `--ring` locally"

    `--ring` is `--fg`, and a filled button's background is *also* `--fg`. The ring
    is therefore ink on ink — invisible. One declaration fixes it:

    ```css
    button.filled,
    .inverted {
      --ring: var(--bg);
    }
    ```

    Nothing errors. The element still takes focus, screen readers still announce
    it, and the only symptom is that keyboard users cannot see where they are.

### Inside `overflow: hidden`

`outline-offset: 2px` draws the ring outside the border box, and outlines are
clipped by an ancestor's overflow clip. A full-width item inside
`overflow: hidden` therefore loses its ring on the left and right edges entirely —
shadcn's `DropdownMenuItem`, `SelectItem`, `CommandItem` and `Card` are all this
shape.

The escape hatch is a negative offset, which draws the ring **inside** the box:

```css
.menu-item:focus-visible {
  outline-offset: -2px;
}
```

## Hairline-separated list

```css
.list {
  border-top: 1px solid var(--hairline);
}

.list div {
  display: flex;
  justify-content: space-between;
  gap: var(--s-4);
  padding: var(--s-3) 0;
  border-bottom: 1px solid var(--hairline);
  font-size: var(--text-sm);
}

.list div span:last-child {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--fg-faint);
}
```

Structure as the only ornament. `--hairline` clears its 1.15:1 visibility floor
and nothing more, so the rows read as separated without the lines becoming the
subject.

## The micro-label

`.label` ships in `achroma.css`, so this is markup only:

```html
<p class="label">Token reference</p>
```

It is the other half of the type signature — tiny, wide, uppercase, mono — and it
is what sits opposite the huge-and-thin display treatment:

```css
.label {
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  font-weight: var(--w-medium);
  letter-spacing: var(--track-label);
  text-transform: uppercase;
  color: var(--fg-faint);
}
```

`--fg-faint` holds 3:1, not 4.5:1, which is the reason this is a label and not a
paragraph. Do not use it for body copy.

## Grain overlay

`.grain` ships too. One fixed element, no JavaScript, as the **last child of
`body`**:

```html
<body>
  …
  <div class="grain" aria-hidden="true"></div>
</body>
```

This is what makes an achromatic surface read as material rather than flat. It
paints at `--grain-opacity` — `0.10` light, `0.07` dark — and it hides itself under
`prefers-reduced-transparency: reduce`, `prefers-contrast: more` and `print`.

Raising the opacity has an accessibility ceiling, because the overlay composites
over text as well as background:
[`--grain-opacity`](tokens.md#-grain-opacity).

## Semantic callout

The three-token set, used as designed — `-bg` behind, `-line` on the border,
`-text` for the copy:

```css
.note {
  padding: var(--s-3) var(--s-4);
  border: 1px solid;
  border-left-width: 3px;
  border-radius: var(--r-sm);
  font-size: var(--text-sm);
}

.note.ok {
  border-color: var(--ok-line);
  background: var(--ok-bg);
  color: var(--ok-text);
}

.note.warn {
  border-color: var(--warn-line);
  background: var(--warn-bg);
  color: var(--warn-text);
}

.note.danger {
  border-color: var(--danger-line);
  background: var(--danger-bg);
  color: var(--danger-text);
}
```

`border: 1px solid` with no colour, then `border-color` per state, means the shape
is declared once. Swapping `-text` for `-line` on the `color` line is the mistake
this split exists to prevent: `--warn-line` on `--warn-bg` has no asserted target
and would not clear 4.5:1.

Both modes are covered without a second block — the tokens flip themselves.

## The wash opt-in

```css
body {
  background-image: var(--wash);
}
```

A single top-light gradient, one ramp step, fading out by 55% of the viewport. It
is not applied by default: a design system should not decide that every consumer's
page has atmosphere.

It changes `--bg` locally, so it compresses contrast where it is strongest, and
`test/contrast.mjs` cannot see it. The measured cost is 0.30 on dark `--fg-dim`
against a 4.5 floor — the numbers are in
[`--wash`](tokens.md#-wash). If you deepen the gradient beyond the shipped
single ramp step, re-measure from painted pixels; nothing in the repo will fail for
you.
