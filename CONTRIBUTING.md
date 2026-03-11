# Contributing to Vectreal Platform

We love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

> For a complete contribution guide, see **[vectreal.com/docs/contributing](https://vectreal.com/docs/contributing)**.

## We Develop with GitHub

We use GitHub to host code, track issues and feature requests, and accept pull requests.

## All Code Changes Happen Through Pull Requests

Pull requests are the best way to propose changes to the codebase. We actively welcome your pull requests:

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs or added routes/env vars, update the documentation.
4. Ensure the test suite passes: `pnpm nx affected --target=test`
5. Make sure your code lints: `pnpm nx affected --target=lint`
6. Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for your commit messages.
7. Issue that pull request and link relevant issues and labels!

## Working with Nx

1. Always run commands from the repository root.
2. To run packages/apps: `pnpm nx run <project-name>:<target>` (e.g. `pnpm nx serve vectreal-platform`)
3. To see all targets for a project: `pnpm nx show project <project-name> --web`
4. Install the [Nx Console](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console) extension for VS Code for a visual interface.

## Editing documentation

Every docs page on [vectreal.com/docs](https://vectreal.com/docs) is an MDX file in `apps/vectreal-platform/app/routes/docs/`. Click **Edit on GitHub** on any page to jump directly to the source file.

To add a new docs page, see the instructions in [`apps/vectreal-platform/README.md`](apps/vectreal-platform/README.md#docs).

## Any contributions you make will be under the License

In short, when you submit code changes, your submissions are understood to be under the same [GNU Affero General Public License](https://www.gnu.org/licenses/agpl-3.0.en.html) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using GitHub Issues

We use [GitHub Issues](https://github.com/Vectreal/vectreal-platform/issues) to track public bugs. Report a bug by [opening a new issue](https://github.com/Vectreal/vectreal-platform/issues/new).

## Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can.
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## Coding Style

Run `pnpm nx affected --target=lint` to check for lint errors before opening a PR.

## GNU Affero General Public License

By contributing, you agree that your contributions will be licensed under the [GNU Affero General Public License](https://www.gnu.org/licenses/agpl-3.0.en.html).

