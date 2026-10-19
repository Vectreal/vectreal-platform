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
- `ds-ghost-interactive` — a row with no plate until it is pointed at, focused,
  or current (`aria-current="page"`, `aria-expanded="true"`): nav links, nav
  panel links, drawer rows. It then stands up as a small plate one step above
  whatever it sits on. Its fill is a tint, not a step, because the same row
  sits on the nav bar, in an overlay panel and on a sheet. The states are in
  the rung itself because a variant cannot apply a `ds-*` class; a row that
  is current for another reason is not yet covered.

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

On a plate (`ds-raised`, `ds-overlay` and their interactive rungs) the rim and
base read through `--material-plate-rim` and `--material-plate-lip`, which
default to the rim and base. The public site (`nav-layout`) sets
`data-material="object"`, which turns both off: there a plate is an object lit
from above, its edge the bevel and the shadow beneath. Moritz decided this on
19 Oct 2026 after a design review found the four-sided rim made marketing
plates read as boxes. Fields, controls and wells keep their rim everywhere,
since an input without an edge cannot be found.

Objects, not containers, on the public site: a plate is for something the
reader uses or that stands for the product (the app window, the browser mock,
a pricing plan). Copy, lists of names and step labels sit on the page.

- `ds-raised` and `ds-overlay` lift: all four layers, overlay's far shadow a
  little longer.
- `ds-sunken` and `ds-field` recede: shaded from the top edge inward, with the
  light catching the bottom lip instead. No outer shadow.
- `ds-raised-interactive` and `ds-overlay-interactive` rest as the plate of
  their static rung, shadow included, and throw the next rung's longer shadow
  on hover. Resting equal matters: tiles drop to the static class while
  disabled mid-action, and a tile that lost or gained a shadow on disabling
  would read as hovered. A call site with its own `transition-[...]` utility
  lists `box-shadow` in it, or the lift snaps while the fill eases.
- `ds-ghost-interactive` has no material at rest and takes the raised edge
  (bevel, rim, a 1px shadow) when it stands up: small enough for a nav row,
  without the far shadow a card throws.
- A shared component that forces its own fill with `!` (`TabsTrigger`'s
  active state) beats any ladder class on the same element. Put the plate on
  a parent and let the trigger fill it transparently, as the home page's
  product window does with its step tiles.
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

**A surface class is a plate. A tint has its own word.** `ds-tint-sunken`,
`ds-tint-raised` and `ds-tint-overlay` are the same values with no material, for
fills that are not plates: a progress track, table stripes, a thumbnail's
placeholder running edge to edge in a card, a list inside a popover that
already throws its own shadow. On those the material draws lines where none
belong. The question at a call site is whether the thing stands on the page
(plate) or colours an area inside something that does (tint).

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
present  shared/components/src/styles/globals.css                              .ds-tint-sunken
present  shared/components/src/ui/button.tsx                                   ds-bevel
present  shared/components/src/styles/globals.css                              .ds-raised-interactive
present  shared/components/src/styles/globals.css                              .ds-overlay-interactive
present  shared/components/src/styles/globals.css                              .ds-ghost-interactive
present  shared/components/src/styles/theme.css                                --material-plate-rim
present  shared/components/src/styles/theme.css                                [data-material='object']
present  apps/vectreal-platform/app/routes/layouts/nav-layout.tsx               data-material="object"
present  apps/vectreal-platform/app/components/navigation/nav-panels.tsx       ds-ghost-interactive
absent   apps/vectreal-platform/app/components/navigation/nav-panels.tsx       hover:bg-accent
absent   apps/vectreal-platform/app/components/navigation/mobile-nav.tsx       bg-accent
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
