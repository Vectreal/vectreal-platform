// @vitest-environment jsdom
/**
 * What the file picker offers, and the one case where it must offer everything.
 *
 * The pattern was hand-written in `@shared/components` and listed `.usda`,
 * which no loader has ever read - so the picker admitted a file the loader then
 * refused. It is derived from `MODEL_FORMATS` now, which is what makes the
 * assertion below a binding one rather than a restatement.
 */
import { renderHook } from '@testing-library/react'
import { modelAcceptPattern } from '@vctrl/core/model-formats'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAcceptPattern } from './use-accept-pattern'

/*
  Assigning `window.innerWidth` directly never comes back. Vitest's jsdom
  environment does not expose the raw jsdom window: `populateGlobal` redefines
  every window key on the Node global as a get/set pair backed by an override
  map, and nothing reverts that map for the rest of the file. So the window
  never returns to its default 1024. The mobile case below needs 375, and that
  was harmless only because it happens to be declared last - reorder the file,
  add a test after it, or run `--sequence.shuffle`, and the other three fail
  with `'*'`. `stubGlobal` is restorable because `unstubAllGlobals` puts the
  saved descriptor back with `defineProperty`, which bypasses the setter.
*/
afterEach(() => {
	vi.unstubAllGlobals()
})

beforeEach(() => {
	/* jsdom has no matchMedia; `useIsMobile` reads it. */
	window.matchMedia = vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn()
	}))
})

describe('the accept pattern is the format owner, rendered', () => {
	it('offers exactly what the owner says is readable', () => {
		const { result } = renderHook(() => useAcceptPattern(false))

		expect(result.current).toBe(modelAcceptPattern())
	})

	it('offers every format the product can read today', () => {
		/*
		  Written out, on purpose, and the only list of formats in this file.

		  The assertion above binds the picker to the owner, which catches a
		  hardcoded attribute - but both sides of it move together, so it cannot
		  catch the owner losing a format. That is what this one is for: a format
		  leaving the owner should be a decision, not a quiet diff.

		  The published pages and the docs now name all six, and the copy they
		  read comes from the owner too - so this is the one place the set is
		  written out by hand, on purpose, and the only thing left to disagree
		  with is the owner itself.
		*/
		const { result } = renderHook(() => useAcceptPattern(false))

		const parts = result.current.split(',')

		/*
		  Members, not substrings, because an extension can hide inside a media
		  type: `.usdz` sits inside `model/vnd.usdz+zip`, so a `toContain` over the
		  whole string passed even with the extension removed. USDZ is no longer
		  offered at all - it is asserted absent below - but the trap it exposed
		  applies to every row here.
		*/
		expect(parts).toContain('.glb')
		expect(parts).toContain('.gltf')
		expect(parts).toContain('.stl')
		expect(parts).toContain('.fbx')
		expect(parts).toContain('.obj')
		/* An OBJ's material library, which is useless to select without. */
		expect(parts).toContain('.mtl')
	})

	it('claims no format the loader cannot read', () => {
		const { result } = renderHook(() => useAcceptPattern(false))

		/*
		  `.usda` was offered here with no loader behind it, which is what the
		  owner was written to end, and it is still the case: nothing in this
		  repo has ever read one.

		  `.fbx` and `.obj` stood beside it until their bridges landed, as the
		  assertion that would go red the day the picker claimed a format the
		  loader could not read. They moved up into the list above rather than
		  being deleted, which is the whole point of the pair of tests: this one
		  falls as a format lands, and that one catches it if it lands here
		  without a loader behind it.

		  `.usdz` went the other way, and is the first to do so: it was offered
		  for as long as this file has existed, and there has never been a USDZ
		  reader behind it. It is asserted on `parts` rather than on the whole
		  string for the reason the test above records - the extension is a
		  substring of `model/vnd.usdz+zip`, so `not.toContain` over the string
		  passes while the picker still offers it.
		*/
		const parts = result.current.split(',')

		expect(parts).not.toContain('.usdz')
		expect(parts).not.toContain('model/vnd.usdz+zip')
		expect(result.current).not.toContain('.usda')
		expect(result.current).not.toContain('.3mf')
	})

	it('drops the pattern entirely on a phone', () => {
		/*
		  Not a simplification: iOS filters a `.glb` out of the picker when the
		  attribute is set, so a reader holding the right file cannot select it.
		  A wrong file is caught by the loader; an unselectable right one leaves
		  no way forward from inside the app.

		  Driven through `innerWidth` with the argument set to `false`, which is
		  the only combination that discriminates. `useIsMobile(true)` seeds its
		  state to `true`, so passing `true` here returned `'*'` from the very
		  first render and the test passed for a hook that had stopped reading
		  the viewport at all - it survived deleting the width read from the
		  mount effect. Starting from `false` means only the effect can get it
		  there.
		*/
		vi.stubGlobal('innerWidth', 375)
		const { result } = renderHook(() => useAcceptPattern(false))

		expect(result.current).toBe('*')
	})
})
