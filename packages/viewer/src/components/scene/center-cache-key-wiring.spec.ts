/**
 * `Center` is told when to measure again.
 *
 * A source guard rather than a behavioural test, for the same reason as
 * `hotspot-camera-wiring.spec.ts`: this package's runner loads `.ts` only,
 * because components need a WebGL context.
 *
 * drei's `Center` reads its children's bounding box in a layout effect whose
 * dependency array does not include `children`, and `cacheKey` defaults to a
 * constant. The normalization scale is applied on a group *inside* `Center`, so
 * without a key the offset is measured once on mount and the model is left
 * off-centre the moment normalization is toggled.
 *
 * Two things depend on the key, and neither fails loudly without it. The model's
 * own centering is the visible one. The quiet one is the publisher's hotspot
 * re-anchor, which moves a marker by the ratio of the two normalization scales:
 * that correction is exact only while the centering offset scales with the model
 * (`c = S . c0`), which is only true while `Center` re-measures. Delete the key
 * and every marker on a model not authored at the origin is moved confidently to
 * the wrong place - further from the model than leaving it alone would have been.
 *
 * Its limits: it pins that a key derived from the normalization scale reaches
 * `Center`, not that drei then re-measures. Renaming the local is meant to fail
 * it - re-point the guard rather than deleting it.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
	join(import.meta.dirname, '..', '..', 'vectreal-viewer.tsx'),
	'utf8'
)

describe('the centering offset is re-measured when the model rescales', () => {
	it('derives the key from the same rule that scales the model', () => {
		expect(source).toContain('const centerCacheKey = useMemo(')
		expect(source).toMatch(
			/resolveNormalizedScale\(rawDiagonal, normalizationOptions\)/
		)
	})

	it('hands that key to Center', () => {
		expect(source).toContain('<Center top cacheKey={centerCacheKey}>')
	})

	it('measures in the same render rather than through an effect', () => {
		// Taking the diagonal from `SceneModel`'s callback would put it a render
		// behind the scale `SceneModel` already applied, and `bounds.fit()` would
		// frame a model swap against the previous centering offset.
		expect(source).toContain('setFromObject(model)')
		expect(source).not.toContain('setRawDiagonal')
	})

	it('measures once per model, not per normalization change', () => {
		// `Box3.setFromObject` reads whatever scale the model is already mounted
		// under, so re-measuring when the options change would derive a scale
		// different from the one `SceneModel` holds.
		const measurement = source.slice(
			source.indexOf('const rawDiagonal = useMemo('),
			source.indexOf('const centerCacheKey = useMemo(')
		)

		expect(measurement).toContain('[model]')
		expect(measurement).not.toContain('normalizationOptions')
	})
})
