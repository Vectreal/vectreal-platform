import { defineConfig } from 'vitest/config'

/**
 * Baseline merged into every project's vitest.config.ts via mergeConfig.
 * Keep array-valued options (include, exclude, setupFiles, coverage.include)
 * out of here: mergeConfig concatenates arrays, so a base entry can never be
 * overridden per project. `reporters` is the deliberate exception.
 */
export default defineConfig({
	test: {
		watch: false,
		globals: true,
		reporters: ['default'],
		coverage: {
			enabled: true,
			provider: 'v8',
			reporter: ['text', 'html', 'lcov', 'json-summary'],
			reportOnFailure: true
		}
	}
})
