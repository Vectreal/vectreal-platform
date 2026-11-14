/**
 * A size shown beside a download is a claim, so it is pinned to the file.
 *
 * The sample picker renders "Camera, 17.9 MB" before anyone clicks, and 17.9 MB is
 * the difference between a sample and an unpleasant surprise on a phone. Nothing
 * else in the app would notice if someone swapped the asset for a different one.
 */
import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
	HERO_MODEL,
	HERO_SOURCE_SAMPLE_ID,
	PASS_SAMPLES,
	SAMPLE_MODELS,
	sampleModelById,
	sampleModelSource
} from '../app/lib/samples/sample-models'

const MODELS_DIR = join(
	dirname(fileURLToPath(import.meta.url)),
	'../app/assets/models'
)

/*
  The module imports the assets through Vite's `?url`, which resolves to a hashed
  path rather than to the source file, so the on-disk name is recovered from the
  declared file name instead. `rocket.glb` is served from `rocket-v3.glb`, which
  is exactly the kind of indirection that makes a hand-written byte count rot.
*/
const SOURCE_FILES: Record<string, string> = {
	rocket: 'rocket-v3.glb',
	camera: 'camera-source.glb',
	'sheen-chair': 'sheen-chair-source.glb',
	'toy-car': 'toy-car.glb'
}

describe('sample models', () => {
	it.each(SAMPLE_MODELS)('$id declares the size it actually is', (sample) => {
		const source = SOURCE_FILES[sample.id]
		expect(source, `${sample.id} has no source file mapping`).toBeTruthy()

		expect(statSync(join(MODELS_DIR, source)).size).toBe(sample.bytes)
	})

	it.each(SAMPLE_MODELS)('$id is a real GLB', (sample) => {
		const bytes = readFileSync(join(MODELS_DIR, SOURCE_FILES[sample.id]))

		// The loader rejects anything whose magic is not glTF, so a sample that is
		// not one would fail on click rather than at build time.
		expect(bytes.subarray(0, 4).toString('utf8')).toBe('glTF')
	})

	it('offers one model per pass, so neither mode is undemonstrable', () => {
		// The rocket and the camera, chosen for opposite reasons: see the module
		// docblock for the measured geometry/texture split behind each.
		expect(PASS_SAMPLES.map((sample) => sample.id)).toEqual([
			'rocket',
			'camera'
		])
		expect(new Set(SAMPLE_MODELS.map((sample) => sample.id)).size).toBe(
			SAMPLE_MODELS.length
		)
	})

	it('resolves a sample by id and refuses an unknown one', () => {
		expect(sampleModelById('rocket')?.fileName).toBe('rocket.glb')
		expect(sampleModelById('not-a-sample')).toBeNull()
	})

	/* The home page prints the hero model's size beside it, so it is a claim like a sample's size. */
	describe('hero model', () => {
		const bytes = () => readFileSync(join(MODELS_DIR, HERO_MODEL.fileName))

		it('declares the size it actually is', () => {
			expect(statSync(join(MODELS_DIR, HERO_MODEL.fileName)).size).toBe(
				HERO_MODEL.bytes
			)
		})

		it('is a real GLB', () => {
			expect(bytes().subarray(0, 4).toString('utf8')).toBe('glTF')
		})

		it('claims the camera sample as its source, which it is smaller than', () => {
			expect(HERO_MODEL.sourceBytes).toBe(
				sampleModelById(HERO_SOURCE_SAMPLE_ID)?.bytes
			)
			expect(HERO_MODEL.bytes).toBeLessThan(HERO_MODEL.sourceBytes)
		})
	})
})

/*
  A sample opens by its URL through the loader, so the loader measures the
  download. Against the declared size, because a gzipped response's
  `Content-Length` would understate it, and under its own name rather than the
  build's hashed one.
*/
describe('a sample as the loader opens it', () => {
	it('is its URL, named by its own file name and measured by its size', () => {
		const sample = SAMPLE_MODELS[0]

		expect(sampleModelSource(sample)).toEqual({
			kind: 'url',
			url: sample.url,
			fileName: sample.fileName,
			expectedBytes: sample.bytes
		})
	})
})
