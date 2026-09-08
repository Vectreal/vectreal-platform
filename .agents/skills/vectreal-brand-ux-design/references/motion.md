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
decoration wearing the costume of feedback.

Frequent, low-novelty actions should carry the least motion. A control someone
uses forty times an hour does not want a spring.

## Reduced motion

Respect `prefers-reduced-motion` — every marketing component that animates calls
`useReducedMotion()` and passes `undefined` variants rather than animating, and
the CSS keyframe animations are disabled under a `prefers-reduced-motion` block
in `globals.css`. Match that; do not ship a new animation without the guard.

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
