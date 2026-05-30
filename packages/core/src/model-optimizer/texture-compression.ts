/* vectreal-core | @vctrl/core
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>. */

/**
 * Texture compression helpers for ModelOptimizer.
 *
 * `runTextureCompression` and `runBasicTextureOptimization` are extracted from
 * the class body so that `model-optimizer.ts` stays below 500 lines.
 */

import { Document, Transform } from '@gltf-transform/core'
import { compressTexture, dedup, prune } from '@gltf-transform/functions'

import { targetFormatToMimeType } from './texture-naming'
import { TextureCompressOptions } from './types'

type TextureCompressionEncoder = NonNullable<
	Parameters<typeof compressTexture>[1]
>['encoder']

type ProgressEmitter = (operation: string, progress: number) => void
type TransformRunner = (transforms: Transform[], name: string) => Promise<void>

/**
 * Run texture compression on a loaded document.
 * Returns the list of applied optimization labels to append.
 */
export async function runTextureCompression(
	document: Document,
	options: TextureCompressOptions,
	emitProgress: ProgressEmitter,
	applyTransforms: TransformRunner
): Promise<void> {
	emitProgress('Compressing textures', 0)

	let encoder: TextureCompressionEncoder

	if (options.encoder) {
		// Use caller-provided encoder (e.g. OffscreenCanvas encoder in browser, imagescript in Deno)
		encoder = options.encoder as TextureCompressionEncoder
	} else {
		try {
			const sharpModule = await import(/* @vite-ignore */ 'sharp')
			encoder = sharpModule.default || sharpModule

			if (typeof encoder !== 'function') {
				throw new Error('Sharp is not available or not properly installed')
			}
		} catch (error) {
			console.warn(
				'Sharp-based compression failed, applying basic optimization:',
				error
			)
			await runBasicTextureOptimization(emitProgress, applyTransforms)
			return
		}
	}

	const { encoder: _encoder, ...textureCompressOptions } = options
	const expectedMimeType = targetFormatToMimeType(
		textureCompressOptions.targetFormat
	)

	const textures = document.getRoot().listTextures()
	const failures: Array<{ index: number; reason: string }> = []

	for (let i = 0; i < textures.length; i++) {
		const texture = textures[i]

		try {
			await compressTexture(texture, {
				encoder,
				targetFormat: textureCompressOptions.targetFormat,
				quality: textureCompressOptions.quality,
				resize: textureCompressOptions.resize
			})

			if (expectedMimeType && texture.getMimeType() !== expectedMimeType) {
				throw new Error(
					`expected ${expectedMimeType}, received ${texture.getMimeType() || 'unknown mime type'}`
				)
			}
		} catch (error) {
			failures.push({
				index: i,
				reason: error instanceof Error ? error.message : String(error)
			})
			console.warn(`Failed to compress texture ${i}:`, error)
		}

		emitProgress(
			'Compressing textures',
			Math.round(((i + 1) / textures.length) * 100)
		)
	}

	if (failures.length > 0) {
		const failureSummary = failures
			.map((failure) => `#${failure.index}: ${failure.reason}`)
			.join('; ')
		throw new Error(
			`Texture compression failed for ${failures.length} of ${textures.length} textures. ${failureSummary}`
		)
	}

	emitProgress('Texture compression complete', 100)
}

/**
 * Apply basic texture optimization without an encoder (dedup + prune fallback).
 */
export async function runBasicTextureOptimization(
	emitProgress: ProgressEmitter,
	applyTransforms: TransformRunner
): Promise<void> {
	emitProgress('Applying basic texture optimization', 50)

	const transforms = [
		dedup(), // Remove duplicate resources including textures
		prune() // Remove unused resources including textures
	]

	await applyTransforms(transforms, 'basic texture optimization')

	console.warn(
		'Applied basic texture optimization only. ' +
			'For advanced compression (WebP, JPEG conversion), ensure Sharp is properly configured.'
	)

	emitProgress('Basic texture optimization complete', 100)
}
