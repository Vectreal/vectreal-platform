// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { Group, Mesh } from 'three'
import { describe, expect, it, vi } from 'vitest'

import ExampleSceneClient from './example-scene-client'
import { exampleSceneById } from '../../lib/samples/example-scenes'

import type { Object3D } from 'three'

/* `useGLTF` caches by URL: every caller of one model gets this same scene. */
const cachedScene = new Group().add(new Mesh())
vi.mock('@react-three/drei', () => ({
	useGLTF: () => ({ scene: cachedScene })
}))

const shownModels: Object3D[] = []
vi.mock('@vctrl/viewer', () => ({
	VectrealViewer: ({ model }: { model: Object3D }) => {
		shownModels.push(model)
		return null
	}
}))

describe('ExampleSceneClient', () => {
	it('gives each viewer of one model its own copy of the scene', () => {
		// An object has one parent, so two viewers handed the cached scene left
		// the first one empty: the second example on a page took its model.
		const telephoto = exampleSceneById('camera-fov-telephoto')
		const wide = exampleSceneById('camera-fov-wide')
		if (!telephoto || !wide) throw new Error('missing example')

		render(
			<>
				<ExampleSceneClient example={telephoto} />
				<ExampleSceneClient example={wide} />
			</>
		)

		const [first, second] = shownModels
		expect(first).not.toBe(cachedScene)
		expect(second).not.toBe(cachedScene)
		expect(first).not.toBe(second)
		expect(first.children).toHaveLength(cachedScene.children.length)
	})
})
