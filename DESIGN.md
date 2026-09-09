# Design

How Vectreal's interface is put together, and where each rule is written down.

Every rule has exactly one owner, listed below, and the owner is the only place
it is written — a rule restated in two files drifts, and then the two disagree
with nobody noticing. What lives here is the reasoning *above* the rules: why
each one exists, and where to go for what it actually says. Where a principle
below and a reference disagree on detail, the reference is right.

## Principles

**Separate surfaces by value, not by outlines.** Depth is a property of the
surface, so it should be expressed as one — a step on a ladder that tracks the
theme, rather than a line drawn around a box. Borders are for edges that carry
meaning. → [Elevation](.agents/skills/vectreal-brand-ux-design/references/elevation.md)

**One place per name.** A name that exists twice will eventually mean two
things. This applies to CSS custom properties, to the class vocabulary, and to
this documentation. → [Tokens](.agents/skills/vectreal-brand-ux-design/references/tokens.md)

**The scale is not a suggestion.** A rung is a decision about size, weight,
tracking and leading taken together; hand-rolling one keeps the size and loses
the decision. Same for spacing: four steps a reader can feel beat nine they
cannot. → [Typography](.agents/skills/vectreal-brand-ux-design/references/typography.md),
[Tokens](.agents/skills/vectreal-brand-ux-design/references/tokens.md)

**Motion earns its place.** Animation is a way of saying what just changed. If
nothing changed, it is decoration, and decoration that moves is the kind a
reader cannot turn off. → [Motion](.agents/skills/vectreal-brand-ux-design/references/motion.md)

**Design the unhappy paths with the happy one.** Loading, empty, error and
permission-denied are states the product is actually in, not edge cases. Same
for keyboard access, focus and contrast: retrofitted, they get the budget left
over.

**Look at it.** Design claims are cheap and design defects are visual. A change
closes with a screenshot in both themes at real breakpoints.
→ [Enforcement](.agents/skills/vectreal-brand-ux-design/references/enforcement.md)

**Decide, then be consistent.** What makes a site look machine-made is not
particular colours or components; it is defaults nobody chose, applied evenly.
A choice you can give a reason for is the opposite of a template, even when it
uses the same ingredients. → [The look we are avoiding](.agents/skills/vectreal-brand-ux-design/references/anti-ai-look.md)

## Where the rules live

The authoritative rules are in the design skill, which agents load automatically
and humans can read as ordinary markdown:

| Reference | Covers |
| --- | --- |
| [Tokens](.agents/skills/vectreal-brand-ux-design/references/tokens.md) | Brand color and alpha, radius, the spacing rhythm, stacking tiers, viewport height, the page measure |
| [Elevation](.agents/skills/vectreal-brand-ux-design/references/elevation.md) | The `ds-*` ladder, and when a surface may carry a shadow |
| [Typography](.agents/skills/vectreal-brand-ux-design/references/typography.md) | The type scale, the faces, tooltip copy length |
| [Motion](.agents/skills/vectreal-brand-ux-design/references/motion.md) | Durations, easings, reduced motion |
| [Enforcement](.agents/skills/vectreal-brand-ux-design/references/enforcement.md) | The ESLint rules, the design specs, how to verify a change |
| [The look we are avoiding](.agents/skills/vectreal-brand-ux-design/references/anti-ai-look.md) | What marketing surfaces must not look like, and what to do instead |
| [Evidence](.agents/skills/vectreal-brand-ux-design/references/evidence.md) | What these claims rest on, and which popular numbers are fabricated |

[The skill itself](.agents/skills/vectreal-brand-ux-design/SKILL.md) is a router
over those seven, plus an index of failure modes keyed by symptom — the fastest
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
