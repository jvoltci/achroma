# Components

The essentials, in a separate optional file.

```css
@import 'achroma/achroma.css';
@import 'achroma/achroma.components.css';
```

## Why a separate file

`achroma.css` is a token spine, and its value is that it fights nobody. A shadcn,
MUI or Mantine consumer wants the tokens and already owns their components —
shipping buttons and tables inside the core file would force that CSS on everyone
to serve the plain-HTML case. So this is opt-in, exactly like
[the Tailwind bridge](tailwind.md).

## The layer name is load-bearing

The file opens `@layer components`, and that name is not cosmetic. Tailwind
declares `@layer theme, base, components, utilities`, so `components` lands **below
utilities** — which is the direction you want: `px-6` must beat `.ac-btn`'s own
padding, or utilities are useless on our components.

An unrecognised layer name is appended *after* utilities and silently inverts that,
so `test/contrast.mjs` asserts the layer opens correctly.

## What is deliberately absent

**Dialog, dropdown, tabs, tooltip, accordion, popover, toast.**

Every one of them needs focus trapping, ARIA wiring and keyboard handling to be
correct. CSS alone produces a component that looks right in a screenshot and is
unusable with a keyboard, which is worse than shipping nothing — it looks finished.

Use Radix or shadcn for those and let the tokens style them. That is what
`achroma.tailwind.css` exists for.

## Buttons

```html
<a class="ac-btn ac-btn-fill" href="/start">Get started</a>
<button class="ac-btn">Read the docs</button>
<button class="ac-btn ac-btn-ink">No hue at all</button>
<button class="ac-btn ac-btn-ghost ac-btn-sm">Cancel</button>
```

| Class | What it is |
|---|---|
| `.ac-btn` | Outlined, `--fg-dim` on transparent. The default. |
| `.ac-btn-fill` | The primary action — `--accent-fill` with white ink at 5.98:1. |
| `.ac-btn-ink` | The all-achromatic filled button: `--fg` on `--bg`. |
| `.ac-btn-ghost` | No border until hover. For toolbars and icon rows. |
| `.ac-btn-sm` | `--text-xs`, tighter padding. |

Three details that are not obvious:

- **`line-height: 1` is required.** `font: inherit` pulls `--lh-body` of 1.6 out of
  body, which makes the button ~40% taller than its padding implies and misaligns
  it against any input beside it. Padding sets the height.
- **`text-decoration: none` is required** now that `achroma.css` underlines every
  `<a>`. Without it, `<a class="ac-btn">` gets a line through it — and an anchor is
  the *common* case, because a button that navigates should be an anchor.
- **Hover on `.ac-btn-fill` escalates the shadow**, not the fill. There is no
  `--accent-fill-hover` token, and adding one means a second measured value per
  mode. One elevation step reads as "this lifts toward you" and costs nothing.

Disabled covers `:disabled`, `[disabled]` and `[aria-disabled='true']`, because
`:disabled` does not match an anchor and frameworks disagree about which they set.

## Fields

```html
<input class="ac-field" placeholder="you@example.com">
<select class="ac-field"><option>Choose a plan</option></select>
<textarea class="ac-field"></textarea>
```

`--rule` for the border and not `--hairline`: 1.56:1 against 1.21:1 in light. A
control that reads as faintly as a divider is a usability problem, not a style
choice.

`select` gets no custom arrow. A hand-drawn caret is where a control stops matching
the platform and starts feeling wrong.

## Cards

```html
<div class="ac-card ac-card-float">…</div>
<div class="ac-card ac-card-sunken">…</div>
```

**The hairline is mandatory, and that is a measurement rather than taste.**
`--bg-raised` on `--bg` is 1.044:1 in light mode — below the 1.15:1 floor the suite
sets for a purely decorative line. Without a border or a shadow, a light-mode card
has no edge at all. See [Elevation](tokens.md#elevation).

`.ac-card-float` adds `--shadow-2`, which is what carries the edge in light mode
where the tonal step cannot. The hairline stays for dark, where shadow has only
about two ramp steps of room below `--bg`.

## Notes and badges

```html
<div class="ac-note ac-note-accent">Affordance.</div>
<div class="ac-note ac-note-danger">This failed.</div>
<span class="ac-badge ac-badge-ok">Pass</span>
```

Variants: `-accent`, `-danger`, `-warn`, `-ok`, `-info`. Each sets exactly three
tokens and nothing else, which is the entire point of the `-text`/`-line`/`-bg`
split — one token cannot clear 4.5:1 as text *and* 3:1 as a border.

Badges are the `.ac-label` treatment in a pill: mono, uppercase, tracked out. That
is what makes a badge read as part of the type system rather than as a widget.

## Table

```html
<table class="ac-table">
  <thead><tr><th>Token group</th><th class="ac-num">Ratio</th></tr></thead>
  <tbody><tr><td>Aliases</td><td class="ac-num">19.27</td></tr></tbody>
</table>
```

`--rule` under the head, `--hairline` between rows. The head is a stronger boundary
than a row division, and using one weight for both is exactly why default tables
read as a grid of boxes.

`.ac-num` gives a cell the mono face, right alignment and `tabular-nums`. Without
tabular figures, digits change width between rows and a correctly aligned column
still looks ragged.

## Meter

```html
<div class="ac-meter"><i style="width:62%"></i></div>
```

A plain `div`, not `<progress>`: `<progress>` cannot be styled consistently across
engines without `appearance: none` plus three vendor pseudo-elements, and it
carries an implicit role you do not always want. Add `role="progressbar"` and
`aria-valuenow` yourself when it genuinely is one.

## Links

`achroma.css` already makes every `<a>` achromatic and underlined, which is the
correct default because it works with no accent at all.

`.ac-link` adds the accent, for the links that *are* the point of the page — a nav
item, a call to action in prose.

**The underline stays either way.** Colour is an addition to the affordance, never a
replacement for it (WCAG 1.4.1), and it is what keeps the link legible for anyone
who cannot separate indigo from ink.

## Layout

```html
<div class="ac-container">
  <div class="ac-stack" style="--ac-gap: var(--s-6)">…</div>
  <div class="ac-cluster">…</div>
</div>
```

| Class | What it does | Knob |
|---|---|---|
| `.ac-container` | Centred, max-width, gutters | `--ac-container` (70rem) |
| `.ac-stack` | Vertical rhythm between siblings | `--ac-gap` (`--s-4`) |
| `.ac-cluster` | Horizontal wrap-and-gap row | `--ac-gap` (`--s-3`) |

These exist because `proof.html` invented `max-width: 70rem` in its own `<style>`
and site six would have invented a different number.

`.ac-stack` uses the owl selector, `> * + *`, so the margin never lands on the first
or last child and a stack cannot add a stray edge to whatever contains it.

## Prose

```html
<article class="ac-prose">…rendered markdown…</article>
```

For CMS and markdown output where you do not control the markup and cannot add a
class per element.

The measure is **68ch, not a rem width**. What matters for readability is characters
per line — 45 to 75 is the range — and `ch` tracks the font, so 68 stays inside it
at every `--text-*` size. A fixed rem width does not.

`blockquote` gets an accent left rail: the one flash of hue in a wall of text, at
exactly the place a reader's eye should be pulled. No italics — Geist's oblique is
synthesised, and a synthesised slant on a 300 weight looks like a rendering bug.
