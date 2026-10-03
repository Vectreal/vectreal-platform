import { IMPORTABLE_FORMAT_LABELS } from '@vctrl/core/model-formats'
import { describe, expect, it } from 'vitest'

import {
	buildTidbits,
	pickTidbit,
	type DashboardFacts,
	type TidbitId
} from './dashboard-tidbits'

const MB = 1024 * 1024

const facts = (over: Partial<DashboardFacts> = {}): DashboardFacts => ({
	sceneCount: 3,
	projectCount: 2,
	publishedCount: 0,
	initialBytes: 0,
	currentBytes: 0,
	measuredSceneCount: 0,
	verticesBefore: 0,
	verticesAfter: 0,
	biggestCut: null,
	...over
})

const ids = (input: DashboardFacts): TidbitId[] =>
	buildTidbits(input).map((tidbit) => tidbit.id)

describe('buildTidbits', () => {
	it('offers only the formats fact to someone with no scenes', () => {
		const [only, ...rest] = buildTidbits(facts({ sceneCount: 0 }))

		expect(rest).toEqual([])
		expect(only.id).toBe('formats')
		expect(only.figure).toBe(String(IMPORTABLE_FORMAT_LABELS.length))
		for (const label of IMPORTABLE_FORMAT_LABELS) {
			expect(only.caption).toContain(label)
		}
	})

	it('falls back to the library count when nothing else applies', () => {
		expect(ids(facts())).toEqual(['library'])
		expect(ids(facts({ publishedCount: 1 }))).toEqual(['published'])
		expect(ids(facts({ sceneCount: 5, publishedCount: 1 }))).toEqual([
			'published',
			'library'
		])
		expect(buildTidbits(facts({ sceneCount: 1, projectCount: 1 }))[0]).toEqual({
			id: 'library',
			figure: '1',
			caption: 'scene across 1 project, all in one place.'
		})
	})

	it('reports bytes saved only when the saving is a real share of the upload', () => {
		expect(
			ids(facts({ initialBytes: 100 * MB, currentBytes: 96 * MB }))
		).not.toContain('bytes-saved')

		const saved = buildTidbits(
			facts({
				initialBytes: 100 * MB,
				currentBytes: 40 * MB,
				measuredSceneCount: 2
			})
		).find((tidbit) => tidbit.id === 'bytes-saved')
		expect(saved?.figure).toBe('60 MB')
		expect(saved?.caption).toContain('across 2 scenes')
	})

	it('names the scene with the largest cut, floored to a whole percent', () => {
		const cut = buildTidbits(
			facts({
				biggestCut: {
					sceneName: 'Sneaker',
					initialBytes: 24 * MB,
					currentBytes: 3 * MB
				}
			})
		).find((tidbit) => tidbit.id === 'biggest-cut')

		expect(cut?.figure).toBe('87%')
		expect(cut?.caption).toContain('Sneaker')
		expect(cut?.caption).toContain('24 MB down to 3.0 MB')
	})

	it('leaves out a cut too small to be worth saying', () => {
		expect(
			ids(
				facts({
					biggestCut: {
						sceneName: 'Chair',
						initialBytes: 10 * MB,
						currentBytes: 9.5 * MB
					}
				})
			)
		).not.toContain('biggest-cut')
	})

	it('counts removed vertices compactly, from a thousand up', () => {
		expect(
			ids(facts({ verticesBefore: 1_500, verticesAfter: 600 }))
		).not.toContain('vertices-removed')

		const removed = buildTidbits(
			facts({ verticesBefore: 3_000_000, verticesAfter: 600_000 })
		).find((tidbit) => tidbit.id === 'vertices-removed')
		expect(removed?.figure).toBe('2.4M')
	})

	it('reports live scenes only when some are published', () => {
		expect(ids(facts())).not.toContain('published')
		expect(ids(facts({ publishedCount: 2 }))).toContain('published')
	})
})

describe('pickTidbit', () => {
	const all = buildTidbits(
		facts({ publishedCount: 1, verticesBefore: 10_000, verticesAfter: 0 })
	)

	it('reaches every entry, first to last', () => {
		expect(pickTidbit(all, () => 0)).toBe(all[0])
		expect(pickTidbit(all, () => 0.9999)).toBe(all[all.length - 1])
	})

	it('never indexes past the end', () => {
		expect(pickTidbit(all, () => 1)).toBe(all[all.length - 1])
	})
})
