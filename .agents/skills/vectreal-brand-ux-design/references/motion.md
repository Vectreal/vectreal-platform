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

The codebase does not yet hold the line everywhere. `.animate-loading-bar` and
`.animate-loading-shimmer` are used by `global-navigation-loader.tsx` while
sitting outside the block. Treat that as debt to match, not as precedent.

## One vocabulary

The tokens above are the only motion vocabulary. A shared Framer variants module
used to restate them with its own numbers; its only consumers were the old home
page, and it went with them.

Framer cannot read a custom property, so a Framer component that needs a
duration or an easing writes the value of the matching token where it uses it:
`[0.16, 1, 0.3, 1]` for `--ease-out`, `0.25` for `--duration-base`. Write the
token's name beside the number so the next reader can check one against the
other.

```claims
present  shared/components/src/styles/globals.css                              --duration-instant: 80ms
present  shared/components/src/styles/globals.css                              --duration-fast: 150ms
present  shared/components/src/styles/globals.css                              --duration-cinematic: 700ms
present  shared/components/src/styles/globals.css                              --ease-out: cubic-bezier(0.16, 1, 0.3, 1)
present  shared/components/src/styles/globals.css                              prefers-reduced-motion
```
