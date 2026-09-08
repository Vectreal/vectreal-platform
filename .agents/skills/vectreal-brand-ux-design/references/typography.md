# Typography

Owner of: the type scale, the faces, and tooltip copy length.

## The scale is the single source of truth

| Rung | Size | Job |
| --- | --- | --- |
| `text-display` | `clamp(2.75rem, 6.4vw, 5.5rem)` | The one h1 on a marketing page |
| `text-stat` | `clamp(3rem, 5.5vw, 4.25rem)` | A number that is the point of its block |
| `text-headline` | `clamp(2rem, 4vw, 3.5rem)` | A section that opens like a page |
| `text-h2` | `clamp(1.75rem, 2.8vw, 2.5rem)` | Peer sections down a page |
| `text-h3` | `clamp(1.35rem, 2vw, 1.75rem)` | Blocks inside a section |
| `text-h4` | `1rem` fixed | Labels a panel of fixed width |
| `text-body-lg` | `1.125rem` | Hero and intro copy |
| `text-body` | `1rem` | Ordinary prose |
| `text-body-sm` | `0.875rem` | Dense UI, captions, table rows |
| `text-label-xs` | `0.6875rem` | Micro-labels |
| `text-eyebrow` | `0.6875rem` | `text-label-xs` plus uppercase and `--tracking-eyebrow` |

Sizes are repeated here because a reference nobody can answer a question from
sends the reader to the stylesheet, and the reader who opens the stylesheet
stops consulting the reference. They are pinned by
`tests/type-scale-adherence.spec.ts`, which parses `globals.css`.

**Adding or removing a rung is never a CSS-only change.** Three files have to
agree: the token and class in `globals.css`, the rung name in
`TYPE_SCALE_RUNGS` (`shared/utils/src/lib/styling.utils.ts`), and the ESLint
variant selector in `eslint.config.mts`. `TYPE_SCALE_RUNGS` is what registers
the rungs with tailwind-merge; while it was missing them, `cn()` classified
every `text-<rung>` as a colour, so a rung and a colour deleted each other and
`sheet.tsx` and `drawer.tsx` shipped with `text-foreground` silently dropped.
`tests/type-scale-adherence.spec.ts` pins the list against the stylesheet.

The `--text-*` tokens are declared in plain `:root`, deliberately **not** in
`@theme`. That is why Tailwind generates no `text-body` or `text-h2` utility and
why each rung is a hand-written class in `@layer components` - which in turn is
why a variant on one silently emits nothing. See
[enforcement.md](enforcement.md) for the rule that guards it.

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

### Body copy is 16px, and product UI is not

`.text-body` is 16px and `.text-body-sm` is 14px. The ladder used to fall from
18px straight to 11px, so ordinary paragraphs reached past the scale for
Tailwind's `text-sm` and `text-base` - 466 call sites, each choosing its own
leading.

The rung is 16px even though the app's most common size by far is 14px, because
14px is a density convention that belongs to the dashboard and the publisher,
where a table row has to fit. Prose on a marketing page is read rather than
scanned, and the rung a redesign migrates toward should be the readable one.

**This is not a licence to migrate product UI.** Those `text-sm` call sites in
the dashboard and publisher stay as they are until something deliberately moves
them; sweeping them to 16px is a large visual change and is nobody's current
task.

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

Shipped. `--font-heading: 'Funnel Display Variable', sans-serif` is declared in
`globals.css`, the face is imported from `@fontsource-variable/funnel-display`,
and 13 files apply `font-heading`. To put the display face on a heading, write
`font-heading` beside the rung — there is nothing to create.

The three decisions that shape it, which still bind:

1. **The token is `--font-heading`, never `--font-display`.** `--font-*` is a
   Tailwind namespace, so `--font-display` would generate a `font-display`
   utility that reads as the CSS `font-display` descriptor.
2. **The face attaches to an opt-in utility, never to the rungs.** Baking a
   `font-family` into `.text-display` or `.text-headline` inside
   `@layer components` would change every dashboard and publisher heading
   already on those rungs — `publisher/shell/drop-zone.tsx` uses `text-headline`
   today. Marketing components apply `font-heading` *beside* the rung.
   Product UI stays on DM Sans.
3. **Newsroom OG thumbnails stay on DM Sans.**
   `apps/vectreal-platform/scripts/gen-newsroom-thumbnails.ts` documents that
   sharp cannot load a fontsource woff2 and resolves the face by *system* font
   name, failing loudly through `assertFontAvailable`. Following the display
   face there would require a second system font installed on every
   contributor's machine. The divergence is deliberate.

One face for headings and one for body, both committed to, is the point. Two
interchangeable grotesques at similar weights read as an accident rather than a
decision - see [anti-ai-look.md](anti-ai-look.md).

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
present  shared/components/src/styles/globals.css                              .text-display {
present  shared/components/src/styles/globals.css                              .text-headline {
present  shared/components/src/styles/globals.css                              .text-h4 {
present  shared/components/src/styles/globals.css                              .text-body {
present  shared/components/src/styles/globals.css                              .text-body-sm {
present  shared/components/src/styles/globals.css                              --text-body: 1rem
present  eslint.config.mts                                                     h4|stat|body-lg|body-sm|body
present  shared/components/src/styles/globals.css                              --text-display: clamp(2.75rem, 6.4vw, 5.5rem)
present  shared/components/src/styles/globals.css                              --font-sans: 'DM Sans Variable'
present  shared/components/src/styles/globals.css                              --font-heading: 'Funnel Display Variable'
present  apps/vectreal-platform/app/components/layout-components/page-hero.tsx  font-heading
present  apps/vectreal-platform/app/routes/layouts/signin-layout.tsx            text-h2 font-heading
present  apps/vectreal-platform/app/routes/forgot-password-page/forgot-password.tsx  text-h3 font-heading
present  apps/vectreal-platform/app/routes/reset-password-page/reset-password.tsx    text-h3 font-heading
exists   apps/vectreal-platform/tests/tooltip-copy-length.spec.ts
exists   apps/vectreal-platform/tests/type-scale-adherence.spec.ts
exists   apps/vectreal-platform/app/components/info-tooltip.spec.tsx
```
