---
name: vectreal-iterative-delivery
description: 'Use when requests are ambiguous or cross-cutting and require iterative execution with explicit alignment gates. Triggers: ambiguous scope, architecture+UX+infra changes, phased rollout, verification-first development, uncertainty reduction, autonomous review loops.'
---

# Vectreal Iterative Delivery

## Mission

Reduce ambiguity to near-zero before coding, then deliver in short verified loops that optimize correctness, DX, UX, and operational overhead.

## Core Loop

1. Discovery

- Map current behavior and failure surfaces before proposing fixes.
- Identify unknowns explicitly and convert each into a concrete question.
- Validate assumptions against repository conventions, PRD constraints, and existing architecture patterns.

2. Alignment

- Summarize intended outcomes, non-goals, and ownership boundaries (app vs package vs infra).
- Confirm acceptance criteria and rollout order before implementation.
- Resolve conflicts (security vs speed, UX vs scope, local unblock vs long-term architecture).

3. Design

- Plan by phase with dependencies and explicit verification checkpoints.
- Prefer minimal viable slice first, then progressive hardening.
- Keep public APIs stable unless change is deliberate and documented.

4. Implementation

- Execute one vertical slice at a time (code + tests/checks + docs where needed).
- Preserve existing behavior outside target scope.
- Use Nx project targets for workflows and automation.

5. Verification

- Run project-level checks through Nx only.
- Validate runtime behavior in the exact user surfaces being fixed.
- Confirm no policy/PRD identifier drift.
- Run explicit negative-path checks (error, empty, timeout, retry, permission, offline where relevant).
- Verify diagnostics state (type, lint, editor warnings for touched files) before closing the loop.

6. Autonomous Review

- Perform self-review for regressions, error paths, and maintainability.
- Identify residual risks and classify follow-up work separately from done work.

7. Plan Alignment

- Report deltas from original plan, not full restatements.
- Re-open ambiguity only where evidence indicates mismatch.
- Iterate until acceptance criteria are objectively met.

## Iteration Contract (Mandatory)

Every implementation loop must include all four phases in order:

1. Implementation
2. Verification
3. Autonomous review
4. Plan alignment

No phase may be skipped. If time or scope is constrained, reduce slice size, not gate coverage.

## Exhaustive Verification Checklist (Per Loop)

Before closing a loop, check all applicable items:

1. Build and type checks for touched projects via Nx.
2. Tests for touched projects via Nx.
3. Runtime happy-path validation in each modified surface.
4. Runtime failure-path validation in each modified surface.
5. Diagnostics clean for touched files (including editor warnings).
6. Import/order/style rules satisfied in touched files.
7. PRD canonical identifiers unchanged unless explicitly intended.
8. Security/infra blast radius reviewed for infra/auth/config changes.
9. User-facing recovery paths verified (retry/fallback/actionable copy).
10. Residual risks and follow-ups documented.

If any applicable item fails, continue iterating; do not report completion.

## Sub-Agent Coverage Policy

Use a sub-agent in iterative loops when it can reduce blind spots or speed up coverage.

Required triggers:

1. Cross-cutting changes across app + package + infra.
2. Searching for dispersed call sites, configs, or invariants across the workspace.
3. Validation sweeps where independent read-only confirmation improves confidence.

Execution rule:

- After each substantial implementation slice, run at least one focused sub-agent pass for exploration or verification when any required trigger applies.
- Treat sub-agent output as additional evidence, then still perform final local verification gates.

## Loop Evidence Block (Required)

Any completion/update that claims a loop or phase is done must include a compact evidence block.

Required fields:

1. Commands run (Nx commands only).
2. Touched surfaces validated (route/page/hook/module names).
3. Failure paths tested (what failed path was exercised and outcome).
4. Diagnostics status for touched files.
5. Residual risks and follow-ups.

If evidence is incomplete, report as in-progress instead of done.

## Required Gates

1. Ambiguity gate

- No coding begins until unresolved questions are listed and either answered or intentionally deferred.

2. Safety gate

- Security-sensitive or infrastructure-changing work requires explicit blast-radius acknowledgment and rollback approach.

3. Verification gate

- Each phase closes only after command-level validation and behavior confirmation.
- Each iteration closes only after the Exhaustive Verification Checklist is satisfied for all applicable items.

4. UX/DX gate

- User-facing failure states must have actionable feedback and retry/recovery paths.
- Developer workflows must be one-command where practical and documented in-repo.

## Ownership Heuristic

- Package layer: normalize technical error signals and event contracts.
- App layer: map signals to user messaging, recovery UX, and route-specific fallback UI.
- Infra layer: local bootstrap reliability, least-privilege defaults, and reproducible targets.

## Anti-Patterns

- Jumping to implementation while ambiguity is still implicit.
- Solving with broad refactors when a focused vertical slice is sufficient.
- Reporting success based on type-check alone without runtime failure-path validation.
- Introducing new identifiers that conflict with PRD canonical values.

## Done Criteria

A phase is done only when all are true:

1. Code changes are merged for the scoped slice.
2. Relevant Nx checks pass.
3. Runtime path works for success and failure states.
4. Docs/config updates reflect the new workflow.
5. Residual risks and next steps are explicit.
