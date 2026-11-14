# CI, deploy and tooling report (2026-11-13)

A report for Moritz to decide row by row. Measured on the runs named in each section. Proposals Moritz has approved so far are open as PRs: Nx cache #1361, production gate skip #1362, production-only image #1367, soft route budgets #1372. Splitting the gate into parallel jobs follows once #1361 and #1367 merge. Nx Cloud is out.

## CI and deploy speed (measured 2026-11-13)

Ranked items 1 to 4 below are approved; 5 is out.

### Where the time goes today

| Pipeline | Wall time | Critical path |
| --- | --- | --- |
| PR / main Quality Gate | 260 to 414 s (last 3 main runs) | "Run affected quality targets" step, 206 to 324 s. Everything else is under 25 s per step |
| Integration Tests (parallel to the gate) | 102 to 137 s | 50 to 69 s is pulling the Postgres container. Never the slowest job, so it costs no wall time |
| Staging deploy (after main gate) | migrate 33 to 42 s, deploy 276 to 412 s | Docker "Build and push" 194 to 288 s, Fly push and release 54 to 84 s |
| Production deploy (manual) | 11 to 16 min | Re-runs the whole gate (about 323 s, every target on every project), then migrate 50 s, deploy 296 s |

Inside one gate run (main, run 43473000429) the four Nx targets share one 4-vCPU runner and finish at: lint +0:48, typecheck +2:25, build-ci +3:51, test +5:24. **Tests are the critical path.**

Inside the staging Docker build (run 43483181527, lockfile unchanged so the deps layer was cached):

| Docker step | Time |
| --- | --- |
| Pull the cached `deps` layer (full node_modules, dev deps included) into the build stage | 63.5 s |
| `nx build-ci` again (CI already built and budget-checked this commit) | 102.6 s |
| Pull the same node_modules again into the runner stage | 48.5 s |
| Export, push to GHCR, write GHA cache | about 25 s |

Local, uncached, sequential (Apple M4, 10 cores): lint 37 s, typecheck 66 s, test 143 s, build-ci 75 s across all projects. vectreal-platform alone: test 97 s with coverage, **72 s without** (coverage costs about 25%), build-ci 37 s, typecheck 23 s, lint 9 s. Lint is cheap; replacing ESLint would not speed CI up noticeably.

### Findings

1. **The Nx cache in CI never served a task.** (Corrected after measuring, PR #1361.) Nx 23 keeps its cache and the database indexing it under `~/.nx/<id>/`, so restoring the repo's `.nx/cache` did nothing at all. On top of that, the key changed only with the lockfile, so it was never saved again. Measured fix: the rerun of a commit went from 0/24 to 12/24 hits, and the gate job from 6 min 37 s to 3 min 46 s. `typecheck` and `build-ci` aren't cacheable at all (the `nx.json` default names an executor no project uses), which is the other half of the tasks.
2. **Production runs the full gate on a commit that already passed it on main.** Through `workflow_call` there is no affected range, so it falls back to `run-many` over everything.
3. **Docker repeats `build-ci`** and twice imports a node_modules layer that includes dev dependencies, once to build and once to ship it. The runner image carries dev dependencies to Fly.
4. **Coverage is collected on every PR and only uploaded as an artifact.** There are no thresholds, so nothing gates on it. (Always-on coverage was a deliberate choice in #700; flagging it, not reversing it.)

### Ranked proposals

| # | Change | Saves | Effort | Notes |
| --- | --- | --- | --- | --- |
| 1 | Production skips the gate when every main commit since the last production deploy has a green CI - Quality run (#1362) | 323 to 439 s per production deploy when it applies | S | One green run for the deployed SHA is not enough: a push run checks only what is affected since the previous push, so a cancelled or path-filtered run earlier on main left a commit unchecked. Replayed on the last 7 deploys, only 1 would have skipped, because main runs were routinely cancelled. #1362 also stops cancelling main runs and drops the push paths filter |
| 2 | Make the CI Nx cache work (#1361) | Measured: a rerun went from 0/24 to 12/24 cache hits, gate job 6 min 37 s to 3 min 46 s | XS | The real bug was the directory, not only the key (see finding 1). Capped with `NX_MAX_CACHE_SIZE=500MB`. Follow-up: make `typecheck` and `build-ci` cacheable |
| 3 | Runner image with production dependencies only (#1367) | Measured: image 1.67 GB to 801 MB. Deploy time to be measured on the first staging deploy | M | The image build now resolves every server import against the production dependencies and fails if one is missing |
| 4 | Split the gate into parallel jobs (lint, typecheck, build-ci, test), each on its own runner | about 1 to 1.5 min per PR and main push (test stops competing for 4 vCPU; each job pays about 40 to 60 s of setup) | S to M | Free on a public repo. Estimate, not measured |
| 5 | Remote Nx cache so main and production reuse what the PR already computed (GitHub caches from PR refs are not readable from main). **Out, per Moritz** | up to 4 to 5 min per main push when the PR was up to date, plus item 1's gate if not done | S, but needs an account and a secret | Nx Cloud Hobby is free with 50K credits/month; Team from $29/month (nx.dev/pricing). `@nx/s3-cache` 5.0.7 declares `nx >=18 <23`, so it does not support our Nx 23.3.1. Community `@op-nx/github-cache` exists, unvetted. Moritz decides on the external service |
| 6 | Coverage only on main, off on PRs | about 1 min per PR | XS | Reverses part of #700; only if nobody reads PR coverage artifacts |
| 7 | Build once on the deploy runner and `COPY` the output into a runtime-only image | about 40 to 60 s per deploy | M | Smaller than it looks: the image build needs the PostHog build args the gate does not have, so the gate's build cannot be reused as is. Do after 3 |
| 8 | pnpm store cache mount in Docker (`--mount=type=cache` plus `buildkit-cache-dance` to persist it in Actions) | only helps when the lockfile changes | S | Low value: the deps layer is already GHA-cached on unchanged lockfiles |
| 9 | Faster integration DB startup | 0 min wall time | - | Not on the critical path. Skip |

Also seen once: a 7-minute queue gap between migrate and deploy on staging. Runner availability, not our config.

Sources: nx.dev/pricing; npm registry metadata for `@nx/s3-cache` 5.0.7 (peerDependencies); docs.docker.com/build/ci/github-actions/cache (cache mounts need buildkit-cache-dance); pnpm.io/docker. Run timings from `gh run view --log` on the runs named above.

## Toolchain (checked 2026-11-13)

| Item | Finding | Recommendation | Effort |
| --- | --- | --- | --- |
| **TypeScript 7 for typecheck, beside TS 6** | TS 7.0 went GA on 8 Jul 2026; `typescript@latest` is 7.0.2 on npm, the repo pins 6.0.3. **Measured on vectreal-platform** (local M4, same files, after `react-router typegen`): `tsconfig.app.json` 10.7 s → 5.0 s, `tsconfig.spec.json` 13.1 s → 1.9 s, **23.8 s → 6.9 s**, zero errors on both. TS 7 refuses our config as is: it removed `baseUrl` and `esModuleInterop: false`, and `paths` must start with `./`. I measured with a temporary config that only rewrote those three. `typescript-eslint` 8.72.1 requires TypeScript below 6.1, and TS 7's programmatic API arrives in 7.1, so ESLint has to keep TS 6 | **Yes, for the `typecheck` targets only**: add TS 7 under an alias (`"typescript7": "npm:typescript@7.0.2"` in the catalog), point `typecheck` at its `tsc`, and keep `typescript@6` for ESLint, Vite and the editor until 7.1. First, move `tsconfig.base.json` off `baseUrl` (relative `paths`), which TS 6 accepts too, and decide `esModuleInterop` (removing it means `true`, which changes default-import emit in non-bundled code, so check the published packages). CI gain is small today, because typecheck isn't on the critical path (tests are). The gain is in the local and agent edit loop | M |
| **Oxlint (type-aware)** | Oxlint is stable (1.0, Jun 2025); type-aware linting went stable on 22 Jul 2026 via tsgolint v7 (59 of typescript-eslint's 61 typed rules). Our ESLint uses **no** typed rules. Covered by Oxlint: react, react-hooks (`rules-of-hooks`, `exhaustive-deps`), import order, unused vars. **Not covered:** `@nx/dependency-checks` over every package.json (the rule CLAUDE.md leans on), the repo's `no-restricted-syntax` selector rules (z-index scale, `text-primary`, `cn()` misuse), and markdown/JSON linting. `@nx/enforce-module-boundaries` isn't configured at all today. Lint takes 37 s across all projects locally, 9 s for the platform | **Not now.** It would mean running both linters (Oxlint plus a reduced ESLint for the rules above) for a 37 s target that isn't on the critical path. Revisit if Oxlint's JS plugin support (alpha since Mar 2026) can host `@nx/dependency-checks` and the selector rules | - |
| **Prettier vs oxfmt** | oxfmt is at 0.72.0 (5 Oct 2026), not 1.0. Prettier's check is 16 to 25 s in CI | **Prettier stays**, per the rule (switch only at oxfmt 1.0) | - |
| **`nx configure-ai-agents` and the Nx MCP server** | The command writes the MCP server config (`npx nx mcp` on Nx 21.4+), AGENTS.md/CLAUDE.md sections and Nx's agent skills. The repo already vendors one Nx skill (`.github/skills/monitor-ci`) and has the Nx MCP plugin available in sessions | **Recommendation only (the agent-setup session owns this).** Run it in a branch and diff before adopting: it edits CLAUDE.md and AGENTS.md, which this repo curates by hand. Take the MCP entry, and drop the vendored `monitor-ci` scripts in favor of the plugin's | S (owner: agent-setup session) |
| **Nx Cloud** | Hobby is free with 50K credits/month, Team from $29/month (nx.dev/pricing). PR #1361 makes the local cache work across runs without it | Out, per Moritz | - |
| **Agent docs** (CLAUDE.md 246 lines, AGENTS.md 40) | Recommendation only (the agent-setup session owns these files). CLAUDE.md carries generic Nx guidance (about 25 lines) that `configure-ai-agents` or the Nx skills already provide, plus long architecture paragraphs (billing, auth, dashboard mutations) that read as rules but describe code | Cut the generic Nx block in favor of the Nx skills. Move the billing and dashboard-mutation paragraphs into the `vectreal-extension-architecture` skill, where they load only when relevant. Keep the commands, the root-cause rule, the stacking and viewport rules (each prevents a known bug) and the skills table. **"Verify like CI" command: yes.** A root `pnpm verify` running `prettier --check .` plus `nx affected -t lint,typecheck,test,build-ci` with CI's env placeholders would replace the scattered notes on how CI differs from local runs. It's cheap and removes a whole class of "passed locally" reports | S |

Sources: [TypeScript 7 GA (Visual Studio Magazine)](https://visualstudiomagazine.com/articles/2026/07/08/typescript-7-arrives-to-rock-vs-code-with-go-powered-speed.aspx), [InfoQ](https://infoq.com/news/2026/08/typescript-7-released/), npm dist-tags for `typescript` and the peer range of `typescript-eslint` 8.72.1; [Oxc: type-aware linting stable](https://oxc.rs/blog/2026-07-22-type-aware-linting-stable), [Oxlint 1.0](https://oxc.rs/blog/2025-06-10-oxlint-stable), [Oxc release notes](https://releasebot.io/updates/oxc) for oxfmt 0.72.0; [Nx AI setup](https://nx.dev/docs/getting-started/ai-setup), [Nx MCP reference](https://nx.dev/docs/reference/nx-mcp); [nx.dev/pricing](https://nx.dev/pricing).

## Scripts and inline workflow shell (inventory 2026-11-13)

One row per script file and per inline workflow `run:` block over 10 lines. "Used by" comes from `git grep` on the file name across the repo (docs excluded) and the last commit date. Effort: XS under an hour, S half a day, M one to two days, L more.

### Scripts

| Script | Lines | What it does | Used by | Recommendation | Effort |
| --- | --- | --- | --- | --- | --- |
| `terraform/scripts/setup-fly-secrets.sh` | 662 | Syncs 17 Fly app secrets, the Supabase auth hooks (send_email, custom_access_token), the OAuth 2.1 server settings and the CLI's OAuth client, for staging and prod. `--verify` is a read-only drift gate | `cd-platform-secrets.yaml` (CI), `shared-supabase-migrate.yaml`, by hand | **Split by owner.** The auth hook and OAuth server settings go to Terraform: the official Supabase provider (v1.11.1, 6 Nov 2026) has `supabase_settings.auth` as JSON for `updateV1AuthConfig`, the same API the script calls, with hook secrets marked sensitive. Terraform state then holds those secrets, so the GCS state bucket's access needs a look first. Fly secrets stay scripted: Fly's Terraform provider was archived on 1 Mar 2024 and calls itself not recommended. Cut that part to a `flyctl secrets import` from the manifest plus the `--verify` diff. The CLI OAuth client goes through the Auth admin API, which no provider covers, so it stays in `cli-oauth-client.sh` | L |
| `apps/vectreal-platform/scripts/check-route-js-budget.ts` | 157 | After the build, walks each public route's static import graph from React Router's manifest (entry + layouts + route + static imports, gzipped) against per-route KB budgets. Fails on three.js or newsroom bodies reaching a route statically. Also budgets the embed | `build-ci` | **Keep the script; don't switch to size-limit.** size-limit 14.3.0 (Oct 2026) and bundlewatch 1.2.0 budget files or globs. They can't follow a route's layout chain through the RR manifest, and they have no forbidden-module check, which is the part that has caught real leaks. Its maintained GitHub Action (`andresz1/size-limit-action`) was last pushed Jun 2024. **Policy:** soft per-route budgets are #1372 (warning plus summary line, hard ceiling at 1.5x the budget so the forbidden-module check catches leaks and nobody contorts code to squeeze under a number). A budget is raised only with a stated reason and Moritz's OK. Re-derive the numbers from a load target instead of "a little above what we measured": Alex Russell's P75 device and network baseline is about 300 to 365 KiB of gzipped JS for the whole page, and our marketing routes sit at 389 to 400 KB, already above it. Unverified against his own post for 2026; check infrequently.org first. Add a spec for the graph walk: it has none | S (soft PR), M (re-derive) |
| `apps/vectreal-platform/scripts/check-news-body-chunks.ts` | 62 | Fails the build when a newsroom article body chunk isn't named the way `server.mjs`'s scheduled-article gate expects | `build-ci` | Keep. It guards a real production rule (scheduled articles withheld until `publishedAt`) | - |
| `apps/vectreal-platform/scripts/timing.ts`, `timing-run.ts`, `timing-log.ts` | 184 + 545 + 191 | The 8-product timing run: photos in, a Publisher scene out, cleanup minutes logged per object as CSV | Nx target `timing`; `timing-log` has a spec | Keep while the timing study runs. `timing-run.ts` at 545 lines has no spec and drives a browser; fine for a one-off study. Delete all three when the study ends | - |
| `apps/vectreal-platform/scripts/capture-home-product-shots.ts` | 428 | Captures the home page product window views in both themes with Playwright | Nx target `capture-product-shots`; output read by `product-shots.spec.ts` | Keep (asset pipeline, run by hand) | - |
| `apps/vectreal-platform/scripts/gen-newsroom-thumbnails.ts` | 314 | Bakes newsroom card and og images | Nx target `gen-thumbnails` | Keep. Last touched Sep 2026; confirm it still runs before the next article batch | - |
| `apps/vectreal-platform/scripts/bake-home-hero.ts`, `bake-share-cards.ts`, `render-lighting-thumbnails.ts` | 158 + 121 + 116 | Bake static images from live dev-server renders | Nx targets; `render-lighting-thumbnails` has a spec | Keep (asset pipeline) | - |
| `apps/vectreal-platform/scripts/encode-environment-gainmaps.ts` (+ `encode-page.ts`, `index.html`) | 176 + 63 + 10 | Encodes gain-map JPEGs for hosted HDRs and writes their byte sizes into `@vctrl/core` | Nx target; calls the two terraform upload scripts | Keep | - |
| `apps/vectreal-platform/scripts/measure-environment-lights.ts` | 251 | Finds the lights in each HDR and writes `ENVIRONMENT_LIGHTS` into `@vctrl/core` | Nx target | Keep | - |
| `apps/vectreal-platform/scripts/normalize-generated-model.ts`, `normalize-in-browser.ts` | 102 + 63 | Normalizes one generated model (ground, scale, Draco, WebP, GLB + USDZ under 15 MB) through the dev server's `/__normalize` page | Nx target | Keep | - |
| `apps/vectreal-platform/scripts/purge-orphaned-assets.ts` | 308 | Reports, and on request deletes, unreachable assets | Nx target, by hand | Keep. Its reachability rule lives in `asset-reclaim.server.ts`, which is the right owner | - |
| `apps/vectreal-platform/scripts/backfill-asset-names.ts` | 286 | One-time rename of stored assets to their glTF names | Nx target | **Delete** if the backfill ran on prod (Sep 2026). A one-time DML script left in the tree reads as maintained. Confirm with Moritz | XS |
| `apps/vectreal-platform/scripts/purge-model-intake.ts` | 81 | Deletes free-model requests, photos and letter codes past retention | `cd-purge-model-intake.yaml` (scheduled) | Keep | - |
| `apps/vectreal-platform/scripts/generate-intake-qr.ts` | 197 | Prints QR codes for the free-model letters | Nx target | Keep | - |
| `apps/vectreal-platform/scripts/register-local-cli-client.sh` | 30 | Registers the CLI OAuth client on the local Supabase stack | Nx target; shares `lib/cli-oauth-client.sh` | Keep | - |
| `terraform/scripts/lib/cli-oauth-client.sh` | 101 | The CLI OAuth client's name, redirect URIs and register functions, sourced by both callers | the two scripts above | Keep (single owner of the redirect URIs) | - |
| `terraform/scripts/setup-modal-secrets.sh` | 100 | Creates the Modal secret for the image-to-3D runtime and stores the Modal CI token in GitHub | by hand | Keep. No maintained Modal Terraform provider that I know of; not checked | - |
| `terraform/scripts/compress-environment-maps.sh`, `upload-environment-gainmaps.sh` | 90 + 77 | Set cache headers and upload gain maps to the public `environment-maps` bucket | by hand, after the encode script | Keep. Could fold into the encode Nx target as one command | XS |
| `terraform/scripts/apply-infrastructure.sh` | 71 | Interactive local `terraform init/plan/apply` wrapper with emoji prompts | `terraform/project.json`, self-hosting docs | **Replace** with the Terraform GitHub Actions workflow Moritz already prefers (CI-managed infra). Keep only if self-hosters need it, since the docs page points at it | S |
| `.github/scripts/health-check.sh` | 45 | Curl retry loop against a health URL | **Nothing.** `shared-fly-deploy.yaml` inlines its own 12-line copy | **Delete**, or have the deploy call it instead of the inline copy. One owner either way | XS |
| `.github/skills/monitor-ci/scripts/*.mjs` | 428 + 160 | The Nx `monitor-ci` agent skill's poll and state scripts (vendored) | The skill only | Agent setup, owned by the agent-setup session: recommendation only. Vendored plugin code should come from the Nx plugin, not the repo | - |

### Inline workflow shell over 10 lines

| Workflow / step | Lines | What it does | Recommendation | Effort |
| --- | --- | --- | --- | --- |
| `cd-packages-release.yaml` / Diagnostics - npm trusted publishing context | 50 | Prints OIDC and npm context for debugging trusted publishing | **Delete** now that OIDC publishing works, or gate it behind `runner.debug`. It never fails the job | XS |
| `cd-packages-release.yaml` / Build package-grouped root release notes | 48 | Rewrites the root GitHub release body grouped by package from release-please outputs | Move into a tested script (`.github/scripts/`, with a spec feeding sample outputs). Release notes are user-facing and nothing checks this today | S |
| `cd-packages-release.yaml` / Guard - no unresolved specifiers in the packed tarballs | 25 | Fails publish if a packed tarball still has `workspace:` or `catalog:` | Keep; it guards a real past leak. Could move to a script beside the publish config | XS |
| `cd-packages-release.yaml` / Publish packages to npm | 13 | Idempotent publish per package | Keep | - |
| `cd-packages-release.yaml` / Download and verify mcp-publisher | 12 | Downloads and checksums the MCP Registry publisher | Keep | - |
| `cd-packages-release.yaml` / Publish @vctrl/cli to the MCP Registry | 16 | Idempotent MCP Registry publish | Keep | - |
| `cd-platform-secrets.yaml` / Sync | 22 | Calls `setup-fly-secrets.sh` with per-environment values | Follows the secrets row above | - |
| `ci-dependabot-auto-merge.yaml` / Decide | 15 | Auto-merges npm patch and minor, holds billing, routing, rendering and auth packages for a person | Keep. Dependabot has no native "hold these names" for auto-merge | - |
| `ci-mirror-node-image.yaml` / Copy image | 30 | Registry-to-registry copy of `node:22-alpine` into GHCR (dry run on PRs) | Keep. It's the fix for the Docker Hub and ECR 429s | - |
| `ci-quality.yaml` / Resolve affected range | 21 | Picks base and head for `nx affected` per event | **Replace** with `nrwl/nx-set-shas` (the Nx-maintained action for exactly this). It also handles the push case better, using the last successful main run as base instead of `event.before`, which closes the cancelled-run gap PR #1362 works around | S |
| `shared-fly-deploy.yaml` / Health check | 12 | Curl retry loop, warn or fail | Use the one `.github/scripts/health-check.sh` (see above) | XS |

Sources: [Supabase Terraform provider settings docs](https://github.com/supabase/terraform-provider-supabase/blob/main/docs/resources/settings.md) and its releases; [fly-apps/terraform-provider-fly](https://github.com/fly-apps/terraform-provider-fly) (archived); npm metadata for size-limit, @size-limit/file and bundlewatch; GitHub metadata for andresz1/size-limit-action; [The Performance Inequality Gap](https://infrequently.org/2022/12/performance-baseline-2023) series (the 300 to 365 KiB figure came via a secondary summary and needs checking against the 2024+ post).
