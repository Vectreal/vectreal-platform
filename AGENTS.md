# Context extensions

Use agent skills available and helpful for the task at hand. When working on the platform app, use react router framework mode best practices

## Project Skills

- Architecture extensions: use [vectreal-extension-architecture](.agents/skills/vectreal-extension-architecture/SKILL.md) for route/layout semantics, modularization, client/server boundaries, Drizzle access patterns, and React Router framework-mode conventions.
- Design and branding: use [vectreal-brand-ux-design](.agents/skills/vectreal-brand-ux-design/SKILL.md) for token-based styling, brand alignment, intentional UX flows, accessibility, responsive behavior, and high-polish UI execution.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors

<!-- nx configuration end-->
