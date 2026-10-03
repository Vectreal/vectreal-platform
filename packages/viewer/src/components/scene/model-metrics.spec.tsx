// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { BoxGeometry, Group, Mesh, type Object3D } from 'three'
import { describe, expect, it } from 'vitest'

import { useModelMetrics } from './scene-shadows'

const box = (width: number, height: number, depth: number) => {
	const model = new Group()
	model.add(new Mesh(new BoxGeometry(width, height, depth)))
	return model
}

/** Every value the hook returned, render by render. */
const renderMetrics = (model: Object3D | undefined) => {
	const renders: Array<ReturnType<typeof useModelMetrics>> = []
	const hook = renderHook(
		({ model }) => {
			const metrics = useModelMetrics(model)
			renders.push(metrics)
			return metrics
		},
		{ initialProps: { model } }
	)
	return { ...hook, renders }
}

describe('useModelMetrics', () => {
	it('measures a model once its effect has run', () => {
		const { result } = renderMetrics(box(4, 2, 3))
		expect(result.current).toMatchObject({
			footprint: 4,
			height: 2,
			measured: true,
			sized: true
		})
	})

	it('keeps the previous figures, unmeasured and unsized, until a swapped model is measured', () => {
		const { result, rerender, renders } = renderMetrics(box(4, 2, 3))
		renders.length = 0

		rerender({ model: box(8, 1, 1) })

		expect(renders[0]).toMatchObject({
			footprint: 4,
			measured: false,
			sized: false
		})
		expect(result.current).toMatchObject({ footprint: 8, measured: true })
	})

	it('treats a model with no measurable bounds as sized but unmeasured', () => {
		const { result } = renderMetrics(new Group())
		expect(result.current).toMatchObject({ measured: false, sized: true })
	})

	it('treats a viewer with no model as sized', () => {
		const { result } = renderMetrics(undefined)
		expect(result.current).toMatchObject({ measured: false, sized: true })
	})
})
