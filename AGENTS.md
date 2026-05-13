# Context extensions

Use agent skills available and helpful for the task at hand. When working on the platform app, use react router framework mode best practices

## Project Skills

- Architecture extensions: use [vectreal-extension-architecture](.agents/skills/vectreal-extension-architecture/SKILL.md) for route/layout semantics, modularization, client/server boundaries, Drizzle access patterns, and React Router framework-mode conventions.
- Design and branding: use [vectreal-brand-ux-design](.agents/skills/vectreal-brand-ux-design/SKILL.md) for token-based styling, brand alignment, intentional UX flows, accessibility, responsive behavior, and high-polish UI execution.
- Iterative delivery: use [vectreal-iterative-delivery](.agents/skills/vectreal-iterative-delivery/SKILL.md) for ambiguity elimination, phased implementation, mandatory implementation→verification→autonomous review→plan alignment loops, exhaustive per-iteration validation, sub-agent-assisted coverage when changes are cross-cutting, and required loop evidence blocks before claiming completion.

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
