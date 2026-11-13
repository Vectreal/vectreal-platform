import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { defineConfig, type Plugin } from 'vitest/config'

/**
 * Resolves `@vctrl/*` to workspace SOURCE, for suites that would otherwise get
 * a build.
 *
 * `packages/*​/node_modules/@vctrl/<name>` and the app's are symlinks into
 * `build/packages/vctrl/`, and node_modules resolution wins over
 * `resolve.tsconfigPaths` - so a suite importing `@vctrl/core` was answered by
 * whatever `nx build` last wrote there. A source change nothing had rebuilt for
 * was invisible, and a green run said nothing about the tree. It was caught
 * because an export added to `@vctrl/core/model-loader` came back `undefined`
 * under the package specifier while the same file had it by relative path.
 *
 * A resolver rather than an alias pattern, because the specifiers are not all
 * the same shape: `@vctrl/hooks/use-load-model` is a directory with an index and
 * `@vctrl/hooks/use-load-model/scene-loaders` is a file, and a single
 * `$1/index.ts` replacement silently mangles the second.
 *
 * Opt-in per project rather than applied here: `@vctrl/viewer` and
 * `@vctrl/embed` pull in CSS and three.js through their entry points, and
 * pointing those at source is a separate question from the one this answers.
 */
export function vctrlSourcePlugin(packages: readonly string[]): Plugin {
	const roots = new Map(
		packages.map((name) => [
			name,
			fileURLToPath(new URL(`packages/${name}/src/`, import.meta.url))
		])
	)

	return {
		name: 'vctrl-workspace-source',
		enforce: 'pre',
		resolveId(source) {
			const match = /^@vctrl\/([^/]+)(?:\/(.+))?$/.exec(source)
			if (!match) return null

			const root = roots.get(match[1])
			if (root === undefined) return null

			const rest = match[2]
			const candidates = rest
				? [`${root}${rest}.ts`, `${root}${rest}.tsx`, `${root}${rest}/index.ts`]
				: [`${root}index.ts`]

			return candidates.find((candidate) => existsSync(candidate)) ?? null
		}
	}
}

const isCI = Boolean(process.env['GITHUB_ACTIONS'])

/**
 * Baseline merged into every project's vitest.config.ts via mergeConfig.
 * Keep project-specific array options (include, exclude, coverage.include) out
 * of here: mergeConfig concatenates arrays, so a base entry can never be
 * overridden per project. `setupFiles` is shared on purpose: every project
 * gets the base setup and adds its own after it. `reporters` and
 * `coverage.reporter` are the other exceptions.
 */
export default defineConfig({
	test: {
		watch: false,
		globals: true,
		// Console output of a passing test is dropped; a failing one keeps it.
		silent: 'passed-only',
		setupFiles: [fileURLToPath(new URL('vitest.setup.mts', import.meta.url))],
		/*
		  CI prints failures only (`minimal`) and annotates them on the pull
		  request (`github-actions`). Locally the default reporter stays, so a
		  run still shows progress.
		*/
		reporters: isCI ? ['minimal', 'github-actions'] : ['default'],
		coverage: {
			enabled: true,
			provider: 'v8',
			/*
			  `text-summary` is four lines; `text` was a table of every file.
			  The full report is in `html`, uploaded by ci-quality.yaml.
			*/
			reporter: ['text-summary', 'html', 'lcov', 'json-summary'],
			reportOnFailure: true
		}
	}
})
