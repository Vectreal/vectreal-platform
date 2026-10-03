import { Texture, WebGLRenderTarget, type WebGLRenderer } from 'three'
import { describe, expect, it } from 'vitest'

import { AccumulatePass } from './accumulate-pass'

interface Draw {
	input: Texture | null
	target: WebGLRenderTarget | null
}

/** Records what each draw sampled and where it drew it. */
const recordingRenderer = (pass: AccumulatePass) => {
	const draws: Draw[] = []
	let target: WebGLRenderTarget | null = null
	const material = pass.fullscreenMaterial as unknown as {
		uniforms: { inputBuffer: { value: Texture | null } }
	}
	const renderer = {
		setRenderTarget: (next: WebGLRenderTarget | null) => {
			target = next
		},
		render: () => {
			draws.push({ input: material.uniforms.inputBuffer.value, target })
		}
	} as unknown as WebGLRenderer
	return { renderer, draws }
}

/** Follows the draws back to the frame a texture was last written from. */
const sourceOf = (draws: Draw[], texture: Texture | null): Texture | null => {
	for (let i = draws.length - 1; i >= 0; i--) {
		if (draws[i].target?.texture === texture) {
			return sourceOf(draws.slice(0, i), draws[i].input)
		}
	}
	return texture
}

const frame = () => new WebGLRenderTarget(1, 1)

describe('AccumulatePass history', () => {
	it('redraws the last frame presented while moving', () => {
		const pass = new AccumulatePass()
		pass.renderToScreen = true
		const { renderer, draws } = recordingRenderer(pass)
		const moving = frame()

		pass.present()
		pass.render(renderer, moving)
		pass.presentHistory(renderer)

		const redraw = draws.at(-1)!
		expect(redraw.target).toBeNull()
		expect(sourceOf(draws, redraw.input)).toBe(moving.texture)
	})

	it('redraws the latest frame when motion follows accumulation', () => {
		const pass = new AccumulatePass()
		pass.renderToScreen = true
		const { renderer, draws } = recordingRenderer(pass)
		const still = frame()
		const moving = frame()

		pass.accumulate(0)
		pass.render(renderer, still)
		pass.present()
		pass.render(renderer, moving)
		pass.presentHistory(renderer)

		expect(sourceOf(draws, draws.at(-1)!.input)).toBe(moving.texture)
	})
})
