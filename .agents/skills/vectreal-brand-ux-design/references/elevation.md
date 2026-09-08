# Elevation

Owner of: the `ds-*` ladder, and when a surface is allowed a shadow.

## The `ds-*` ladder

Derived from one `--foreground` mix, so it tracks the theme automatically.

- `ds-raised` (4%) — cards, table containers, anything sitting on the page
- `ds-overlay` (8%) — popovers, menus, rows hovered on top of raised
- `ds-sunken` (2.5%) — wells and inputs that should recede
- `ds-divider` — only where a divider carries meaning, never to draw a box.
  Note it sets a **background-color**, not a border colour: it is the fill of a
  hairline *element*, so putting it on a row alongside `border-b` tints the whole
  row instead of its border. A border that needs a colour wants `border-border`.
- `ds-raised-interactive` / `ds-overlay-interactive` — hover lifts exactly one
  step. Use these rather than pairing a `ds-*` class with a hand-written hover
  background: call sites had drifted to 6%, 8%, 12% and 14%, so equivalent rows
  hovered to different values in the same view.

The ladder self-corrects when it nests: raised inside raised steps up on its own,
so a `Card` dropped onto a raised panel still has an edge. Same-class nesting
only.

The ladder's own comment in `globals.css` states the intent: the system separates
surfaces by **value, not by outlines**. That is the reason to reach for a `ds-*`
step before adding a border, not a ban on borders — `ds-divider` is in the ladder
and the `ui/` primitives use borders where an edge carries meaning.

## Shadows

**Page surfaces use the ladder. Only portalled overlays carry a shadow.**

The `ds-*` ladder exists to replace shadow with value-mixing, and a shadow on a
raised card is the ladder plus a second, contradictory depth cue. Overlays are
the legitimate exception: a dialog or popover floats over arbitrary content and
value alone does not separate it.

There is no `--shadow-*` token scale. Roughly 44 call sites use raw Tailwind
`shadow-sm` / `-md` / `-lg` / `-xl`, almost all in `shared/components/src/ui/`
and the publisher. Introducing a scale is a filed catalogue row, not a thing to
do in passing — but the rule above governs any *new* surface today.

`rounded-2xl shadow-lg p-6` is the untouched shadcn card default and is banned on
marketing surfaces by [anti-ai-look.md](anti-ai-look.md).

## Variants do not work on these classes

`hover:ds-overlay` silently emits nothing, and ESLint rejects it. The rule and
its reasoning are in [enforcement.md](enforcement.md); what belongs here is the
replacement:
`hover:bg-[color-mix(in_oklch,var(--foreground)_8%,var(--background))]`, the
arbitrary-utility form `navigation-menu.tsx` uses.

```claims
present  shared/components/src/styles/globals.css                              .ds-raised-interactive
present  shared/components/src/styles/globals.css                              .ds-overlay-interactive
present  shared/components/src/styles/globals.css                              .ds-divider
present  shared/components/src/styles/globals.css                              .ds-sunken
```
