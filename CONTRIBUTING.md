# Contributing to vectreal-core

We love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## We Develop with Github

We use github to host code, to track issues and feature requests, as well as accept pull requests.

## We Use [Github Flow](https://guides.github.com/introduction/flow/index.html), So All Code Changes Happen Through Pull Requests

Pull requests are the best way to propose changes to the codebase. We actively welcome your pull requests:

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Use [Convetional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for your commit messages - here's a [cheet-sheet](https://kapeli.com/cheat_sheets/Conventional_Commits.docset/Contents/Resources/Documents/index).
7. Issue that pull request and link relevant issues and labels!

## Working with NX

When working with this repo and therefore [NX](https://https://nx.dev/getting-started/intro), there is a certain ways to do things.

1. Always stay inside the root of the project when installing packages or running scripts.
2. To run packages/apps use: `npx nx run <project-name>:<the command e.g. build>`
3. To create a new tag and update package versions globally run: `npm run publish-release`
4. When using VSCode the
   [Nx Console extension](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console) may be helpful.

## Any contributions you make will be under the License

In short, when you submit code changes, your submissions are understood to be under the same [GNU Affero General Public License](https://www.gnu.org/licenses/agpl-3.0.en.html) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using Github's [issues](https://github.com/vectreal/vectreal-core/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/vectreal/vectreal-core/issues/new); it's that easy!

## Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can.
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

People _love_ thorough bug reports. I'm not even kidding.

## Use a Consistent Coding Style

- You can try running `npm run lint` for style unification.

## GNU Affero General Public License

By contributing, you agree that your contributions will be licensed under the [GNU Affero General Public License](https://www.gnu.org/licenses/agpl-3.0.en.html).
