# Context extensions

Use agent skills available and helpful for the task at hand. When working on the platform app, use react router framework mode best practices

## Project Skills

- Architecture extensions: use [vectreal-extension-architecture](.agents/skills/vectreal-extension-architecture/SKILL.md) for routes, loaders, actions, resource routes, domain modules, repositories, services, the client/server boundary, and authorization. Read its first section before writing any access check: RLS is inert for app traffic, so the role table in `dashboard-operations.ts` is the only authorization that runs.
- Design and branding: use [vectreal-brand-ux-design](.agents/skills/vectreal-brand-ux-design/SKILL.md) for tokens, the `ds-*` elevation ladder, the `text-*` type scale, motion, responsive and accessibility work, and the styling rules ESLint already enforces.
- Iterative delivery: use [vectreal-iterative-delivery](.agents/skills/vectreal-iterative-delivery/SKILL.md) for scoping ambiguous work and for shipping any PR. It owns the mandatory review loop, the mutation gate for tests, the git and worktree rules, and the evidence block required before claiming completion.

These are not merely suggested: `.agents/hooks/` (wired from
`.claude/settings.json`) reminds you which of them you have not used yet, and
refuses to let you leave plan mode until `vectreal-iterative-delivery` has run.
Neither hook can block on an error. See the Skills section of `CLAUDE.md`.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
