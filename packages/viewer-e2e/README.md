# @vctrl/viewer packaging e2e

Integration test that installs and renders the **published** `@vctrl/viewer`
package the same way a third-party site would, to catch two classes of
regression that unit tests and Storybook miss:

- **Packaging**: bad `external` config, missing runtime deps, broken `exports`
  map, `workspace:*` specifiers leaking into the published manifest, or
  unresolved imports in the tarball. These only surface once the package is
  installed from a registry into a clean project.
- **Runtime crashes**: the viewer failing to mount in a real browser (e.g. a
  hard crash from a bundled dependency, a bad WebGL assumption).

## How it works

`src/run-e2e.ts` orchestrates the whole pipeline:

1. Boots an ephemeral [Verdaccio](https://verdaccio.org/) registry that proxies
   npmjs for transitive deps (`src/registry/config.yaml`).
2. Builds and publishes `@vctrl/core`, `@vctrl/hooks`, and `@vctrl/viewer` to it
   via `nx run <pkg>:copy-md` + `npm publish`.
3. Scaffolds a throwaway Vite + React consumer app from `src/consumer-template`
   into a temp dir and `npm install`s `@vctrl/viewer` (plus peer deps) **from
   the local registry** (no monorepo path aliases, the real tarball).
4. Builds the consumer (fails on any packaging / unresolved-import regression).
5. Serves the build and runs Playwright (`tests/viewer-render.spec.ts`), which
   asserts the viewer mounts and reports no render-time crash.

Everything (registry storage, temp consumer) lives under the OS temp dir and is
wiped on exit. The developer's global npm config and the public registry are
never touched.

## Running it

```bash
pnpm nx run vctrl/viewer-e2e:e2e        # local
pnpm nx run vctrl/viewer-e2e:e2e:ci     # CI (enables retries + HTML report)
```

Requires the Playwright Chromium browser:

```bash
pnpm exec playwright install chromium
```

CI runs this via `.github/workflows/ci-viewer-e2e.yaml` on PRs that touch the
viewer or its workspace dependencies.

## Adding assertions

Extend `tests/viewer-render.spec.ts`. The consumer app
(`src/consumer-template/src/App.tsx`) exposes a `window.__VIEWER_E2E__` flag set
to `mounted` on success or `crashed` (with the error) from both a React error
boundary and the global error handlers in `main.tsx`.
