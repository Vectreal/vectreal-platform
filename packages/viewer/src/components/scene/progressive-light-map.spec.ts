import {
	BoxGeometry,
	Color,
	DirectionalLight,
	Group,
	Mesh,
	MeshBasicMaterial,
	PerspectiveCamera,
	Scene,
	Texture,
	type WebGLRenderer
} from 'three'
import { describe, expect, it } from 'vitest'

import { ProgressiveLightMap } from './progressive-light-map'

/** The renderer calls `clear` makes, and nothing that needs a GL context. */
const stubRenderer = () =>
	({
		getClearColor: (target: Color) => target,
		getClearAlpha: () => 1,
		getRenderTarget: () => null,
		setClearColor: () => undefined,
		setRenderTarget: () => undefined,
		clear: () => undefined,
		render: () => undefined
	}) as unknown as WebGLRenderer

describe('ProgressiveLightMap', () => {
	it('silences the scene lights for a frame and puts back what they had then', () => {
		const scene = new Scene()
		const sceneLight = new DirectionalLight('white', 2)
		const bakeLights = new Group()
		const bakeLight = new DirectionalLight('white', 5)
		bakeLights.add(bakeLight)
		scene.add(sceneLight, bakeLights)

		const lightMap = new ProgressiveLightMap(stubRenderer(), scene, 8)
		lightMap.clear(bakeLights)
		// The scene changes the light while the bake runs, without a restart.
		sceneLight.intensity = 3

		lightMap.silenced(() => {
			expect(sceneLight.intensity).toBe(0)
			expect(bakeLight.intensity).toBe(5)
			expect(bakeLights.visible).toBe(true)
		})
		expect(sceneLight.intensity).toBe(3)
		expect(bakeLights.visible).toBe(false)
	})

	it('silences a light the scene mounts after the bake started', () => {
		const scene = new Scene()
		const bakeLights = new Group()
		scene.add(bakeLights)
		const lightMap = new ProgressiveLightMap(stubRenderer(), scene, 8)
		lightMap.clear(bakeLights)

		const mounted = new DirectionalLight('white', 4)
		scene.add(mounted)
		lightMap.silenced(() => expect(mounted.intensity).toBe(0))
		expect(mounted.intensity).toBe(4)
	})

	it('puts the scene back when a frame throws', () => {
		const scene = new Scene()
		const bakeLights = new Group()
		const light = new DirectionalLight('white', 2)
		const material = new MeshBasicMaterial()
		const model = new Mesh(new BoxGeometry(), material)
		scene.add(bakeLights, light, model)
		const lightMap = new ProgressiveLightMap(stubRenderer(), scene, 8)
		lightMap.clear(bakeLights)

		expect(() =>
			lightMap.silenced(() => {
				throw new Error('frame failed')
			})
		).toThrow('frame failed')
		expect(light.intensity).toBe(2)
		expect(model.material).toBe(material)
		expect(bakeLights.visible).toBe(false)
	})

	it('bakes without the environment, which the hemisphere samples stand in for', () => {
		const scene = new Scene()
		const environment = new Texture()
		scene.environment = environment
		let litBy: Texture | null | undefined
		const renderer = {
			...stubRenderer(),
			render: (rendered: Scene) => {
				litBy = rendered.environment
			}
		} as unknown as WebGLRenderer

		const lightMap = new ProgressiveLightMap(renderer, scene, 8)
		lightMap.update(new Mesh(), new PerspectiveCamera(), 1)
		expect(litBy).toBeNull()
		expect(scene.environment).toBe(environment)
	})
})
