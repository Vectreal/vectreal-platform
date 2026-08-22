---
name: vectreal-iterative-delivery
description: 'Use when scoping ambiguous or cross-cutting Vectreal work, and when shipping any PR. Owns the mandatory review loop, the mutation gate for tests, and the git and worktree rules. Triggers: plan, scope, phased rollout, ship, PR, pull request, review, code review, verify, test coverage, commit, branch, worktree, done, ready to merge.'
---

# Vectreal Iterative Delivery

## Two dials, not one tradeoff

How to **cut** work and how much **effort** to spend on it are separate
decisions. Conflating them produces both failure modes: sprawling tasks that
need seven review rounds, and days spent perfecting something nobody depends on.

**Cut by concern. Always.** One concern per task, per PR, per subagent. Review
rounds track the number of concerns in a diff, not its size. Measured on this
workstream:

| PR | Concerns | Files | Review rounds |
| --- | --- | --- | --- |
| #736 eslint rules | 1 | 7 | 1 |
| #732 hotspot fixes + module split + comparison | 3 | 20 | 3 |
| #734 server manifest + client loader | 2 | 20 | 5 |
| #735 route + hook + panel + dialog + key options + snippet | 6 | 14 | 7 |
| embed domain policy | 1 | 2 | 0 |

Twenty files with two concerns cost more rounds than seven files with one.
Splitting is close to free; mixing is not.

**Spend by tier.** Distance from the funnel sets depth, and only depth.

| Tier | What | Depth |
| --- | --- | --- |
| 1 | On the funnel: save a scene, publish it, mint a key, allow a domain, copy the snippet, authorize the request, serve the manifest and assets | Full loop. Mutation gate. A test of the invariant *between* contract halves, not each half. Integration coverage. |
| 2 | Supports the funnel: dashboard, billing, auth UI, publisher | One review pass. Escalate to the loop only if it finds something. |
| 3 | Off the funnel: marketing, docs, tooling, skills, this file | Gates green and one read-through. No loop. |

`apps/vectreal-platform/tests/critical-path.spec.ts` holds the funnel as data and
fails when a step loses its guard. It is the tier-1 list.

So the grid is:

|  | Narrow scope | Wide scope |
| --- | --- | --- |
| **Deep** | Tier 1, correct | #735: seven rounds for one feature |
| **Shallow** | Tier 3, correct | how the wildcard bug shipped |

Hyperfixation is not caused by narrow scope. It is deep effort spent on a tier-3
concern. On 2026-08-22 three agent skill files were rewritten and verified with
tier-1 rigour while a tier-1 bug (`*.myshopify.com` could not be saved at all)
sat filed and untouched from the day before. Narrow was right; deep was wrong.

**Drift triggers.** Both are checkable mid-task:

1. **One PR, one sentence, no "and".** If the description needs a conjunction it
   is two PRs. #735's needed five.
2. **If the diff touches a file the scope line did not name**, stop. Either
   rename the scope out loud, or file the finding and leave the file alone.

## The loop, which is never skipped

Findings are not the deliverable. **A clean review round is.**

1. **Review** - several subagents in parallel, each on one distinct dimension.
2. **Map** - one subagent consolidates into a fix spec: dedupe, decide, and name
   the single owner of each rule.
3. **Fix** - subagents implement the spec on disjoint files so they cannot
   collide.
4. **Verify** - the Nx gates below, plus live verification in the surface that
   changed.
5. **Repeat from 1** until a round comes back with nothing.

**Phases are barriers.** Readers and writers never run at the same time. Every
agent in a phase finishes before the next starts. A reviewer reading a tree a
fixer is mid-edit reports against a state that never existed. Parallelism lives
inside a phase, never across one.

Serial single-resource work stays with the main agent: the browser pane, the dev
server, the local database. Only reading, mapping and editing fan out.

Subagent reports are evidence, not verdicts. They are confidently wrong often
enough that a finding gets checked against the code before it becomes a fix.

## The mutation gate

**For every guard you add, mutate the production line and confirm a test goes
red.** Run this while implementing, not after review asks for it.

This is the single highest-value habit here. On PR #735 the review loop ran seven
rounds; three separate rounds found a test of mine that could not fail, and one
was directly beneath a comment I had written warning about that exact failure
mode. The mutation check catches all of them in seconds and takes rounds off the
loop.

Named failure modes it catches:

- **The tautological assertion.** A regex capture group that can never match what
  it claims (`[^"]*` will not contain a quote), or asserting attribute names
  while the payload injects sibling elements. Parse with `DOMParser` and assert
  an exact element list rather than pattern-matching a string.
- **The untested guard.** Delete the guard; if the suite is still green, the test
  was never testing it.
- **The test that pins the bug.** Write the failing test first when fixing a
  defect, and watch it fail for the stated reason before fixing.

## Stop symptom-patching

When you fix what looks like the same defect at a **third** call site, stop and
find the cause. "Zero results means confirmed empty" was patched in three places
before round six found the real cause: a `loading` flag derived from
`fetcher.state`, which reads `idle` before dispatch too, and dispatch is an effect
that never runs during SSR, so both empty-state claims were baked into the server
HTML.

Two patches of one symptom is a coincidence. Three is a missing root cause.

## Scope discipline

Out-of-scope findings become a catalogue row (Notion **Vectreal Work Items**) or
a GitHub issue. They never become lines in the diff and never become a report
handed back for triage. Say plainly in the PR what was filed rather than fixed,
and why.

Deliver the whole scope that was asked for. If part is blocked, finish everything
else in full and say what was left out. Scaling the work down is the user's call.

## Git rules

- **Never write git history unless asked.** Commit, push, merge, rebase and tag
  all count. A plan that authorizes PRs for named phases authorizes those phases
  and nothing else.
- **No self-attribution anywhere.** Not in commit messages, not in PR titles or
  bodies, not in branch names. Branches take a conventional prefix describing the
  change: `feat/`, `fix/`, `chore/`, `test/`, `docs/`, `refactor/`, `perf/`,
  `ci/`. A `PreToolUse` hook blocks the common cases, but the hook is a backstop,
  not the rule.
- **Use `git -C <path>` on every git call. Never `cd`.** A `git checkout -b` that
  ran in a worktree while the edits sat in the main repo put a commit on an
  unrelated branch, and it was caught only because `gh pr create` failed.
- **Conventional Commits** for messages. Versioning is Release Please; never
  `nx release`.

## Worktree rules

Worktrees keep pre-bump `node_modules` that disagree with `pnpm-lock.yaml`.
Reinstall before trusting any test result on a dependency-regression bug.

## Merge-order and staleness

- To test whether a branch still holds unique work, use `git merge-tree
  --write-tree` plus GitHub's merged-PR head-ref list. `git diff main...branch`
  is three-dot and measures from the merge base, so it reports every
  squash-merged branch as full of unique work.
- Stacked PRs: merge the base, rebase the child, then merge the child. Merging
  both back to back conflicts.

## Gates

```bash
pnpm nx run-many --target=typecheck,lint -p vctrl/core,vctrl/hooks,vctrl/viewer,vectreal-platform
```

```bash
npx vitest run --root .
```

Integration tests need `pnpm nx run vectreal-platform:supabase-start` first, then
`pnpm nx run vectreal-platform:test-integration`.

CI runs `build-ci`, not `build`, plus job-level env vars, so `nx build` passing
locally is not the gate.

**`nx run-many -p <name>` exits 0 when the name matches nothing.** It prints
"No tasks were run" and succeeds, so a typo turns a gate into a no-op that reads
as a pass. The project names are `vectreal-platform`, `shared/components`,
`shared/utils`, `vctrl/core`, `vctrl/hooks`, `vctrl/viewer`, `vctrl/embed`,
`storybook`, `terraform`. Note the slashes: `shared-components` is not a project
and silently covers nothing. Check the task count in the summary against the
number of projects times targets.

After the PR is open, verify the PR and not just the working tree: the diff
contains only the files this step names, and CI is green on the actual PR head.

## Evidence block

Any claim that a phase is done carries:

1. Commands run, with their result.
2. Surfaces validated, including the failure path exercised.
3. What was filed rather than fixed.
4. Residual risk.

If the evidence is incomplete, report in progress. Report outcomes faithfully: if
tests fail, say so with the output; if a step was skipped, say that.

## Anti-patterns

| Anti-pattern | Replacement |
| --- | --- |
| Review round skipped because the change looks small | Run the loop; #735's worst defect was in a 3-line hook |
| Test written after the guard, never mutated | Mutate the line, watch it go red |
| Third patch of one symptom | Find the cause |
| Reviewers and fixers running concurrently | Phase barrier |
| Subagent finding applied without checking the code | Verify, then fix |
| Success reported from a passing type-check | Runtime failure-path check in the changed surface |
| Out-of-scope fix folded into the diff | Catalogue row, named in the PR |

## Verified claims

Executed by `apps/vectreal-platform/tests/agent-skill-claims.spec.ts` on every
CI run.

```claims
present  .github/workflows/ci-quality.yaml                     build-ci
present  apps/vectreal-platform/vitest.config.ts               tests/**/*.spec.{ts,tsx}
exists   apps/vectreal-platform/vitest.integration.config.ts
exists   .agents/skills/vectreal-extension-architecture/SKILL.md
exists   .agents/skills/vectreal-brand-ux-design/SKILL.md
```
