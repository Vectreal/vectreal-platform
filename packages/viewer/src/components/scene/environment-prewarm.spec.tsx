// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, render } from '@testing-library/react'
import {
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	Texture
} from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import EnvironmentPrewarm, { prewarmEnvironment } from './environment-prewarm'

const environment = new Texture()
const camera = new PerspectiveCamera()
const compile = vi.fn()
/** One renderer for every render, as R3F's store gives. */
const gl = { compile }

vi.mock('@react-three/drei', () => ({
	useEnvironment: () => environment
}))

vi.mock('@react-three/fiber', () => ({
	useThree: (select: (state: unknown) => unknown) => select({ gl, camera })
}))

afterEach(() => {
	vi.restoreAllMocks()
	compile.mockReset()
})

describe('prewarmEnvironment', () => {
	it('compiles a lit material against the environment, so three builds its PMREM', () => {
		const compiled: Scene[] = []
		const gl = { compile: (scene: Scene) => compiled.push(scene) }

		prewarmEnvironment(gl as never, camera, environment)

		expect(compiled).toHaveLength(1)
		expect(compiled[0].environment).toBe(environment)
		expect((compiled[0].children[0] as Mesh).material).toBeInstanceOf(
			MeshStandardMaterial
		)
	})

	it('releases its throwaway mesh once compiled, and never the environment', () => {
		const geometryDispose = vi.spyOn(PlaneGeometry.prototype, 'dispose')
		const materialDispose = vi.spyOn(MeshStandardMaterial.prototype, 'dispose')
		const environmentDispose = vi.spyOn(environment, 'dispose')
		let releasedBeforeCompile = true
		const gl = {
			compile: () => {
				releasedBeforeCompile = geometryDispose.mock.calls.length > 0
			}
		}

		prewarmEnvironment(gl as never, camera, environment)

		expect(releasedBeforeCompile).toBe(false)
		expect(geometryDispose).toHaveBeenCalledOnce()
		expect(materialDispose).toHaveBeenCalledOnce()
		expect(environmentDispose).not.toHaveBeenCalled()
	})
})

describe('EnvironmentPrewarm', () => {
	it('prewarms again once the scene disposes the shared texture', () => {
		render(<EnvironmentPrewarm files="studio.hdr" />)
		expect(compile).toHaveBeenCalledOnce()

		act(() => environment.dispose())

		expect(compile).toHaveBeenCalledTimes(2)
	})
})

describe('the viewer', () => {
	const viewer = readFileSync(
		join(import.meta.dirname, '..', '..', 'vectreal-viewer.tsx'),
		'utf8'
	)

	it('prewarms the environment before there is content to light', () => {
		const prewarm = viewer.indexOf(
			'<EnvironmentPrewarm files={environmentFiles} />'
		)
		const contentGate = viewer.indexOf('{hasContent && (')
		expect(prewarm).toBeGreaterThan(-1)
		expect(contentGate).toBeGreaterThan(prewarm)
	})
})
