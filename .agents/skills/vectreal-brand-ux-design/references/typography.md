# Typography

Owner of: the type scale, the faces, and tooltip copy length.

## The scale is the single source of truth

`text-eyebrow`, `text-display`, `text-headline`, `text-h2`, `text-h3`,
`text-h4`, `text-stat`, `text-body-lg`, `text-label-xs`.

Each class carries size, weight, tracking and leading together. Setting
`style={{ fontSize: 'var(--text-headline)' }}` gets the size and none of the
rest, which is exactly why `.text-headline` exists: two call sites reached for
the inline form and got an unweighted, untracked heading.

`--text-display` is `clamp(2.75rem, 6.4vw, 5.5rem)` at `-0.038em`, and the rungs
below it are fluid too, so most sizing happens without breakpoints. A component
reaching for `text-4xl md:text-6xl` is re-deriving a rung by hand and will drift
from it.

`--text-h4` is fixed rather than fluid on purpose: it labels sections inside
panels of a fixed width, so it should not track the viewport the way page
headings do.

### Known gap

There is no plain body rung. Ordinary copy falls through to Tailwind's
`text-sm` / `text-base`, and the ladder jumps from `--text-body-lg` (18px) to
`--text-label-xs` (11px) with nothing between. Marketing surfaces hand-roll
`text-base leading-relaxed md:text-lg` to fill it.

## Faces

**Body and all product UI: DM Sans Variable**, loaded through
`@fontsource-variable/dm-sans` with the optical-size axis, and applied at `html`
with `font-optical-sizing: auto`. `--font-sans` is declared once, in
`@theme inline`. Two places restate the literal stack instead of reading it, each
for its own reason: `packages/viewer/src/styles.css`, because the viewer is
deliberately outside the app theme, and `root.tsx`'s `CriticalStyles` block,
which is inline critical CSS whose whole purpose is to apply before the main
stylesheet is parsed and so cannot read a custom property that stylesheet
declares.

**Marketing headings: one display face, opt-in.**

Not shipped yet — `--font-heading` does not exist in `globals.css` today, and no
component references it. What follows is the decision record that governs the
change when it lands, recorded here first so the implementation cannot quietly
pick a different shape:

1. **The token is `--font-heading`, never `--font-display`.** `--font-*` is a
   Tailwind namespace, so `--font-display` would generate a `font-display`
   utility that reads as the CSS `font-display` descriptor.
2. **The face will attach to an opt-in utility, never to the rungs.** Baking a
   `font-family` into `.text-display` or `.text-headline` inside
   `@layer components` would change every dashboard and publisher heading
   already on those rungs — `publisher/shell/drop-zone.tsx` uses `text-headline`
   today. Marketing components are to apply `font-heading` *beside* the rung.
   Product UI stays on DM Sans.
3. **Newsroom OG thumbnails stay on DM Sans.**
   `apps/vectreal-platform/scripts/gen-newsroom-thumbnails.ts` documents that
   sharp cannot load a fontsource woff2 and resolves the face by *system* font
   name, failing loudly through `assertFontAvailable`. Following the display
   face there would require a second system font installed on every
   contributor's machine. The divergence is deliberate.

One face for headings and one for body, both committed to, is the point. Two
interchangeable grotesques at similar weights read as an accident rather than a
decision.

## Tooltip copy: 140 characters

`TooltipContent` is `max-w-80` at `text-xs`, so 140 characters is three lines and
a glance. Past that a tooltip becomes a paragraph hanging over the control the
reader was trying to use; one optimization-catalog entry had reached 367
characters, nine lines of it.

`apps/vectreal-platform/tests/tooltip-copy-length.spec.ts` enforces the ceiling
over every tooltip string in `app/`. It reads source rather than a render tree,
so it only sees string literals, and a new prop name carrying help text has to be
added to its `ATTRIBUTES` list.

When copy no longer fits, the answer is a visible caption beside the control, the
way the embed options panel resolved it, not a taller tooltip. Several controls
already have that slot: the optimization catalog gives every step a
`description` rendered under its label, so the tooltip only has to carry what the
caption does not.

The trigger is a real `<button>`, not the icon. Radix's `TooltipTrigger` adds no
tabIndex of its own under `asChild`, and an `<svg>` is not a tab stop, so an icon
handed straight to it cannot be reached or opened by keyboard at all.

```claims
present  shared/components/src/styles/globals.css                              .text-display
present  shared/components/src/styles/globals.css                              .text-headline
present  shared/components/src/styles/globals.css                              .text-h4
present  shared/components/src/styles/globals.css                              --text-display: clamp(2.75rem, 6.4vw, 5.5rem)
present  shared/components/src/styles/globals.css                              --font-sans
exists   apps/vectreal-platform/tests/tooltip-copy-length.spec.ts
exists   apps/vectreal-platform/tests/type-scale-adherence.spec.ts
exists   apps/vectreal-platform/app/components/info-tooltip.spec.tsx
```
