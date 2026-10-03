/**
 * The environment map is prefetched from the same URL the scene loads it from.
 *
 * A source guard, like `idle-convergence-wiring.spec.ts`: components need a
 * WebGL context this runner does not have. drei caches a loaded environment by
 * its URL, so a prefetch only helps if it asks for exactly the file
 * `<Environment>` will ask for; both resolve it through
 * `resolveEnvironmentFiles`, whose output `@vctrl/core` tests.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const environment = readFileSync(
	join(import.meta.dirname, 'scene-environment.tsx'),
	'utf8'
)
const viewer = readFileSync(
	join(import.meta.dirname, '..', '..', 'vectreal-viewer.tsx'),
	'utf8'
)

describe('environment prefetch', () => {
	it('loads the scene environment from the shared URL rule', () => {
		expect(environment).toContain(
			'files={resolveEnvironmentFiles(environment)}'
		)
	})

	it('prefetches the same file, and only once a surface names one', () => {
		expect(viewer).toMatch(
			/const environmentFiles = envOptions\s*\?\s*resolveEnvironmentFiles\(envOptions\)\s*:\s*null/
		)
		expect(viewer).toMatch(
			/useEffect\(\(\) => \{\s*if \(environmentFiles\) preloadEnvironmentFiles\(environmentFiles\)\s*\}, \[environmentFilesKey\]\)/
		)
		expect(environment).toContain('useEnvironment.preload({ files })')
	})
})
