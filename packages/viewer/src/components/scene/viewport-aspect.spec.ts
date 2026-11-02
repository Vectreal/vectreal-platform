import { OrthographicCamera, PerspectiveCamera } from 'three'
import { describe, expect, it } from 'vitest'

import { viewportAspectOf } from './viewport-aspect'

describe('viewportAspectOf', () => {
	it('reads a perspective camera’s aspect, which the fit backs it off for', () => {
		expect(viewportAspectOf(new PerspectiveCamera(50, 0.5))).toBe(0.5)
	})

	it('skips an orthographic camera, whose poses are shown as stored', () => {
		// Even one given an aspect: it is the camera type that rules it out.
		const camera = Object.assign(new OrthographicCamera(), { aspect: 0.5 })
		expect(viewportAspectOf(camera)).toBeUndefined()
	})
})
