---
name: vectreal-brand-ux-design
description: 'Use for any change a user can see in Vectreal: component styling, layout, spacing, color, typography, elevation, motion, empty/loading/error states, responsive behavior, accessibility, and marketing UI. Triggers: design, styling, className, Tailwind, token, theme, dark mode, color, typography, type scale, spacing, elevation, surface, card, motion, animation, transition, responsive, mobile, accessibility, focus, contrast, empty state, loading state.'
---

# Vectreal Brand UX Design

## Tokens: the three that are most often confused

| Want | Use | Never |
| --- | --- | --- |
| The brand color | `--orange` (`#fc6c18`), or `bg-orange` / `text-orange` | `--accent`, `--primary` |
| Brand at partial alpha | `rgb(var(--orange-rgb) / <alpha>)` | `hsl(var(--orange)/…)`, `color-mix` with `--orange` |
| Hover/focus background for menus, options, ghost controls | `--accent` | a hand-picked gray |

`--accent` is **not** the brand. It is the hover/focus background, near-white in
light mode and dark gray in dark mode. It used to point at `--orange`, which made
every dropdown item and ghost hover a solid brand block. `--primary` is not the
brand either.

`--orange` is a hex, so there is no valid inline alpha form. `hsl(var(--orange)/0.14)`
was tried once and silently killed a gradient for months; `color-mix` degrades to
solid brand orange where lightningcss emits its no-alpha fallback. Use
`--orange-rgb` and keep the two in sync.

Do not declare the same Tailwind theme key in both `:root` and `@theme`. The
viewer package must not emit global theme tokens.

## Elevation: the `ds-*` ladder

Derived from one `--foreground` mix, so it tracks the theme automatically.

- `ds-raised` (4%) - cards, table containers, anything sitting on the page
- `ds-overlay` (8%) - popovers, menus, rows hovered on top of raised
- `ds-sunken` (2.5%) - wells and inputs that should recede
- `ds-divider` - only where a divider carries meaning, never to draw a box
- `ds-raised-interactive` / `ds-overlay-interactive` - hover lifts exactly one
  step. Use these rather than pairing a `ds-*` class with a hand-written hover
  background: call sites had drifted to 6%, 8%, 12% and 14%, so equivalent rows
  hovered to different values in the same view.

The ladder self-corrects when it nests: raised inside raised steps up on its own,
so a `Card` dropped onto a raised panel still has an edge. Same-class nesting
only.

## Type scale

`text-eyebrow`, `text-display`, `text-headline`, `text-h2`, `text-h3`, `text-h4`,
`text-stat`, `text-body-lg`, `text-label-xs`. These are the single source of
truth. Setting `style={{ fontSize: 'var(--text-headline)' }}` gets the size and
none of the weight, tracking or leading, which is why `text-headline` exists.

## Stacking: the `--z-index-*` tiers

Named tiers in `globals.css`, each with a comment saying what belongs there.
They generate the matching utilities, so a call site names a layer instead of
picking a number.

| Tier | Value | What sits there |
| --- | --- | --- |
| `z-page-chrome` | 20 | Chrome owned by one route: the docs breadcrumb bar, the internal preview overlay, a sticky summary card |
| `z-nav` | 50 | Site chrome fixed for the whole session: desktop and mobile nav, consent banner |
| `z-overlay` | 50 | Radix's portal layer: dialog, alert dialog, sheet, drawer, menus, popovers, hover cards |
| `z-above-nav` | 60 | Must cover the nav: the route loading bar, an embed viewer gone fullscreen |
| `z-tooltip` | 80 | Tooltips, above the overlay layer so they still show inside a dialog |
| `z-overlay-raised` | 100 | One overlay that has to clear another |
| `z-select` | 120 | The select listbox, top of the ladder |

The nav and the overlay layer tie at 50 deliberately. Both land in the root
stacking context, and Radix portals its overlays to the end of the document
body, so the tie resolves in their favor. That is also why the publisher shell
keeps every surface of its own below 50, in its own ladder in
`shell-layout.ts`: at or above it they paint over confirmation modals.

Below 50 is component-local ordering and stays a plain number. Giving it a tier
name would claim a relationship with the site chrome that it does not have.

## Motion

Durations: `--duration-instant` 80ms, `--duration-fast` 150ms, `--duration-base`
250ms, `--duration-slow` 400ms, `--duration-cinematic` 700ms.
Easing: `--ease-out`, `--ease-in-out`, `--ease-spring`.

Motion communicates state change, focus shift, and hierarchy. Respect
`prefers-reduced-motion`. Do not animate to decorate.

## Rules already enforced by ESLint

`eslint.config.mts` fails the build on these, so read the message rather than
guessing. Each rule carries a comment explaining the failure it prevents.

1. **Tailwind variants on `ds-*` or `text-*` classes.** They live in
   `@layer components` and are not registered utilities, so a variant attaches to
   nothing and Tailwind emits no rule at all. It fails silently. Use an arbitrary
   utility instead.
2. **Raw hex in a Tailwind arbitrary value.** Use a token. Where a literal is
   genuinely correct, such as depicting someone else's interface, hoist it to a
   named constant with a comment saying why.
3. **`className` built by template literal or `+`.** Use `cn()`. It merges
   conflicting Tailwind classes so a caller can override a default, and drops
   falsy values instead of rendering `undefined` as a class. Pass the parts as
   separate arguments; pre-joining them inside `cn()` defeats it.
4. **Inline `<svg>`.** Extract to `shared/components/src/assets/icons` as a named
   component. A component that exists to draw a graphic rather than an icon
   disables the rule on the line with a reason.
5. **A z-index at or above 50, and every escape hatch below it.** 50 is where
   the site nav and Radix's portal layer live, in the root stacking context, so
   a number there is competing with them and needs a tier name. Tailwind v4
   spells the escape hatch three ways and all three are rejected: the bracket,
   the `z-` custom-property shorthand in parentheses, and a leading `!`.
   This is the rule the route loading bar needed: it and the header were both
   fixed to the top of the viewport at 50, nothing recorded that they
   overlapped, and DOM order decided the bar painted underneath, on every
   navigation.

## Viewport height

Size full-viewport surfaces with `h-dvh` / `min-h-dvh`, or `h-svh` where a shell
owns the height and scrolls its own content, as `dashboard-layout.tsx` does.

Never Tailwind's screen-height utilities. They compile to `100vh`, the *large*
viewport, which overhangs persistent mobile browser chrome: bottom-anchored UI
goes behind the bar and the page is left scrolled with no way back when a canvas
holds `touch-action: none`.

## Tailwind scans more than markup

`globals.css` declares `@source '../../../../'`, the repository root, so any
string that looks like a utility is compiled into the bundle whether or not it
was ever meant to render.

Specs, config files and markdown are excluded, so prose in this file and in a
README costs nothing. Comments and strings inside `.ts` and `.tsx` are still
scanned, and cannot be excluded, because those files also hold the real markup.
A JSDoc example, a commented-out block of JSX, and plain English both ways: the
word "ordinal" in a sentence about clip ids compiles to Tailwind's `ordinal`
utility. Roughly fifteen rules in the bundle today come from comments alone.

So the rule survives where it still bites: do not name a utility in a code
comment unless the file actually uses it.

## Verify in a browser, not in your head

Design changes close with a screenshot, not a claim. Use the preview tools:
`preview_start` with `{name: "vectreal-platform"}`, then `read_page`,
`resize_window` for responsive and dark mode, and `computer` for a screenshot.
The quality bar for marketing UI is high, and the only way to know a gradient,
a hover step or a snap point survived is to look at it.

## Anti-patterns

| Anti-pattern | Replacement |
| --- | --- |
| `--accent` or `--primary` used to mean "brand" | `--orange` / `bg-orange` / `text-orange` |
| Alpha applied to `--orange` inline | `rgb(var(--orange-rgb) / <alpha>)` |
| Hand-written hover background beside a `ds-*` class | `ds-raised-interactive` / `ds-overlay-interactive` |
| Font size set inline from a `--text-*` token | The matching `text-*` class |
| Loading, empty and error states added last | Designed with the happy path |
| Accessibility retrofitted after review | Keyboard, focus ring, contrast, labels from the start |

## Source of truth

- `shared/components/src/styles/globals.css` (read the comments; several record
  an afternoon someone already lost)
- `shared/components/src/ui/`
- `eslint.config.mts`, the `no-restricted-syntax` block
- `apps/vectreal-platform/app/components/`

## Verified claims

Executed by `apps/vectreal-platform/tests/documented-claims.spec.ts` on every
CI run. The `absent` line is the load-bearing one: it fails the build the day
someone points `--accent` back at the brand.

```claims
present  shared/components/src/styles/globals.css                              --orange: #fc6c18
present  shared/components/src/styles/globals.css                              --orange-rgb: 252 108 24
absent   shared/components/src/styles/globals.css                              --accent: var(--orange)
present  shared/components/src/styles/globals.css                              --duration-fast: 150ms
present  shared/components/src/styles/globals.css                              --duration-cinematic: 700ms
present  shared/components/src/styles/globals.css                              .ds-raised-interactive
present  shared/components/src/styles/globals.css                              .ds-overlay-interactive
present  shared/components/src/styles/globals.css                              .ds-divider
present  shared/components/src/styles/globals.css                              .text-headline
present  shared/components/src/styles/globals.css                              @source '../../../../'
present  shared/components/src/styles/globals.css                              @source not '../../../../**/*.md'
present  shared/utils/src/lib/styling.utils.ts                                 extendTailwindMerge
present  shared/components/src/styles/globals.css                              --z-index-nav: 50
present  shared/components/src/styles/globals.css                              --z-index-overlay: 50
present  shared/components/src/styles/globals.css                              --z-index-above-nav: 60
present  shared/components/src/styles/globals.css                              --z-index-select: 120
present  eslint.config.mts                                                     z-index outside the named scale
exists   apps/vectreal-platform/tests/documented-claims.spec.ts
present  eslint.config.mts                                                     Build className with cn()
present  eslint.config.mts                                                     Inline SVG
present  apps/vectreal-platform/app/routes/layouts/dashboard-layout.tsx        h-svh
```
