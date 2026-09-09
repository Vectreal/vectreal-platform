# Tokens

Owner of: brand color, radius, spacing rhythm, stacking tiers, viewport height,
page measure. Surfaces belong to [elevation.md](elevation.md).

Source of truth: `shared/components/src/styles/globals.css`.

## The three that are most often confused

| Want                                                      | Use                                                    | Never                                               |
| --------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| The brand color                                           | `--orange` (`#fc6c18`), or `bg-orange` / `text-orange` | `--accent`, `--primary`                             |
| Brand at partial alpha                                    | `rgb(var(--orange-rgb) / <alpha>)`                     | `hsl(var(--orange)/…)`, `color-mix` with `--orange` |
| Hover/focus background for menus, options, ghost controls | `--accent`                                             | a hand-picked gray                                  |

`--accent` is **not** the brand. It is the hover/focus background, near-white in
light mode and dark gray in dark mode. It used to point at `--orange`, which made
every dropdown item and ghost hover a solid brand block. `--primary` is not the
brand either.

`--orange` is a hex, so there is no valid inline alpha form.
`hsl(var(--orange)/0.14)` was tried once and silently killed a gradient for
months; `color-mix` degrades to solid brand orange where lightningcss emits its
no-alpha fallback. Use `--orange-rgb` and keep the two in sync.

The failure is not hypothetical and not only in gradients. `page-hero.tsx` shipped
with two decorative radial accents written `hsl(var(--orange)/0.14)`; the whole
`radial-gradient()` failed to parse, so every hero on the site rendered without
them, unnoticed, from the day the component was written.

## Do not declare a name twice

`--text-*`, `--tracking-*`, `--font-*`, `--space-*`, `--container-*` and
`--radius-*` are all Tailwind theme namespaces. Declaring the same name in both
`:root` and `@theme` makes it self-referential — that is what previously
collapsed every corner in the app to square.

The rule is one place per name, not "never `@theme`". A name that belongs in
`@theme`, because a utility should generate from it, goes there and only there.

The viewer package must not emit global theme tokens. `packages/viewer` owns a
separate `--vctrl-*` namespace scoped to `.viewer`, deliberately outside the app
theme, and resets `--radius-*` to `initial` so it cannot clobber a host app.

## Spacing rhythm

Four values, and a marketing page should need no others:

| Step | Class | Separates |
| --- | --- | --- |
| 16px | `mt-4` / `gap-4` | Lines inside one block |
| 32px | `mt-8` / `gap-8` | A heading from its content, blocks inside a section |
| 64px | `mt-16` | Two sections that belong together |
| 128px | `mt-32` | Two sections that do not |

The point is not the numbers, it is that there are four of them. Rhythm is what
a reader uses to tell "still the same idea" from "a new one", and a page using
nine spacing values has no rhythm to read - it has nine near-identical gaps that
each mean nothing. When a gap feels wrong, the answer is the next step up or
down, not a new value between them.

There is no `--space-*` token to reach for and there should not be. Spacing in
markup is Tailwind's numeric scale, derived from the `--spacing` multiplier.
`--space-4` and `--space-6` survive in `:root` only because `.container-page`
reads them for its gutter; `--space-*` is a real Tailwind namespace but it backs
`space-x-*` / `space-y-*`, so moving those two into `@theme` to "make them real"
would mint a second child-margin scale beside the derived one. Ten other rungs
were deleted for having no reader at all.

Page padding uses the same steps: the marketing routes close on `pb-32`, and
`PageHero` opens on `pt-32 pb-16` - more space above to clear the fixed nav than
below, where the hero joins the page it introduces.

## Radius

One knob, `--radius: 1rem`. The rest of the scale is derived in `@theme` so the
steps cannot drift apart.

Pair radius with padding. `--radius-2xl` is 28px, so a `rounded-2xl` panel padded
`p-4` crowds its content into the curve. Panels want `p-5` or more; `rounded-xl`
inner blocks are comfortable at `p-3`.

Uniform radius on every element, with identical padding, is a templated-design
tell; see [anti-ai-look.md](anti-ai-look.md).

## Stacking: the `--z-index-*` tiers

Named tiers in `globals.css`, each with a comment saying what belongs there. They
generate the matching utilities, so a call site names a layer instead of picking
a number.

| Tier               | Value | What sits there                                                                                         |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------------- |
| `z-page-chrome`    | 20    | Chrome owned by one route: the docs breadcrumb bar, the internal preview overlay, a sticky summary card |
| `z-nav`            | 50    | Site chrome fixed for the whole session: desktop and mobile nav, consent banner                         |
| `z-overlay`        | 50    | Radix's portal layer: dialog, alert dialog, sheet, drawer, menus, popovers, hover cards                 |
| `z-above-nav`      | 60    | Must cover the nav: the route loading bar, an embed viewer gone fullscreen                              |
| `z-tooltip`        | 80    | Tooltips, above the overlay layer so they still show inside a dialog                                    |
| `z-overlay-raised` | 100   | One overlay that has to clear another                                                                   |
| `z-select`         | 120   | The select listbox, top of the ladder                                                                   |

The nav and the overlay layer tie at 50 deliberately. Both land in the root
stacking context, and Radix portals its overlays to the end of the document body,
so the tie resolves in their favor. That is also why the publisher shell keeps
every surface of its own below 50, in its own ladder in `shell-layout.ts`: at or
above it they paint over confirmation modals.

Below 50 is component-local ordering and stays a plain number. Giving it a tier
name would claim a relationship with the site chrome that it does not have.

## Viewport height

Size full-viewport surfaces with `h-dvh` / `min-h-dvh`, or `h-svh` where a shell
owns the height and scrolls its own content, as `dashboard-layout.tsx` does.

Never Tailwind's screen-height utilities. They compile to `100vh`, the *large*
viewport, which overhangs persistent mobile browser chrome: bottom-anchored UI
goes behind the bar and the page is left scrolled with no way back when a canvas
holds `touch-action: none`.

## Page measure

`.container-page` owns the page width and its gutter together: `--container-max`
(80rem) with `padding-inline` stepping up at 48rem.

The gutter belongs to the measure, not to the caller. `max-w-7xl` was hardcoded
at fifteen sites, each choosing its own padding, so a hero at `px-6` sat above a
body at `px-4` and the content jogged sideways at the seam.

`--container-*` names declared in an `@theme` block are a two-file agreement:
`CONTAINER_SCALE` in `shared/utils/src/lib/styling.utils.ts` must list exactly
the same keys, and `container-scale.spec.ts` fails when they disagree. Adding a
container token is therefore never a CSS-only change.

```claims
present  shared/components/src/styles/globals.css                              --radius: 1rem
present  shared/components/src/styles/globals.css                              --z-index-nav: 50
present  shared/components/src/styles/globals.css                              --z-index-overlay: 50
present  shared/components/src/styles/globals.css                              --z-index-above-nav: 60
present  shared/components/src/styles/globals.css                              --z-index-select: 120
present  shared/components/src/styles/globals.css                              max-width: var(--container-max);
present  apps/vectreal-platform/app/routes/layouts/dashboard-layout.tsx        h-svh
present  shared/utils/src/lib/styling.utils.ts                                 CONTAINER_SCALE
```
