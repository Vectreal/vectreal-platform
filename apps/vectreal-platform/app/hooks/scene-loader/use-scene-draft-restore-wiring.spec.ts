/**
 * A restored draft puts its composed settings back into the atoms.
 *
 * A source guard rather than a behavioural test: the hook needs a router, a
 * model context and eight atoms to mount, and the thing worth pinning is a
 * single call that fails silently when it is missing.
 *
 * The write side of the draft was fixed by spreading the settings into the
 * persisted payload, but that only reaches IndexedDB. `useApplySceneSettings` is
 * otherwise called from one place - the route-manifest effect in
 * `use-scene-source.ts` - and a restored draft is an unsaved scene with no
 * manifest. So without this call the draft round-trips through storage intact
 * and is then dropped on the floor at the last step: the author composes
 * hotspots, signs in, comes back, and the scene loads without them.
 *
 * Its limits: it pins that the restore hands the draft's own scene data to the
 * settings applier, not that the atoms then hold any particular value - that is
 * `useApplySceneSettings`' own contract. Renaming either local is meant to fail
 * it; re-point the guard rather than deleting it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
	join(import.meta.dirname, 'use-scene-draft.ts'),
	'utf8'
)

describe('restoring a draft applies its settings', () => {
	it('takes the settings applier', () => {
		expect(source).toContain('useApplySceneSettings()')
	})

	it('hands it the draft scene data, which is a settings object', () => {
		expect(source).toContain('applySceneSettings(draft.sceneData,')
	})

	it('does not adopt the restored draft as the saved baseline', () => {
		// A restored draft has no server row. Adopting it as the last-saved state
		// makes the unsaved-changes check report nothing to save, and the Save
		// button goes dead on the one flow the draft feature exists for.
		expect(source).toContain('{ isSavedBaseline: false }')
	})

	it('applies them only once the model actually loaded', () => {
		// Applying before the `status !== 'ready'` bail would leave the atoms
		// describing a scene the viewer never got.
		expect(source.indexOf("result.status !== 'ready'")).toBeLessThan(
			source.indexOf('applySceneSettings(draft.sceneData,')
		)
	})
})
