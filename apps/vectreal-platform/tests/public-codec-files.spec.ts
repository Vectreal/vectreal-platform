import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { DRACO_DECODER_PATH, KTX2_TRANSCODER_PATH } from '@vctrl/core'
import { describe, expect, it } from 'vitest'

/**
 * The codec files served from `public/` are copies of what the installed
 * packages expect to load.
 *
 * Each one runs against code bundled from `node_modules`: three's loaders
 * drive the Draco decoder and the KTX2 transcoder, and `ktx2-encoder`'s
 * bundled glue drives its wasm. A dependency bump that leaves a copy behind
 * still builds and still serves, and fails only in a browser, when glue and
 * wasm of different versions meet. Refresh the copy, then purge its prefix at
 * the edge (see each folder's README).
 */
const APP_ROOT = resolve(import.meta.dirname, '..')
const PUBLIC_DIR = join(APP_ROOT, 'public')
const PACKAGES = join(APP_ROOT, 'node_modules')

const COPIES = [
	['draco/draco_decoder.js', 'three/examples/jsm/libs/draco/gltf'],
	['draco/draco_decoder.wasm', 'three/examples/jsm/libs/draco/gltf'],
	['draco/draco_wasm_wrapper.js', 'three/examples/jsm/libs/draco/gltf'],
	['basis/basis_transcoder.js', 'three/examples/jsm/libs/basis'],
	['basis/basis_transcoder.wasm', 'three/examples/jsm/libs/basis'],
	['basis-encoder/basis_encoder.wasm', 'ktx2-encoder/dist/basis']
] as const

describe('public codec files', () => {
	it.each(COPIES)('%s matches %s', (published, sourceDir) => {
		const fileName = published.split('/').pop() as string
		const copy = readFileSync(join(PUBLIC_DIR, published))
		const source = readFileSync(join(PACKAGES, sourceDir, fileName))
		expect(copy.equals(source)).toBe(true)
	})
})

describe('where the loaders and the encoder look for them', () => {
	const published = (url: string) => existsSync(join(PUBLIC_DIR, url))

	it('serves the Draco decoder and the KTX2 transcoder at their default paths', () => {
		expect(published(`${DRACO_DECODER_PATH}draco_decoder.wasm`)).toBe(true)
		expect(published(`${KTX2_TRANSCODER_PATH}basis_transcoder.js`)).toBe(true)
		expect(published(`${KTX2_TRANSCODER_PATH}basis_transcoder.wasm`)).toBe(true)
	})

	it('serves the encoder wasm the publish worker fetches', () => {
		const worker = readFileSync(
			join(APP_ROOT, 'app/workers/publish-export.worker.ts'),
			'utf8'
		)
		const wasmUrl = worker.match(/const ENCODER_WASM_URL = '([^']+)'/)?.[1]
		expect(wasmUrl).toBe('/basis-encoder/basis_encoder.wasm')
		expect(published(wasmUrl as string)).toBe(true)
		expect(worker).toContain('wasmUrl: ENCODER_WASM_URL')
	})
})
