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
	MeshStandardMaterial,
	Texture
} from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

	describe('texture formats', () => {
		/** Every material of the scene the exporter is handed, mesh by mesh. */
		async function exportedMaterials(scene: Group) {
			const { USDZExporter } =
				await import('three/examples/jsm/exporters/USDZExporter.js')
			const parse = vi
				.spyOn(USDZExporter.prototype, 'parseAsync')
				.mockResolvedValue(new Uint8Array(0))
			await new ModelExporter().exportThreeJSUSDZ(scene)
			const exported = parse.mock.calls[0][0] as Group
			const materials: MeshStandardMaterial[] = []
			exported.traverse((child) => {
				const mesh = child as Mesh
				if (!mesh.isMesh) return
				materials.push(
					...((Array.isArray(mesh.material)
						? mesh.material
						: [mesh.material]) as MeshStandardMaterial[])
				)
			})
			return materials
		}

		/** The texture format each slot is written in, as the exporter is asked. */
		async function exportedFormats(scene: Group) {
			return (await exportedMaterials(scene)).map((material) =>
				Object.fromEntries(
					(['map', 'normalMap', 'roughnessMap', 'aoMap', 'alphaMap'] as const)
						.filter((slot) => material[slot])
						.map((slot) => [slot, material[slot]?.userData['mimeType']])
				)
			)
		}

		it('marks each material of a multi-material mesh, and a shared material once', async () => {
			const shared = new MeshStandardMaterial({ normalMap: new DataTexture() })
			const scene = new Group()
			scene.add(
				new Mesh(new BoxGeometry(), [
					shared,
					new MeshStandardMaterial({ map: new DataTexture() })
				])
			)
			scene.add(new Mesh(new BoxGeometry(), shared))

			const materials = await exportedMaterials(scene)

			expect(
				materials.map(
					(material) =>
						(material.map ?? material.normalMap)?.userData['mimeType']
				)
			).toEqual(['image/jpeg', 'image/jpeg', 'image/jpeg'])
			expect(materials[2]).toBe(materials[0])
		})

		describe('in a browser', () => {
			/** Pixels a stubbed canvas hands back, and what is put into it. */
			let read: Uint8ClampedArray
			let written: Uint8ClampedArray[]
			let bitmapSize: [number, number]

			beforeEach(() => {
				written = []
				bitmapSize = [1, 1]
				class FakeBitmap {
					width = bitmapSize[0]
					height = bitmapSize[1]
				}
				class FakeCanvas {
					constructor(
						public width: number,
						public height: number
					) {}
					getContext() {
						return {
							drawImage: () => undefined,
							getImageData: () => ({ data: read.slice() }),
							putImageData: ({ data }: { data: Uint8ClampedArray }) =>
								written.push(data)
						}
					}
				}
				vi.stubGlobal('ImageBitmap', FakeBitmap)
				vi.stubGlobal('OffscreenCanvas', FakeCanvas)
			})
			afterEach(() => vi.unstubAllGlobals())

			it('writes a JPEG from an opaque copy of the image, the scene’s own left as it is', async () => {
				read = new Uint8ClampedArray([200, 100, 50, 128])
				const bitmap = new (
					globalThis.ImageBitmap as unknown as new () => ImageBitmap
				)()
				const normalMap = new Texture(bitmap)
				const roughnessMap = new Texture()
				roughnessMap.source = normalMap.source
				const scene = new Group()
				scene.add(
					new Mesh(
						new BoxGeometry(),
						new MeshStandardMaterial({ normalMap, roughnessMap })
					)
				)

				const [material] = await exportedMaterials(scene)

				expect(written).toEqual([new Uint8ClampedArray([200, 100, 50, 255])])
				expect(material.normalMap?.image).toBeInstanceOf(OffscreenCanvas)
				// One image in the file, as before.
				expect(material.roughnessMap?.source).toBe(material.normalMap?.source)
				expect(normalMap.image).toBe(bitmap)
			})

			it('draws the copy at the size the exporter writes, never larger', async () => {
				bitmapSize = [4096, 2048]
				read = new Uint8ClampedArray(4)
				const scene = new Group()
				scene.add(
					new Mesh(
						new BoxGeometry(),
						new MeshStandardMaterial({
							normalMap: new Texture(
								new (
									globalThis.ImageBitmap as unknown as new () => ImageBitmap
								)()
							)
						})
					)
				)

				const [material] = await exportedMaterials(scene)

				const image = material.normalMap?.image as OffscreenCanvas
				expect([image.width, image.height]).toEqual([1024, 512])
			})
		})

		it('writes every texture of an opaque material as JPEG', async () => {
			const scene = new Group()
			scene.add(
				new Mesh(
					new BoxGeometry(),
					new MeshStandardMaterial({
						map: new DataTexture(),
						normalMap: new DataTexture(),
						roughnessMap: new DataTexture(),
						aoMap: new DataTexture()
					})
				)
			)

			expect(await exportedFormats(scene)).toEqual([
				{
					map: 'image/jpeg',
					normalMap: 'image/jpeg',
					roughnessMap: 'image/jpeg',
					aoMap: 'image/jpeg'
				}
			])
		})

		it.each([
			['transparent', { transparent: true }],
			['cut out', { alphaTest: 0.5 }]
		])(
			'keeps a %s base color as PNG, since JPEG has no alpha',
			async (_, alpha) => {
				const scene = new Group()
				scene.add(
					new Mesh(
						new BoxGeometry(),
						new MeshStandardMaterial({
							map: new DataTexture(),
							normalMap: new DataTexture(),
							...alpha
						})
					)
				)

				expect(await exportedFormats(scene)).toEqual([
					{ map: undefined, normalMap: 'image/jpeg' }
				])
			}
		)

		it('keeps an alpha map as PNG', async () => {
			const scene = new Group()
			scene.add(
				new Mesh(
					new BoxGeometry(),
					new MeshStandardMaterial({ alphaMap: new DataTexture() })
				)
			)

			expect(await exportedFormats(scene)).toEqual([{ alphaMap: undefined }])
		})

		it('keeps an image as PNG everywhere once one material reads its alpha', async () => {
			const leaves = new DataTexture()
			const scene = new Group()
			scene.add(
				new Mesh(
					new BoxGeometry(),
					new MeshStandardMaterial({ map: leaves, alphaTest: 0.5 })
				)
			)
			// Another texture of the same image, so the same file in the USDZ.
			scene.add(
				new Mesh(
					new BoxGeometry(),
					new MeshStandardMaterial({ map: leaves.clone() })
				)
			)

			expect(await exportedFormats(scene)).toEqual([
				{ map: undefined },
				{ map: undefined }
			])
		})

		it('leaves the scene’s own textures and materials untouched', async () => {
			const normalMap = new DataTexture()
			normalMap.userData['mimeType'] = 'image/webp'
			const material = new MeshStandardMaterial({ normalMap })
			const mesh = new Mesh(new BoxGeometry(), material)
			const scene = new Group()
			scene.add(mesh)

			expect(await exportedFormats(scene)).toEqual([
				{ normalMap: 'image/jpeg' }
			])
			expect(mesh.material).toBe(material)
			expect(material.normalMap).toBe(normalMap)
			expect(normalMap.userData['mimeType']).toBe('image/webp')
		})
	})

	it('reports no transmissive materials for an opaque model', async () => {
		const scene = new Group()
		scene.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()))

		const { result, usda } = await exportUsda(scene)

		expect(result.transmissiveMaterials).toEqual([])
		expect(usda).toContain('float inputs:opacity = 1')
	})
})
