---
name: vectreal-brand-ux-design
description: 'Use for any change a user can see in Vectreal: component styling, layout, spacing, color, typography, elevation, motion, empty/loading/error states, responsive behavior, accessibility, and marketing UI. Triggers: design, styling, className, Tailwind, token, theme, dark mode, color, typography, type scale, spacing, elevation, surface, card, motion, animation, transition, responsive, mobile, accessibility, focus, contrast, empty state, loading state.'
---

# Vectreal Brand UX Design

This file is a router. Each rule has exactly one owner below; read the reference
that covers what you are about to change rather than working from this page.
Duplicated rules drift, and this repo has the receipts.

| Reference | Owns |
| --- | --- |
| [tokens.md](references/tokens.md) | Brand and semantic color, alpha, radius, the `--z-index-*` tiers, viewport height, the page measure |
| [elevation.md](references/elevation.md) | The `ds-*` ladder, and when a surface may carry a shadow |
| [typography.md](references/typography.md) | The type scale, the faces, tooltip copy length |
| [motion.md](references/motion.md) | Durations, easings, and when motion is allowed at all |
| [enforcement.md](references/enforcement.md) | The ESLint rules, the design specs, claims blocks, the Tailwind scanning hazard, how to verify in a browser |

## The one answer worth inlining

The brand color is `--orange` (`#fc6c18`). It is **not** `--accent`, which is the
hover/focus background, and not `--primary`. At partial alpha it is
`rgb(var(--orange-rgb) / <alpha>)` and never `hsl(var(--orange)/…)`, which fails
to parse against a hex and takes the whole declaration down with it, silently.

That is the summary because it is the question asked most often.
[tokens.md](references/tokens.md) owns the rule, the lookup table, and why each
wrong form is wrong.

## Failure modes, and who owns the fix

| Symptom | Owner |
| --- | --- |
| `--accent` or `--primary` used to mean "brand"; alpha applied to `--orange` inline | [tokens.md](references/tokens.md) |
| A z-index picked as a number; a full-viewport surface sized with a screen-height utility | [tokens.md](references/tokens.md) |
| A hand-written hover background beside a `ds-*` class; a shadow on a page surface | [elevation.md](references/elevation.md) |
| Font size set inline from a `--text-*` token; a heading hand-rolled as `text-4xl md:text-6xl` | [typography.md](references/typography.md) |
| A tooltip that has become a paragraph | [typography.md](references/typography.md) |
| Motion added to decorate; a new animation with no `prefers-reduced-motion` guard | [motion.md](references/motion.md) |
| A variant on a `ds-*` or `text-*` class silently emitting nothing | [enforcement.md](references/enforcement.md) |
| Loading, empty and error states added after the happy path | designed together, always |
| Accessibility retrofitted after review | keyboard, focus ring, contrast, labels from the start |

## Source of truth

- `shared/components/src/styles/globals.css` — read the comments; several record
  an afternoon someone already lost
- `shared/components/src/ui/`
- `eslint.config.mts`, the `no-restricted-syntax` block
- `apps/vectreal-platform/app/components/`

The `absent` line below is the load-bearing one: it fails the build the day
someone points `--accent` back at the brand.

```claims
present  shared/components/src/styles/globals.css                              --orange: #fc6c18
present  shared/components/src/styles/globals.css                              --orange-rgb: 252 108 24
absent   shared/components/src/styles/globals.css                              --accent: var(--orange)
exists   .agents/skills/vectreal-brand-ux-design/references/tokens.md
exists   .agents/skills/vectreal-brand-ux-design/references/elevation.md
exists   .agents/skills/vectreal-brand-ux-design/references/typography.md
exists   .agents/skills/vectreal-brand-ux-design/references/motion.md
exists   .agents/skills/vectreal-brand-ux-design/references/enforcement.md
```
