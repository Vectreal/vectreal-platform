import { describe, expect, it } from 'vitest'

import {
	BAKE_SKIP_REASONS,
	failuresToReport,
	failWith,
	skippedByReason,
	nothingCaption,
	lightBakeWarning,
	occlusionBakeWarning,
	STUDIO_FINISH_FAILURES,
	StudioFinishError,
	studioFinishFailure
} from './studio-finish-reasons'
import { WorkerRunError } from '../../../../workers/run-worker'

describe('studioFinishFailure', () => {
	it('keeps the reason a step already gave its failure', async () => {
		const step = Promise.reject(new Error('readPixels failed'))
		const thrown = await step.catch(failWith('unprepared')).catch((e) => e)

		expect(thrown).toBeInstanceOf(StudioFinishError)
		expect(studioFinishFailure(thrown)).toEqual({
			reason: 'unprepared',
			detail: 'readPixels failed'
		})
	})

	it('reads a timeout and a crash by how the worker ended, not its words', () => {
		expect(
			studioFinishFailure(new WorkerRunError('timed-out', 'whatever'))
		).toEqual({ reason: 'timed-out', detail: 'whatever' })
		expect(
			studioFinishFailure(new WorkerRunError('crashed', 'Uncaught RangeError'))
		).toEqual({ reason: 'worker-stopped', detail: 'Uncaught RangeError' })
	})

	it('calls anything else unexpected, keeping its words for the log', () => {
		expect(studioFinishFailure(new Error('Draco encoder failed'))).toEqual({
			reason: 'unexpected',
			detail: 'Draco encoder failed'
		})
		expect(
			studioFinishFailure(new WorkerRunError('undeserializable', 'x'))
		).toMatchObject({ reason: 'unexpected' })
	})
})

describe('the words for each reason', () => {
	const all = [
		...Object.values(STUDIO_FINISH_FAILURES).map(({ message }) => message),
		...Object.values(BAKE_SKIP_REASONS)
	]

	it('are short sentences in sentence case, with no raw error in them', () => {
		for (const message of all) {
			expect(message).toMatch(/^[A-Z].*\.$/)
			expect(message.length).toBeLessThanOrEqual(110)
			expect(message).not.toMatch(/[!—]/)
		}
	})
})

describe('failuresToReport', () => {
	it('reports a browser without WebGL 2 and bugs, not what the author can fix', () => {
		expect(
			failuresToReport({
				failure: { reason: 'gpu-reset', detail: 'reset' },
				reports: {
					occlusion: { failed: 'no-webgl', detail: 'no context' },
					lights: { failed: 'unexpected', detail: 'bug' }
				}
			})
		).toEqual([
			{ reason: 'no-webgl', detail: 'no context' },
			{ reason: 'unexpected', detail: 'bug' }
		])
	})

	it('reports a stopped worker, which may be a failed load or a bug', () => {
		expect(
			failuresToReport({
				failure: { reason: 'worker-stopped', detail: '' }
			})
		).toEqual([{ reason: 'worker-stopped', detail: '' }])
	})

	it('has nothing to report for bakes that worked', () => {
		expect(
			failuresToReport({
				reports: { occlusion: { baked: ['body'], skipped: [] } }
			})
		).toEqual([])
		expect(failuresToReport({})).toEqual([])
	})
})

describe('occlusionBakeWarning', () => {
	it('stays quiet for a material that kept its own occlusion map', () => {
		expect(
			occlusionBakeWarning({
				baked: ['body'],
				skipped: [{ material: 'tyre', reason: 'existing-occlusion' }]
			})
		).toBeNull()
	})

	it('counts the materials that missed out and names the first', () => {
		expect(
			occlusionBakeWarning({
				baked: [],
				skipped: [
					{ material: 'tyre', reason: 'existing-occlusion' },
					{ material: 'wheel', reason: 'shared-geometry' },
					{ material: 'decal', reason: 'tiling-uvs' }
				]
			})
		).toEqual({
			message: "2 materials could not take the studio finish's depth.",
			description: 'wheel: Used more than once. Make each copy its own mesh.'
		})
	})

	it('explains a failed bake by its reason, not by the error behind it', () => {
		expect(
			occlusionBakeWarning({ failed: 'gpu-reset', detail: 'GL_CONTEXT_LOST' })
		).toEqual({
			message:
				'The studio finish could not add depth, so the scene was published without it.',
			description: STUDIO_FINISH_FAILURES['gpu-reset'].message
		})
	})

	it('says nothing when no bake was asked for', () => {
		expect(occlusionBakeWarning(undefined)).toBeNull()
	})
})

describe('lightBakeWarning', () => {
	it('says the scene shipped with live lights when the bake failed', () => {
		expect(
			lightBakeWarning({
				failed: 'no-webgl',
				detail: 'Error creating WebGL context.'
			})
		).toEqual({
			message:
				'The studio finish could not draw the studio lights, so the scene was published with them live.',
			description: STUDIO_FINISH_FAILURES['no-webgl'].message
		})
	})

	it('counts the materials that kept live lights and names the first', () => {
		expect(
			lightBakeWarning({
				baked: ['body'],
				skipped: [{ material: 'wheel', reason: 'double-sided' }]
			})
		).toEqual({
			message:
				"1 material could not take the studio finish's lights and keeps them live.",
			description: 'wheel: Double-sided. Make it single-sided to bake light.'
		})
	})

	it('stays quiet when everything took the bake, or nothing was asked', () => {
		expect(lightBakeWarning({ baked: ['body'], skipped: [] })).toBeNull()
		expect(lightBakeWarning(undefined)).toBeNull()
	})
})

describe('skippedByReason', () => {
	it('merges the materials that share a reason, most materials first', () => {
		expect(
			skippedByReason({
				baked: [],
				skipped: [
					{ material: 'Logo', reason: 'tiling-uvs' },
					{ material: 'Body', reason: 'no-uv0' },
					{ material: 'Sole', reason: 'no-uv0' }
				]
			})
		).toEqual([
			{ reason: 'no-uv0', materials: ['Body', 'Sole'] },
			{ reason: 'tiling-uvs', materials: ['Logo'] }
		])
	})

	it('counts a material both bakes skipped for one reason once', () => {
		const skipped = [{ material: 'Body', reason: 'no-uv0' as const }]
		expect(
			skippedByReason(
				{ baked: [], skipped },
				{ baked: [], skipped },
				{ failed: 'gpu-reset', detail: 'x' },
				undefined
			)
		).toEqual([{ reason: 'no-uv0', materials: ['Body'] }])
	})
})

describe('nothingCaption', () => {
	it('names the reason most materials share, and how many', () => {
		expect(
			nothingCaption({
				occlusion: {
					baked: [],
					skipped: [
						{ material: 'Logo', reason: 'tiling-uvs' },
						{ material: 'Body', reason: 'no-uv0' },
						{ material: 'Sole', reason: 'no-uv0' },
						{ material: 'Laces', reason: 'no-uv0' }
					]
				},
				lights: {
					baked: [],
					skipped: [{ material: 'Logo', reason: 'tiling-uvs' }]
				}
			})
		).toBe(`3 materials: ${BAKE_SKIP_REASONS['no-uv0']}`)
	})

	it('speaks of one material as one', () => {
		expect(
			nothingCaption({
				occlusion: {
					baked: [],
					skipped: [{ material: 'Logo', reason: 'unlit' }]
				}
			})
		).toBe(`1 material: ${BAKE_SKIP_REASONS.unlit}`)
	})

	it('names a failed bake before what was skipped', () => {
		expect(
			nothingCaption({
				occlusion: { failed: 'no-webgl', detail: 'x' },
				lights: {
					baked: [],
					skipped: [{ material: 'Body', reason: 'no-uv0' }]
				}
			})
		).toBe(STUDIO_FINISH_FAILURES['no-webgl'].message)
	})

	it('has no caption when nothing failed or was skipped', () => {
		expect(
			nothingCaption({ occlusion: { baked: [], skipped: [] } })
		).toBeUndefined()
		expect(nothingCaption(undefined)).toBeUndefined()
	})
})
