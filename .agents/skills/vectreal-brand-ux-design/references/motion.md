# Motion

Owner of: durations, easings, and when motion is allowed at all.

## Tokens

Durations: `--duration-instant` 80ms, `--duration-fast` 150ms, `--duration-base`
250ms, `--duration-slow` 400ms, `--duration-cinematic` 700ms.

Easings: `--ease-out` `cubic-bezier(0.16, 1, 0.3, 1)`, `--ease-in-out`, and
`--ease-spring`.

**These generate no utilities.** `--duration-*` is not a Tailwind theme
namespace — Tailwind ships only `--default-transition-duration` — so writing
`duration-fast` in markup silently falls through to Tailwind's own 150ms default
and `duration-base` does nothing at all. Markup writes `duration-150`,
`duration-250` and so on. The tokens exist so CSS can read them; they are not a
class vocabulary.

## What motion is for

Motion communicates state change, focus shift, and hierarchy. Do not animate to
decorate.

The practical test: if the animation were removed, would the reader lose
information about what just happened? A crossfade between two states of the same
panel passes. A fade-up applied to every section on scroll does not: it is
decoration wearing the costume of feedback, and
[anti-ai-look.md](anti-ai-look.md) bans it by name.

Frequent, low-novelty actions should carry the least motion. A control someone
uses forty times an hour does not want a spring.

## Reduced motion

Respect `prefers-reduced-motion`. The rule: a Framer component calls
`useReducedMotion()` and passes static variants rather than animating, and a CSS
keyframe animation is added to the `prefers-reduced-motion` block in
`globals.css`.

That block is a hand-maintained **allowlist of class names**, not a blanket
rule, which is the part that keeps being missed. Anything not listed in it keeps
animating — including every Tailwind built-in, which is how `animate-pulse` ran
indefinitely on every card in the product until it was removed. Adding a
keyframe animation means adding it there in the same change.

The codebase does not yet hold the line everywhere. `home/filetype-carousel.tsx`
animates with no guard in the file, and `.animate-loading-bar` and
`.animate-loading-shimmer` are used by `global-navigation-loader.tsx` while
sitting outside the block. Treat those as debt to match, not as precedent.

## Two vocabularies exist

`shared/components/src/motion/variants.ts` hardcodes its own durations and
easing rather than reading the CSS tokens, because Framer cannot read a custom
property. The numbers agree with `--ease-out` but are stated twice.

It has exactly two consumers, both in `app/components/home/`. Unifying the two
vocabularies is a filed catalogue row scoped to the home page, not something to
attempt from an unrelated change.

```claims
present  shared/components/src/styles/globals.css                              --duration-instant: 80ms
present  shared/components/src/styles/globals.css                              --duration-fast: 150ms
present  shared/components/src/styles/globals.css                              --duration-cinematic: 700ms
present  shared/components/src/styles/globals.css                              --ease-out: cubic-bezier(0.16, 1, 0.3, 1)
present  shared/components/src/styles/globals.css                              prefers-reduced-motion
```
