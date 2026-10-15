/**
 * What a USDZ says about a glass material.
 *
 * Read from the `.usda` inside the archive, because that file is what Quick
 * Look renders: a material can be right in memory and still be written opaque.
 */
import JSZip from 'jszip'
import {
	BoxGeometry,
	DataTexture,
	Group,
	Mesh,
	MeshPhysicalMaterial,
	MeshStandardMaterial
} from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ModelExporter } from './model-exporter'

async function exportUsda(scene: Group) {
	const result = await new ModelExporter().exportThreeJSUSDZ(scene)
	const zip = await JSZip.loadAsync(result.data)
	const usda = await zip.file('model.usda')?.async('string')
	if (!usda) throw new Error('No model.usda in the archive')
	return { result, usda }
}

/** The `inputs:opacity` written for the material prim `Material_<id>`. */
function opacityOf(usda: string, materialId: number) {
	const prim = usda.split(`def Material "Material_${materialId}"`)[1]
	const match = prim?.match(/float inputs:opacity = ([\d.e-]+)/)
	return match ? Number(match[1]) : undefined
}

describe('exportThreeJSUSDZ', () => {
	afterEach(() => vi.restoreAllMocks())

	it('writes transmission as opacity, since USDZ has no transmission', async () => {
		const glass = new MeshPhysicalMaterial({ name: 'lens', transmission: 0.75 })
		const body = new MeshStandardMaterial({ name: 'body' })
		const scene = new Group()
		scene.add(new Mesh(new BoxGeometry(), glass))
		scene.add(new Mesh(new BoxGeometry(), body))

		const { result, usda } = await exportUsda(scene)

		expect(result.transmissiveMaterials).toEqual(['lens'])
		const written = usda.match(/def Material "Material_(\d+)"/g) ?? []
		const opacities = written.map((prim) =>
			opacityOf(usda, Number(prim.match(/\d+/)?.[0]))
		)
		expect(opacities.sort()).toEqual([0.25, 1])
	})

	it('writes a glass material shared by two meshes once', async () => {
		const glass = new MeshPhysicalMaterial({ name: 'lens', transmission: 1 })
		const scene = new Group()
		scene.add(new Mesh(new BoxGeometry(), glass))
		scene.add(new Mesh(new BoxGeometry(), glass))

		const { result, usda } = await exportUsda(scene)

		expect(result.transmissiveMaterials).toEqual(['lens'])
		expect(usda.match(/def Material "/g)).toHaveLength(1)
		expect(usda).toContain('float inputs:opacity = 0')
	})

	it.each([
		['an alphaMap', { alphaMap: new DataTexture() }],
		['a cutout map', { map: new DataTexture(), alphaTest: 0.5 }]
	])(
		'leaves glass with %s alone, since its opacity is never written',
		async (_, maps) => {
			const masked = new MeshPhysicalMaterial({ transmission: 1, ...maps })
			const scene = new Group()
			scene.add(new Mesh(new BoxGeometry(), masked))

			const exporter = new ModelExporter()
			const { USDZExporter } =
				await import('three/examples/jsm/exporters/USDZExporter.js')
			vi.spyOn(USDZExporter.prototype, 'parseAsync').mockResolvedValue(
				new Uint8Array(0)
			)
			const result = await exporter.exportThreeJSUSDZ(scene)

			expect(result.transmissiveMaterials).toEqual([])
		}
	)

	it('leaves the scene it was given untouched', async () => {
		const glass = new MeshPhysicalMaterial({ transmission: 1 })
		const mesh = new Mesh(new BoxGeometry(), glass)
		const scene = new Group()
		scene.add(mesh)

		await exportUsda(scene)

		expect(mesh.material).toBe(glass)
		expect(glass.transmission).toBe(1)
		expect(glass.opacity).toBe(1)
	})

	it('reports no transmissive materials for an opaque model', async () => {
		const scene = new Group()
		scene.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()))

		const { result, usda } = await exportUsda(scene)

		expect(result.transmissiveMaterials).toEqual([])
		expect(usda).toContain('float inputs:opacity = 1')
	})
})
