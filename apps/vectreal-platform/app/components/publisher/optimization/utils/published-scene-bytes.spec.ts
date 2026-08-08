import { resolvePublishedSceneBytes } from './scene-size'

import type { DracoCompressionReport } from '@vctrl/core'

const MB = 1024 * 1024
const KB = 1024

const dracoReport = (
	overrides: Partial<DracoCompressionReport> = {}
): DracoCompressionReport =>
	({
		geometryBytesBefore: 2.77 * MB,
		geometryBytesAfterCompression: 357.22 * KB,
		reductionPercent: 87,
		// Both of these are a writeBinary of the same pre-texture-phase document,
		// so both carry the original 25.81 MB of textures.
		uncompressedGlbBytes: 28.58 * MB,
		projectedGlbBytes: 26.16 * MB,
		isWorthApplying: true,
		...overrides
	}) as DracoCompressionReport

describe('resolvePublishedSceneBytes', () => {
	/**
	 * The reported bug: a 28.58 MB upload whose textures compressed to 258.84 KB
	 * and whose geometry compressed to 357.22 KB was shown as 26.16 MB, "-8%".
	 * The old code returned `projectedGlbBytes` verbatim, which is measured in the
	 * geometry worker before textures are touched, so the entire texture saving
	 * vanished and the delta was nothing but the Draco geometry saving.
	 */
	it('keeps the texture saving in the published size', () => {
		// The post-pass export: textures already compressed, Draco not yet applied.
		const workingSceneBytes = 3.02 * MB

		const published = resolvePublishedSceneBytes(
			workingSceneBytes,
			dracoReport()
		)

		// 3.02 MB working, minus the 2.42 MB whole-file Draco delta.
		expect(published).toBeCloseTo(0.6 * MB, 0)
		expect(published).not.toBeCloseTo(26.16 * MB, 0)
	})

	it('subtracts the whole-file delta, not the per-mesh geometry figures', () => {
		// geometryBytesBefore counts shared accessors once per mesh while
		// geometryBytesAfterCompression counts each once globally, so their
		// difference overstates the saving. Here it would be wildly too large.
		const published = resolvePublishedSceneBytes(
			3.02 * MB,
			dracoReport({
				geometryBytesBefore: 90 * MB,
				geometryBytesAfterCompression: 1 * KB
			})
		)

		expect(published).toBeCloseTo(0.6 * MB, 0)
	})

	it('passes the working size through when Draco is not worth applying', () => {
		expect(
			resolvePublishedSceneBytes(
				3.02 * MB,
				dracoReport({ isWorthApplying: false })
			)
		).toBe(3.02 * MB)
	})

	it('passes the working size through for a texture-only pass', () => {
		expect(resolvePublishedSceneBytes(3.02 * MB, null)).toBe(3.02 * MB)
		expect(resolvePublishedSceneBytes(3.02 * MB, undefined)).toBe(3.02 * MB)
	})

	it('reports nothing when the post-pass export could not be measured', () => {
		expect(resolvePublishedSceneBytes(null, dracoReport())).toBeNull()
	})

	it('never reports a negative size', () => {
		// Padding noise, or a working document smaller than the measured delta.
		expect(
			resolvePublishedSceneBytes(
				1 * KB,
				dracoReport({
					uncompressedGlbBytes: 28.58 * MB,
					projectedGlbBytes: 1 * MB
				})
			)
		).toBe(0)
	})
})
