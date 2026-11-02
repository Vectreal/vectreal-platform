/**
 * How far a bake reports it has come, and how it ends when the GPU resets
 * under it. The slicing loop runs against a renderer that draws nothing, so
 * this covers the count and the reason, not the image; the
 * GPU bake itself runs in `vctrl/viewer-e2e`.
 */
import { Document } from '@gltf-transform/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bakeOcclusionIntoDocument } from './bake-into-document'
import { BakeError, bakeWithRecovery } from './bake-outcome'
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

/**
 * A renderer whose GPU finishes at once and offers neither fences nor timers,
 * its context lost from the start when `lost` says so.
 */
function idleRenderer({ lost = false } = {}): WebGLRenderer {
	const gl = {
		getExtension: () => null,
		fenceSync: () => null,
		isContextLost: () => lost
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
		readRenderTargetPixels: () => {},
		dispose: () => {}
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
			() => idleRenderer(),
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
			() => idleRenderer(),
			{ resolution: 16, samples: 4 },
			(fraction) => fractions.push(fraction)
		)

		expectRisesToOne(fractions)
	})

	it('throws a GPU reset as its reason, not only as words', async () => {
		const bake = bakeOcclusionIntoDocument(
			twoQuads(),
			() => idleRenderer({ lost: true }),
			{ resolution: 16, samples: 4, distance: 0.25 }
		)

		await expect(bake).rejects.toBeInstanceOf(BakeError)
		await expect(bake).rejects.toMatchObject({ reason: 'gpu-reset' })
	})

	it('recovers from a reset by drawing again on a fresh renderer', async () => {
		const renderers = [idleRenderer({ lost: true }), idleRenderer()]
		let made = 0

		const result = await bakeWithRecovery(
			(renderer, options) =>
				bakeOcclusionIntoDocument(twoQuads(), renderer, options),
			() => renderers[made++],
			{ resolution: 16, samples: 4, distance: 0.25 }
		)

		expect(result).toEqual({
			baked: ['left', 'right'],
			skipped: [],
			recovered: 'retried'
		})
	})
})
