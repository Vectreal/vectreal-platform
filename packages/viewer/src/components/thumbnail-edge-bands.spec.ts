import { describe, expect, it, vi } from 'vitest'

import { paintEdgeFill, planEdgeFill } from './thumbnail-edge-bands'

const THUMBNAIL = { width: 1280, height: 720 }

describe('planEdgeFill', () => {
	it('lays the image at its contained place and stretches its top and bottom rows over the bands of a narrower viewport', () => {
		// 1000x1000: the contained image is 1000x562.5 at y 218.75, snapped to
		// whole pixels as 1000x562 at y 219.
		const [body, top, bottom] = planEdgeFill(
			{ width: 1000, height: 1000 },
			THUMBNAIL
		)

		expect(body.source).toEqual([0, 0, 1280, 720])
		expect(body.target).toEqual([0, 219, 1000, 562])
		expect(top.source).toEqual([0, 0, 1280, 1])
		expect(top.target).toEqual([0, 0, 1000, 220])
		expect(bottom.source).toEqual([0, 719, 1280, 1])
		expect(bottom.target).toEqual([0, 780, 1000, 220])
	})

	it('stretches the left and right columns over the bands of a wider viewport', () => {
		// 2400x900: the contained image is 1600x900, centered at x 400.
		const [body, left, right] = planEdgeFill(
			{ width: 2400, height: 900 },
			THUMBNAIL
		)

		expect(body.target).toEqual([400, 0, 1600, 900])
		expect(left.source).toEqual([0, 0, 1, 720])
		expect(left.target).toEqual([0, 0, 401, 900])
		expect(right.source).toEqual([1279, 0, 1, 720])
		expect(right.target).toEqual([1999, 0, 401, 900])
	})

	it('leaves no bands at the image aspect, or before layout', () => {
		expect(planEdgeFill({ width: 1600, height: 900 }, THUMBNAIL)).toEqual([])
		expect(planEdgeFill({ width: 0, height: 0 }, THUMBNAIL)).toEqual([])
		expect(
			planEdgeFill({ width: 800, height: 800 }, { width: 0, height: 0 })
		).toEqual([])
	})
})

const recordingContext = () => {
	const calls: string[] = []
	const context = {
		canvas: { width: 1000, height: 1000 },
		globalCompositeOperation: 'source-over',
		clearRect: vi.fn(() => calls.push('clear')),
		drawImage: vi.fn(() =>
			calls.push(`draw:${context.globalCompositeOperation}`)
		),
		save: vi.fn(() => calls.push('save')),
		restore: vi.fn(() => {
			context.globalCompositeOperation = 'source-over'
			calls.push('restore')
		}),
		beginPath: vi.fn(),
		rect: vi.fn(),
		clip: vi.fn(() => calls.push('clip'))
	}
	return { context, calls }
}

describe('paintEdgeFill', () => {
	it('makes each draw, then squares its alpha inside a clip to that draw', () => {
		const { context, calls } = recordingContext()
		const draws = planEdgeFill({ width: 1000, height: 1000 }, THUMBNAIL)

		paintEdgeFill(
			context as unknown as CanvasRenderingContext2D,
			{} as CanvasImageSource,
			draws
		)

		const perDraw = [
			'draw:source-over',
			'save',
			'clip',
			'draw:destination-in',
			'draw:destination-in',
			'restore'
		]
		expect(calls).toEqual(['clear', ...perDraw, ...perDraw, ...perDraw])
		// The clip is the draw itself, so squaring one cannot clear another.
		expect(context.rect.mock.calls).toEqual(draws.map((draw) => draw.target))
	})

	it('clears an earlier fill when the viewport reaches the image aspect', () => {
		const { context, calls } = recordingContext()

		paintEdgeFill(
			context as unknown as CanvasRenderingContext2D,
			{} as CanvasImageSource,
			[]
		)

		expect(calls).toEqual(['clear'])
	})
})
