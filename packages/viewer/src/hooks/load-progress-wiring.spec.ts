/**
 * The viewer's load progress reaches its loader and its host.
 *
 * A source guard, like `tap-to-activate-wiring.spec.ts`: this runner cannot
 * mount the viewer, so the lines that connect the pieces are read here.
 * `use-load-progress.spec.tsx` owns what the hooks do.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
	join(import.meta.dirname, '..', 'vectreal-viewer.tsx'),
	'utf8'
)

describe('load progress is wired into the viewer', () => {
	it('defaults to the progress loader, not a bare spinner', () => {
		expect(source).toContain('loader: loaderSlot = defaultLoader,')
		expect(source).toMatch(
			/const defaultLoader = \(progress: LoadProgress \| null\) => \(\s*<ViewerLoadProgress progress=\{progress\} \/>/
		)
	})

	it("reads the host's progress while there is no model, then its own", () => {
		expect(source).toMatch(
			/useViewerLoadProgress\(\{\s*hasContent,\s*isLoading: loadingState === 'loading',\s*hostProgress: loadProgress\s*\}\)/
		)
	})

	it('tells the host through the same handler as every other event', () => {
		expect(source).toMatch(
			/useLoadEvents\(\{\s*progress: loadProgressNow,\s*modelIdentity: model \? \(modelKey \?\? model\) : null,\s*emit: handleInteractionEvent\s*\}\)/
		)
	})

	it('draws a function loader from the progress, and a node as it is', () => {
		expect(source).toContain(
			"typeof loaderSlot === 'function' ? loaderSlot(loadProgressNow) : loaderSlot"
		)
	})

	it("measures src's own load", () => {
		expect(source).toContain(
			"loadProgress={loaded.status === 'loading' ? loaded.progress : null}"
		)
	})
})
