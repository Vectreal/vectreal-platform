/**
 * A failed environment map reaches the people who can act on it.
 *
 * The viewer lights such a scene with a neutral room and nothing on screen
 * fails, so the event is the only signal, and each of its readers is a line
 * that type-checks just as well when it is missing. A source guard, as the
 * viewer's wiring specs are: these are components and a route module, which
 * this runner cannot render with their stores and WebGL. The store's own
 * rule is pinned in `publisher-config-store.spec.ts`, the viewer's in
 * `scene-environment.spec.tsx`, and the SDK's in `embed.spec.ts`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (...path: string[]) =>
	readFileSync(join(import.meta.dirname, '..', ...path), 'utf8')

const viewer = read(
	'..',
	'..',
	'packages',
	'viewer',
	'src',
	'vectreal-viewer.tsx'
)
const publisher = read(
	'app',
	'routes',
	'publisher-page',
	'publisher.$sceneId.tsx'
)
const panel = read(
	'app',
	'components',
	'publisher',
	'sidebars',
	'compose-sidebar',
	'lighting-settings',
	'lighting-settings-panel.tsx'
)
const embedPage = read(
	'app',
	'components',
	'scene-embed',
	'scene-embed-page.tsx'
)

describe('environment_load_failed', () => {
	it('is emitted by the viewer from the environment it renders', () => {
		expect(viewer).toMatch(
			/<SceneEnvironment[^>]*onLoadFailed=\{handleEnvironmentLoadFailed\}/
		)
		expect(viewer).toContain(
			"handleInteractionEvent({ type: 'environment_load_failed', files })"
		)
		expect(viewer).toMatch(/onLoaded=\{handleEnvironmentLoaded\}/)
		expect(viewer).toContain(
			"handleInteractionEvent({ type: 'environment_loaded', files })"
		)
	})

	it('marks the map failed in the publisher, until the viewer loads one', () => {
		expect(publisher).toMatch(
			/event\.type === 'environment_load_failed'\) \{\s*setFailedEnvironmentFiles\(String\(event\.files\)\)\s*\} else if \(event\.type === 'environment_loaded'\) \{\s*setFailedEnvironmentFiles\(null\)/
		)
	})

	it('is shown in the Lighting panel', () => {
		expect(panel).toContain('useAtomValue(environmentLoadFailedAtom)')
		expect(panel).toMatch(/\{environmentLoadFailed && \(\s*<p role="alert"/)
	})

	it('is reported from an embed', () => {
		expect(embedPage).toContain(
			"useErrorReport(environmentFailure, 'client-fallback')"
		)
		expect(embedPage).toMatch(
			/event\.type === 'environment_load_failed'\) \{\s*setEnvironmentFailure\(/
		)
	})
})
