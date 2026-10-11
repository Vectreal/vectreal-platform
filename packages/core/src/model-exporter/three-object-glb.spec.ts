/**
 * Every route that turns a three.js object into glTF keeps the clips the
 * object carries.
 *
 * One case per caller rather than one for `threeObjectToGLB` alone: the defect
 * this guards was never in a rule, it was three call sites each leaving the
 * clips out, so a caller that stops going through the helper is the failure to
 * catch. Removing `animations` from the helper reddens all three; routing any
 * one caller back to a bare `parseAsync` reddens that one.
 */
import { WebIO } from '@gltf-transform/core'
import {
	AnimationClip,
	BoxGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	VectorKeyframeTrack
} from 'three'
import { beforeAll, describe, expect, it } from 'vitest'

import { ModelOptimizer } from '../model-optimizer'
import { ModelExporter } from './model-exporter'

/*
  `GLTFExporter` assembles a GLB through a `FileReader`, which Node does not
  ship; `three-source-bridges.spec.ts` gives the full reason.
*/
beforeAll(() => {
	if (typeof globalThis.FileReader !== 'undefined') return

	globalThis.FileReader = class {
		result: ArrayBuffer | null = null
		onloadend: (() => void) | null = null

		readAsArrayBuffer(blob: Blob) {
			void blob.arrayBuffer().then((buffer) => {
				this.result = buffer
				this.onloadend?.()
			})
		}
	} as unknown as typeof FileReader
})

/** A box that slides one metre along X over a second, as a loader leaves it. */
function animatedScene(): Group {
	const scene = new Group()
	const part = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
	part.name = 'part'
	scene.add(part)
	scene.animations = [
		new AnimationClip('slide', 1, [
			new VectorKeyframeTrack('part.position', [0, 1], [0, 0, 0, 1, 0, 0])
		])
	]
	return scene
}

describe('a three.js object keeps its clips on the way to glTF', () => {
	it('through exportThreeJSGLB', async () => {
		const { data } = await new ModelExporter().exportThreeJSGLB(animatedScene())
		const document = await new WebIO().readBinary(data)

		expect(
			document
				.getRoot()
				.listAnimations()
				.map((clip) => clip.getName())
		).toEqual(['slide'])
	})

	it('through exportThreeJSGLTF', async () => {
		const { data } = await new ModelExporter().exportThreeJSGLTF(
			animatedScene()
		)

		expect(
			(data as { animations?: { name: string }[] }).animations?.map(
				(clip) => clip.name
			)
		).toEqual(['slide'])
	})

	it('through the optimizer reading a three.js object', async () => {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromThreeJS(animatedScene())
		const document = await new WebIO().readBinary(await optimizer.export())

		expect(
			document
				.getRoot()
				.listAnimations()
				.map((clip) => clip.getName())
		).toEqual(['slide'])
	})
})
