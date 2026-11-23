import { describe, expect, it } from 'vitest'

import { bundleSourceCopy } from '../../lib/convert/convert-capabilities'
import { convertPairBySlug } from '../../lib/convert/convert-pairs'
import {
	downloadContainer,
	measuredBytes,
	missingTexturesNote,
	refusalMessage
} from './converter-surface.utils'

const file = (name: string, size: number) =>
	new File([new Uint8Array(size)], name)

describe('downloadContainer', () => {
	it('names the container only when it is not the format itself', () => {
		expect(downloadContainer('model.glb', 'glb')).toBe('')
		expect(downloadContainer('model.zip', 'gltf')).toBe(' (.zip)')
	})
})

describe('measuredBytes', () => {
	it('counts a single-file model alone, not what was dropped beside it', () => {
		expect(measuredBytes([file('a.glb', 10), file('a.blend', 90)])).toBe(10)
	})

	it('counts a bundle as its whole selection', () => {
		expect(measuredBytes([file('a.gltf', 10), file('a.bin', 30)])).toBe(40)
	})

	it('counts the images an FBX reads from beside it, and nothing else', () => {
		expect(
			measuredBytes([
				file('car.fbx', 10),
				file('paint.png', 30),
				file('paint.psd', 900)
			])
		).toBe(40)
	})

	it('counts everything when nothing in it is a model', () => {
		expect(measuredBytes([file('a.png', 5), file('b.png', 7)])).toBe(12)
	})
})

describe('refusalMessage', () => {
	const glb = convertPairBySlug('glb-to-gltf')!
	const gltf = convertPairBySlug('gltf-to-glb')!
	const gltfCopy = bundleSourceCopy('gltf')

	it('asks a bundle page for one model, not for fewer files', () => {
		const error = { code: 'multiple_models' } as never
		expect(refusalMessage(error, glb, null)).toMatch(/Drop one at a time/)
		expect(refusalMessage(error, gltf, gltfCopy)).toMatch(/more than one model/)
		expect(refusalMessage(error, gltf, gltfCopy)).not.toMatch(/one at a time/)
	})

	it('never asks for sibling files about a file that would not parse', () => {
		const error = { code: 'gltf_load_failed' } as never
		expect(refusalMessage(error, gltf, gltfCopy)).toBe(
			`Check it is a valid ${gltf.fromLabel}.`
		)
	})

	it('says a sample failed to download, not that a file is invalid', () => {
		for (const code of ['url_http', 'url_unreachable']) {
			expect(refusalMessage({ code } as never, gltf, gltfCopy)).toBe(
				'The sample did not download. Try your own file instead.'
			)
		}
	})

	it('says what an unreadable selection was', () => {
		const refused = (selection: unknown) =>
			({ code: 'unsupported_format', context: { selection } }) as never
		const obj = convertPairBySlug('obj-to-glb')!

		expect(refusalMessage(refused({ kind: 'photos' }), obj, null)).toMatch(
			/^Photos are not a 3D model/
		)
		expect(
			refusalMessage(
				refused({ kind: 'blender', fileName: 'Chair.blend' }),
				obj,
				null
			)
		).toContain('export it as OBJ')
		expect(
			refusalMessage(
				refused({ kind: 'archive', fileName: 'chair.zip' }),
				obj,
				null
			)
		).toContain('chair.zip is a zip archive')
		expect(refusalMessage(refused(null), obj, null)).toBe(
			'Nothing in that selection is a format we can read. This page converts OBJ.'
		)
	})

	it('names the models, and keeps the one this page converts', () => {
		const error = {
			code: 'multiple_models',
			context: { fileNames: ['chair.gltf', 'chair.fbx'] }
		} as never
		const fbx = convertPairBySlug('fbx-to-glb')!

		expect(refusalMessage(error, gltf, gltfCopy)).toBe(
			'That folder holds chair.gltf and chair.fbx. Leave just chair.gltf, with its own files.'
		)
		expect(refusalMessage(error, fbx, null)).toBe(
			'That selection holds chair.gltf and chair.fbx. Drop just chair.fbx.'
		)
		expect(
			refusalMessage(
				{
					code: 'multiple_models',
					context: { fileNames: ['chair.fbx', 'chair.stl'] }
				} as never,
				glb,
				null
			)
		).toBe('That selection holds chair.fbx and chair.stl. Drop just chair.fbx.')
	})

	it('names the files a model did not get', () => {
		const error = {
			code: 'missing_assets',
			context: { fileName: 'chair.gltf', missingFiles: ['textures/wood.png'] }
		} as never

		expect(refusalMessage(error, gltf, gltfCopy)).toBe(
			'chair.gltf needs textures/wood.png, which did not come with it. Drop the folder it lives in.'
		)
		// A sample opened by URL names no file, and has no folder to drop.
		expect(
			refusalMessage(
				{
					code: 'missing_assets',
					context: { missingFiles: ['textures/wood.png'] }
				} as never,
				gltf,
				gltfCopy
			)
		).toBe(gltfCopy!.refusal)
	})

	it('falls back to the bundle refusal, then to the format sentence', () => {
		expect(refusalMessage(null, gltf, gltfCopy)).toBe(gltfCopy!.refusal)
		expect(refusalMessage(null, glb, null)).toBe(
			`Check it is a valid ${glb.fromLabel}.`
		)
	})
})

describe('missingTexturesNote', () => {
	it('names the images a glTF converts without', () => {
		expect(
			missingTexturesNote({
				name: 'scene.gltf',
				missingTextures: ['textures/wood.png']
			})
		).toBe(
			'textures/wood.png did not come with scene.gltf, so those surfaces show their plain color. Drop the folder it lives in to keep them textured.'
		)
	})

	it('says nothing when nothing was missing', () => {
		expect(missingTexturesNote({ name: 'chair.glb' })).toBeNull()
	})
})
