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
		// Through the fade too: `loaded` still shows the loader.
		expect(source).toMatch(
			/useViewerLoadProgress\(\{\s*hasContent,\s*isLoading: loadingState !== 'ready',\s*hostProgress: loadProgress\s*\}\)/
		)
	})

	it('tells the host through the same handler as every other event', () => {
		expect(source).toMatch(
			/useLoadEvents\(\{\s*progress: loadProgressNow,\s*modelIdentity: model \? \(modelKey \?\? model\) : null,\s*emit: handleInteractionEvent\s*\}\)/
		)
	})

	it('draws a function loader as an element, so its fade can end', () => {
		expect(source).toMatch(
			/<ProgressLoader render=\{loaderSlot\} progress=\{loadProgressNow\} \/>/
		)
		expect(source).toContain(
			"typeof loaderSlot === 'function' || Boolean(loaderSlot)"
		)
	})

	it('counts the loader delay from the load, across its two mounts', () => {
		expect(source).toContain(
			'<ViewerLoadClockContext.Provider value={loadStartedAt}>'
		)
		// During render, so a loader mounting with a new load reads its start.
		expect(source).toMatch(
			/if \(loadClock\.state !== loadingState\) \{\s*setLoadClock\(\{\s*state: loadingState,\s*startedAt:\s*loadingState === 'loading' \? Date\.now\(\) : loadClock\.startedAt/
		)
	})

	it("measures src's own load", () => {
		expect(source).toContain(
			"loadProgress={loaded.status === 'loading' ? loaded.progress : null}"
		)
	})
})
