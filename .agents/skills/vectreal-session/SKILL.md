---
name: vectreal-session
description: 'Use when a Vectreal coding session was started from a brief by the lead coordinator session (the first message came from another session), and whenever such a session is about to commit, push, open a PR, report done, or ask a question. Triggers: brief, lead session, coordinator, sub-session, report back, done, CI pending, hand-over, notes folder.'
---

# Vectreal Session

How a coding session started from the lead's brief works. A brief can then say
"Follow `vectreal-session`" plus the task, instead of restating these rules.
The working checklist in `AGENTS.md` ("How to work here") applies in full; this
skill adds what is specific to working under the lead.

## What a brief authorizes

The lead speaks for Moritz on the work its brief names. A brief that asks for a
PR authorizes, for that work only:

- a feature branch, commits, and pushes to that branch (`--force-with-lease`
  on it is fine);
- `gh pr create`, `gh pr edit` and `gh pr ready` for that PR, and adding the
  `chromatic` label to it.

It never authorizes a merge, a push to `main`, a plain force-push, deleting a
branch the session did not create, or work the brief did not name. The lead
merges; Moritz deploys and releases.

If a commit, push or PR is refused anyway, stop and send the lead the exact
refusal text. Do not work around it.

## Scope

One concern per PR. Something found outside the brief is reported, or filed as
a Work Items row, never fixed in the same diff. If the brief turns out to need
more than one PR, say so in the first report and list them.

A bug follows Bug work in `vectreal-iterative-delivery`: survey, group by
cause and report before code when there is more than one, and give each finding
a cause tag.

## Done

Done means the PR exists and every GitHub check on its head commit passed,
CodeQL included. Local tests passing is the step before pushing, not done.

- In the desktop app, bind the PR with the `ccd_pr` tools and let CI events wake
  you; do not poll. In a terminal, run `gh pr checks <n> --watch` in the
  background.
- A failing check is fixed and pushed before reporting, or reported as
  `CI failing: <check>` with the cause.
- A report sent before CI finishes says `CI pending` in its first line. The lead
  reads that as not done and does not merge on it.
- Send the PR number only once every commit is pushed and no fix or review round
  is still coming.

## Reporting

The lead sees the first 400 characters of the final message, so lead with the
outcome:

1. First line: the PR link and its state (`all checks green`, `CI pending`,
   `CI failing: <check>`), or why there is no PR.
2. Then at most ten lines: what changed, what was verified and how, what was
   filed rather than fixed, and anything the lead must decide.
3. Anything longer (plans, measurements, screenshots, hand-over notes) goes in a
   file in the shared notes folder the brief names, and the report links it.

## Questions

Ask the lead only what blocks the work and only the lead or Moritz can answer.
One short question per message, then end the turn. Pattern questions (design
system, UX pattern, how a layer is built) are Moritz's, through the lead, before
any code. Everything else, decide, say what you decided in the report, and keep
going.

## Verified claims

Executed by `apps/vectreal-platform/tests/documented-claims.spec.ts` on every
CI run.

```claims
exists   .agents/skills/vectreal-iterative-delivery/SKILL.md
present  .github/pull_request_template.md                     Root cause
present  package.json                                         "test:brief"
```
