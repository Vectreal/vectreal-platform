/**
 * How a baked light map takes the live lights' place. The shader runs only on
 * a GPU, so its patch is checked as source here; `vctrl/viewer-e2e` draws a
 * published baked model in the viewer, where a patch that fails to compile
 * fails the run.
 */
import {
	BAKED_LIGHTMAP_USER_DATA,
	bakedLightsSignature,
	resolveLighting
} from '@vctrl/core'
import {
	Group,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	ShaderLib,
	Texture,
	type IUniform
} from 'three'
import { describe, expect, it } from 'vitest'

import {
	applyBakedLights,
	bakedLightsShaderMatchesThree,
	drawnLightsSignature,
	patchBakedLightsShader
} from './baked-lights'

function bakedMaterial(signature = 'baked-from', scale = 2) {
	const material = new MeshStandardMaterial({
		lightMap: new Texture(),
		lightMapIntensity: 0
	})
	material.userData[BAKED_LIGHTMAP_USER_DATA] = { scale, signature }
	return material
}

/** The switch the patch reads, as the material's compile hook hands it over. */
function switchOf(material: MeshStandardMaterial) {
	const shader = {
		fragmentShader: ShaderLib.physical.fragmentShader,
		vertexShader: '',
		uniforms: {} as Record<string, IUniform>
	}
	material.onBeforeCompile(shader as never, undefined as never)
	return shader.uniforms['bakedLightsOn']?.value
}

const modelOf = (...materials: (MeshStandardMaterial | MeshBasicMaterial)[]) =>
	new Group().add(...materials.map((material) => new Mesh(undefined, material)))

describe('the baked lights shader patch', () => {
	it('still matches the three chunks it rewrites', () => {
		expect(bakedLightsShaderMatchesThree()).toBe(true)
	})

	it('draws the map as direct light in place of the live diffuse light', () => {
		const shader = {
			fragmentShader: ShaderLib.physical.fragmentShader,
			uniforms: {} as Record<string, IUniform>
		}
		patchBakedLightsShader(shader, { value: 1 })
		const source = shader.fragmentShader

		expect(source).toContain('( 1.0 - bakedLightsOn ) * irradiance')
		expect(source).not.toContain('irradiance += lightMapIrradiance')
		// After the occlusion, which would otherwise darken it a second time.
		expect(
			source.indexOf('bakedLightsOn * bakedLight * bakedLight')
		).toBeGreaterThan(source.indexOf('#include <aomap_fragment>'))
		expect(shader.uniforms['bakedLightsOn'].value).toBe(1)
	})
})

describe('applyBakedLights', () => {
	it('turns a map on at its scale for the lighting it was baked from', () => {
		const material = bakedMaterial('baked-from', 2)

		applyBakedLights(modelOf(material), 'baked-from', 3)

		expect(material.lightMapIntensity).toBe(6)
		expect(switchOf(material)).toBe(1)
	})

	it('keeps the live lights for any other lighting', () => {
		const material = bakedMaterial('baked-from')
		const model = modelOf(material)
		applyBakedLights(model, 'baked-from', 3)

		applyBakedLights(model, 'edited-since', 3)

		expect(material.lightMapIntensity).toBe(0)
		expect(switchOf(material)).toBe(0)
	})

	it('keeps the live lights when no map may be drawn at all', () => {
		const material = bakedMaterial('')

		applyBakedLights(modelOf(material), '', 3)

		expect(switchOf(material)).toBe(0)
	})

	it('leaves a material without a map alone', () => {
		const unbaked = new MeshStandardMaterial()
		const described = bakedMaterial()
		described.lightMap = null

		applyBakedLights(modelOf(unbaked, described), 'baked-from', 1)

		expect(switchOf(unbaked)).toBeUndefined()
		expect(switchOf(described)).toBeUndefined()
	})

	it('patches a material once however often it is applied', () => {
		const material = bakedMaterial()
		const model = modelOf(material)
		applyBakedLights(model, 'baked-from', 1)
		const patched = material.onBeforeCompile

		applyBakedLights(model, 'edited-since', 1)

		expect(material.onBeforeCompile).toBe(patched)
	})
})

describe('drawnLightsSignature', () => {
	const lighting = (bakeLights: boolean) =>
		resolveLighting({
			lighting: { lights: [{ role: 'key' }], bake: { lights: bakeLights } }
		})

	it('is the baked lights signature while the lighting bakes its lights', () => {
		expect(drawnLightsSignature(lighting(true))).toBe(
			bakedLightsSignature(lighting(true))
		)
	})

	it('matches no map once the bake is turned off, before any republish', () => {
		expect(drawnLightsSignature(lighting(false))).toBe('')
	})
})
