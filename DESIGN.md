# Design

How Vectreal's interface is put together, and where each rule is written down.

This page states no rule of its own. Every rule has exactly one owner, listed
below, and the owner is the only place it is allowed to be written — a rule
restated in two files drifts, and then the two disagree with nobody noticing.
What lives here is the reasoning that sits above the rules, and a map.

## Principles

**Separate surfaces by value, not by outlines.** Depth comes from a small ladder
of `--foreground` mixes that tracks the theme automatically, not from borders and
shadows stacked by hand. A border is a deliberate signal, not the default way to
bound a box.

**One place per name.** A token declared twice becomes self-referential — that is
what once collapsed every corner in the app to square — and a rule written twice
becomes two rules. This applies to CSS custom properties, to the class
vocabulary, and to this documentation.

**The scale is not a suggestion.** Sizes, tracking and leading travel together in
one class. A component that hand-rolls a heading gets the size and loses
everything else, and then drifts from the rung it was imitating.

**Motion earns its place.** If removing an animation would cost the reader no
information about what just happened, it should not be there.

**Design the unhappy paths with the happy one.** Loading, empty, error and
permission-denied states are part of the design, not a pass afterwards. Same for
keyboard access, focus rings and contrast.

**Look at it.** A design change closes with a screenshot in both themes at real
breakpoints, never with a claim that it should work.

## Where the rules live

The authoritative rules are in the design skill, which agents load automatically
and humans can read as ordinary markdown:

| Reference | Covers |
| --- | --- |
| [Tokens](.agents/skills/vectreal-brand-ux-design/references/tokens.md) | Brand and semantic color, alpha, radius, stacking tiers, viewport height, the page measure |
| [Elevation](.agents/skills/vectreal-brand-ux-design/references/elevation.md) | The `ds-*` ladder, and when a surface may carry a shadow |
| [Typography](.agents/skills/vectreal-brand-ux-design/references/typography.md) | The type scale, the faces, tooltip copy length |
| [Motion](.agents/skills/vectreal-brand-ux-design/references/motion.md) | Durations, easings, reduced motion |
| [Enforcement](.agents/skills/vectreal-brand-ux-design/references/enforcement.md) | The ESLint rules, the design specs, how to verify a change |

[The skill itself](.agents/skills/vectreal-brand-ux-design/SKILL.md) is a router
over those five, plus an index of failure modes keyed by symptom — the fastest
way in when you know what looks wrong but not which rule governs it.

## What backs them up

Design rules here are not honor-system. `eslint.config.mts` fails the build on
five of them, and six specs under `apps/vectreal-platform/tests/` guard the rest,
including a `documented-claims` spec that executes the factual assertions this
documentation makes about the code. A rule that rots takes CI with it, which is
the intent.

The implementation lives in `shared/components/src/styles/globals.css`. Read its
comments before changing it; several of them record an afternoon someone already
lost.
