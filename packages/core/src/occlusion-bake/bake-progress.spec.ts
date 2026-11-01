/**
 * How far a bake reports it has come. The slicing loop runs against a
 * renderer that draws nothing, so this covers the count, not the image; the
 * GPU bake itself runs in `vctrl/viewer-e2e`.
 */
import { Document } from '@gltf-transform/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bakeOcclusionIntoDocument } from './bake-into-document'
import { bakeLightsIntoDocument } from '../light-bake/bake-into-document'
import { resolveLighting } from '../scene-lighting/resolve-lighting'

import type { WebGLRenderer } from 'three'

/** Two quads side by side, each its own mesh and material, so two targets. */
function twoQuads() {
	const document = new Document()
	document.createBuffer()
	const scene = document.createScene()
	for (const [name, x] of [
		['left', 0],
		['right', 2]
	] as const) {
		const accessor = (
			type: 'VEC2' | 'VEC3',
			array: Float32Array<ArrayBuffer>
		) => document.createAccessor().setType(type).setArray(array)
		const primitive = document
			.createPrimitive()
			.setMaterial(document.createMaterial(name))
			.setAttribute(
				'POSITION',
				accessor(
					'VEC3',
					new Float32Array([x, 0, 0, x + 1, 0, 0, x + 1, 1, 0, x, 1, 0])
				)
			)
			.setAttribute(
				'NORMAL',
				accessor('VEC3', new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]))
			)
			.setAttribute(
				'TEXCOORD_0',
				accessor('VEC2', new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]))
			)
			.setIndices(
				document
					.createAccessor()
					.setType('SCALAR')
					.setArray(new Uint16Array([0, 1, 2, 0, 2, 3]))
			)
		scene.addChild(
			document
				.createNode(name)
				.setMesh(document.createMesh(name).addPrimitive(primitive))
		)
	}
	return document
}

/** A renderer whose GPU finishes at once and offers neither fences nor timers. */
function idleRenderer(): WebGLRenderer {
	const gl = {
		getExtension: () => null,
		fenceSync: () => null,
		isContextLost: () => false
	}
	return {
		autoClear: true,
		domElement: new EventTarget(),
		getContext: () => gl,
		getRenderTarget: () => null,
		getClearColor: (color: unknown) => color,
		getClearAlpha: () => 1,
		setClearColor: () => {},
		setRenderTarget: () => {},
		clear: () => {},
		render: () => {},
		readRenderTargetPixels: () => {}
	} as unknown as WebGLRenderer
}

const expectRisesToOne = (fractions: number[]) => {
	// More than one report, or this proves nothing about the steps between.
	expect(fractions.length).toBeGreaterThan(1)
	for (let i = 1; i < fractions.length; i++) {
		expect(fractions[i]).toBeGreaterThan(fractions[i - 1])
	}
	expect(fractions.at(-1)).toBe(1)
}

describe('bake progress', () => {
	// Encoding the bake as a PNG needs a canvas Node lacks, and is not counted.
	beforeEach(() => {
		vi.stubGlobal('ImageData', class {})
		vi.stubGlobal(
			'OffscreenCanvas',
			class {
				getContext = () => ({ putImageData: () => {} })
				convertToBlob = async () => new Blob()
			}
		)
	})
	afterEach(() => vi.unstubAllGlobals())

	it('rises to 1 across every material the occlusion bake draws', async () => {
		const fractions: number[] = []

		await bakeOcclusionIntoDocument(
			twoQuads(),
			idleRenderer,
			{ resolution: 16, samples: 4, distance: 0.25 },
			(fraction) => fractions.push(fraction)
		)

		expectRisesToOne(fractions)
	})

	it('rises to 1 across every material the light bake draws', async () => {
		const fractions: number[] = []
		const lighting = resolveLighting({
			lighting: { lights: [{ role: 'key', intensity: 2 }] }
		})

		await bakeLightsIntoDocument(
			twoQuads(),
			lighting,
			idleRenderer,
			{ resolution: 16, samples: 4 },
			(fraction) => fractions.push(fraction)
		)

		expectRisesToOne(fractions)
	})
})
