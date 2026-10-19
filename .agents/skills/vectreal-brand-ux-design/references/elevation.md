# Elevation

Owner of: the `ds-*` ladder, the surface material, and when a surface is allowed
a shadow.

## The `ds-*` ladder

Every step is `color-mix(in oklch, var(--foreground) N%, var(--background))`, so
the whole ladder tracks the theme from one pair of tokens. Every step also
carries the surface material, below: the value says how high a surface sits,
the material makes it read as a plate in space.

- `ds-raised` (4%) — cards, table containers, anything sitting on the page
- `ds-overlay` (8%) — popovers, menus, rows hovered on top of raised
- `ds-sunken` (2.5%) — wells that should recede, such as code blocks
- `ds-field` — a form field's surface: 6% foreground over *whatever it sits
  on*, not mixed against the page, because fields sit on dialogs and shell
  panels too and `ds-sunken` cannot go below the page. `Input`, `Textarea` and
  `SelectTrigger` carry it themselves, with a transparent border that only
  `aria-invalid` colours: a field is identified by its surface, not a drawn
  box, so a call site adds neither. The exception is a field inside a block
  that is already its surface, such as the hotspot position input in a
  `shell-nested` block, which passes `bg-transparent` so the tint
  does not stack.
- `ds-divider` — only where a divider carries meaning, never to draw a box.
  Note it sets a **background-color**, not a border colour: it is the fill of a
  hairline *element*, so putting it on a row alongside `border-b` tints the whole
  row instead of its border. A border that needs a colour wants `border-border`.
- `ds-raised-interactive` / `ds-overlay-interactive` — hover lifts exactly one
  step. Use these rather than pairing a `ds-*` class with a hand-written hover
  background: call sites had drifted to 6%, 8%, 12% and 14%, so equivalent rows
  hovered to different values in the same view.

The ladder self-corrects when it nests, so a `Card` dropped onto a raised panel
still has an edge. Same-class nesting only, and the steps are:

| Nesting | Mix |
| --- | --- |
| `.ds-raised` | 4% |
| `.ds-raised .ds-raised` | 8% |
| `.ds-raised .ds-raised .ds-raised`, `.ds-overlay .ds-overlay` | 12% |
| `.ds-raised-interactive:hover` | 8% |
| `.ds-overlay-interactive:hover` | 12% |

That nesting rule is also how a component says "this one matters more" without
reaching for colour: `BasicCard`'s `highlight` puts `ds-raised` on the wrapper
and the card inside it resolves to 8%. It used to draw an orange bar instead.

`ds-divider` is the one step that does **not** mix against `--background`. It is
10% against `transparent`, because a hairline has to sit on whatever surface it
divides rather than punching a hole in it.

The ladder's own comment in `globals.css` states the intent: the system separates
surfaces by **value and light, not by outlines**. That is the reason to reach for a `ds-*`
step before adding a border, not a ban on borders — `ds-divider` is in the ladder
and the `ui/` primitives use borders where an edge carries meaning.

## The surface material

Decided by Moritz on 19 Oct 2026, after the "cards with depth" study of
github.com's backlit panels: surfaces get real depth, project wide, and the
depth comes from light rather than from outlines.

The light comes from above. So every rung's `box-shadow` is the same four
layers, read from the `--material-*` colours in `theme.css`:

| Layer | What it is | Token |
| --- | --- | --- |
| `inset 0 1px 0` | the bevel: the top edge catching light | `--material-bevel` |
| `inset 0 0 0 1px` | the rim: a hairline barely darker than the surface | `--material-rim` |
| `inset 0 -1px 0` | the base: the bottom edge, a touch darker | `--material-base` |
| outer shadows | what the plate throws: a tight contact shadow and a wide soft one | `--material-shadow`, `--material-shadow-far` |

- `ds-raised` and `ds-overlay` lift: all four layers, overlay's far shadow a
  little longer.
- `ds-sunken` and `ds-field` recede: shaded from the top edge inward, with the
  light catching the bottom lip instead. No outer shadow.
- `ds-raised-interactive` and `ds-overlay-interactive` carry only the edge at
  rest and take the thrown shadow on hover. They come in lists, and a column of
  forty shadows reads as noise; the shadow arriving is what makes the hover
  read as a lift.
- `ds-bevel` is a filled action's material (`Button`'s default, brand and
  destructive variants): a white bevel and a dark base, fixed values because
  the fill underneath is the same in both schemes.
- `ds-control` is a neutral control's (`Button`'s outline and secondary): the
  raised edge at button size, with its rim outside so it is the outline.
- `.shell-panel` already floats as glass; it takes the bevel.

Light mode keeps the rim faint and the shadow warm, so a plate reads as a
shadow on paper and not an ink outline. Dark mode's shadow is the page's own
black, deeper, because a dark surface separates from a darker page only by the
shade beneath it.

**The stack is written out in every rung.** A shared custom property composed at
`:root` would bake in the light colours, and a subtree that sets `.dark` on its
own (an embed, the viewer) would keep them.

**A surface class is a plate, not a tint.** Where a fill only needs the value -
table stripes, a group band in a table - write the mix as an arbitrary utility,
as `feature-compare-grid.tsx` does: the material on table rows rules every row
off.

**Utilities replace the material.** `shadow-*` and `ring-*` set `box-shadow`
from the utilities layer, which outranks the rungs. That is the escape hatch,
and why a field's focus ring still shows.

## Shadows

**Page surfaces take their shadow from the material.** A raw Tailwind
`shadow-*` on a `ds-*` surface replaces the material with a generic shadow and
is wrong on any new surface. Portalled overlays (dialogs, popovers, menus) keep
their larger `shadow-*`: they float over arbitrary content, and the plate's
shadow is sized for a surface sitting on the page.

There is no `--shadow-*` token scale beyond the material. Raw Tailwind
`shadow-sm` / `-md` / `-lg` / `-xl` survives at a few dozen call sites, almost
all in `shared/components/src/ui/` and the publisher. (A census is deliberately
not given here: the last one said 44 and was wrong within a month.)

`rounded-2xl shadow-lg p-6` is the untouched shadcn card default and is banned on
marketing surfaces by [anti-ai-look.md](anti-ai-look.md).

## Variants do not work on these classes

`hover:ds-overlay` silently emits nothing, and ESLint rejects it. The rule and
its reasoning are in [enforcement.md](enforcement.md); what belongs here is the
replacement:
`hover:bg-[color-mix(in_oklch,var(--foreground)_8%,var(--background))]`, the
arbitrary-utility form `routes/docs/index.tsx` uses. (`navigation-menu.tsx`
writes the same value as a `group-data-[…]` variant rather than a `hover:` one.)

```claims
present  shared/components/src/styles/theme.css                                --material-bevel
present  shared/components/src/styles/theme.css                                --material-shadow-far
present  shared/components/src/styles/globals.css                              .ds-bevel
present  shared/components/src/styles/globals.css                              .ds-control
present  shared/components/src/ui/button.tsx                                   ds-bevel
present  shared/components/src/styles/globals.css                              .ds-raised-interactive
present  shared/components/src/styles/globals.css                              .ds-overlay-interactive
present  shared/components/src/styles/globals.css                              .ds-divider
present  shared/components/src/styles/globals.css                              .ds-sunken
present  shared/components/src/styles/globals.css                              .ds-field
present  shared/components/src/ui/input.tsx                                    ds-field
present  shared/components/src/ui/textarea.tsx                                 ds-field
present  shared/components/src/ui/select.tsx                                   ds-field
absent   shared/components/src/ui/input.tsx                                    border-input
absent   shared/components/src/ui/textarea.tsx                                 border-input
absent   shared/components/src/ui/select.tsx                                   border-input
```
