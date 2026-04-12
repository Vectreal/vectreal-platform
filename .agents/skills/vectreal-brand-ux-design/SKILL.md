---
name: vectreal-brand-ux-design
description: 'Use when designing or refactoring UI for Vectreal, including visual direction, component styling, interaction design, brand alignment, UX flows, accessibility, and responsive behavior. Triggers: design system, branding, UX philosophy, intentional UI, productive workflows, apple-grade polish, tokens, typography, motion, forms, loading states, UI review.'
---

# Vectreal Brand UX Design

## Mission

Design purposeful, high-quality interfaces that feel intentional and productive while remaining consistent with Vectreal's token-driven brand system and engineering constraints.

## Non-Negotiables

1. Use token-driven styling first, not arbitrary one-off colors.
2. Maintain brand direction: DM Sans typography and orange-led accent language.
3. Every UI decision must serve user task clarity and productivity.
4. Ensure accessibility and responsiveness are first-class, not post-fix tasks.
5. Motion must support comprehension and feedback, never decoration-only noise.

## Brand Foundation

1. Typography

- Use DM Sans variable as the base family for consistency and readability.
- Maintain clear hierarchy via weight, size, spacing, and contrast.

2. Color

- Use semantic tokens from global styles for background/foreground/surfaces/states.
- Use brand orange accents intentionally for primary actions and highlights.
- Keep dark/light token behavior coherent; do not hardcode mode-specific hacks unless justified.

3. Visual language

- Keep interfaces modern, confident, and technically clean.
- Prefer restrained depth, clear spacing, and crisp component boundaries.

## UX Philosophy

1. Intentional and productive

- Prioritize workflows that reduce friction and cognitive overhead.
- Keep primary actions obvious and progressive disclosure for advanced controls.

2. Purpose over novelty

- Each element must have clear function.
- Avoid ornamental patterns that do not improve comprehension or throughput.

3. Consistency with room for emphasis

- Reuse established interaction patterns for predictable behavior.
- Introduce visual emphasis only where hierarchy or decision confidence benefits.

## Apple-Grade Quality Bar (Operationalized)

1. Precision

- Consistent spacing rhythm and alignment across breakpoints.
- Pixel-level attention to typography, icon sizing, and touch targets.

2. Craft

- Smooth state transitions, clear affordances, and coherent depth hierarchy.
- Loading/empty/error states feel intentional, not fallback leftovers.

3. Restraint

- Minimal visual noise, strong hierarchy, and concise copy.
- No over-animation, no excessive gradients/effects that hurt clarity.

4. Performance-aware polish

- Motion and effects must not degrade interaction responsiveness.
- Prefer lightweight, meaningful animations and proper reduced-motion support.

## Token and Component Rules

1. Token-first styling

- Prefer semantic token usage for surfaces, text, borders, and interactive states.
- Avoid direct hex literals in feature components when token exists.

2. Shared component system first

- Start from shared UI primitives and extend with variants/composition.
- Keep local overrides minimal and intentional.

3. Variant discipline

- Use variant APIs for state/intent differences rather than ad-hoc class duplication.

## Interaction and Motion Rules

1. Motion intent

- Use animation to communicate state change, focus shift, and hierarchy.

2. Timing and readability

- Keep micro-interactions quick and clear.
- Keep larger transitions smooth but bounded; avoid sluggish feel.

3. Accessibility

- Respect reduced-motion preferences.
- Ensure focus indicators remain visible and consistent.

## Responsive and Accessibility Rules

1. Mobile-first composition

- Build for narrow viewports first, then scale up with clear breakpoint intent.

2. Accessibility baseline

- Keyboard navigable controls.
- Visible focus rings.
- Sufficient contrast for text and controls.
- Semantic structure and meaningful labels for assistive technology.

3. Form ergonomics

- Inputs and controls must have predictable validation and clear error guidance.
- Preserve context after validation failure and show actionable messages.

## Practical Design Recipes

1. Build a new task-focused dashboard section

- Start with existing layout shell and spacing rhythm.
- Define one primary action and one clear secondary path.
- Use cards/surfaces and typographic hierarchy to reduce scan time.

2. Build a high-confidence form flow

- Use shared form primitives and explicit validation messaging.
- Place primary action consistently and keep supportive hints concise.
- Provide success/failure feedback immediately and unambiguously.

3. Add loading, empty, and error states

- Loading: indicate structure and expected outcome.
- Empty: explain what to do next.
- Error: explain issue and recovery path.

4. Add meaningful motion to a complex panel

- Animate entrance and state transitions to orient user focus.
- Keep durations tight; avoid chained effects unless they clarify sequence.

## Anti-Patterns and Replacements

1. Anti-pattern: Hardcoded colors in feature modules.

- Replace with semantic or brand token usage from global styles.

2. Anti-pattern: Competing button styles for similar intents.

- Replace with shared variant semantics and consistent CTA hierarchy.

3. Anti-pattern: Motion used as decoration.

- Replace with state-communication motion only.

4. Anti-pattern: Dense UI without hierarchy.

- Replace with spacing rhythm, typographic contrast, and grouped actions.

5. Anti-pattern: Accessibility bolted on at the end.

- Replace with baseline a11y checks during initial implementation.

## Design Review Rubric

1. Purpose

- Is every element serving user task completion?

2. Clarity

- Is information hierarchy instantly scannable?

3. Brand fidelity

- Are typography, color, and component choices aligned to Vectreal system?

4. Interaction quality

- Are states, feedback, and motion coherent and useful?

5. Accessibility

- Keyboard, focus, labels, contrast, and reduced-motion support present?

6. Responsiveness

- Does layout remain productive and readable across mobile and desktop?

## Source-of-Truth References

- shared/components/src/styles/globals.css
- shared/components/src/ui/
- apps/vectreal-platform/app/components/
- apps/vectreal-platform/app/styles/global.module.css
- apps/vectreal-platform/app/styles/mdx.module.css
- AGENTS.md
- .github/copilot-instructions.md
- CLAUDE.md
