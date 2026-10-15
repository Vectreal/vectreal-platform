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
 * The per-texture work, kept out of the class body. When a result is
 * committed is `ModelOptimizer.compressTextures`'s decision.
 */

import { Document, Transform } from '@gltf-transform/core'
import { compressTexture, dedup, prune } from '@gltf-transform/functions'

import { TextureCompressOptions } from './types'

type TextureCompressionEncoder = NonNullable<
	Parameters<typeof compressTexture>[1]
>['encoder']

type ProgressEmitter = (operation: string, progress: number) => void
type TransformRunner = (transforms: Transform[], name: string) => Promise<void>

/**
 * Do not inline this into the `import()` below.
 *
 * sharp is an optional Node-only native module. A literal `import('sharp')`
 * survives this package's build as a literal specifier, so every downstream
 * bundler statically resolves it and pulls sharp's Node builtins into browser
 * bundles. Since sharp 0.35 ships ESM, that is a hard build error rather than
 * an externalization warning:
 *
 *   "spawnSync" is not exported by "__vite-browser-external"
 *
 * Reading the specifier from a binding keeps the import opaque to static
 * analysis while Node still resolves it at runtime. Browser and edge callers
 * pass `options.encoder` and never reach this branch.
 */
const SHARP_SPECIFIER = 'sharp'

/**
 * Some or all textures could not be compressed. The ones that could were
 * replaced; the rest are left as they were. The counts are what a caller needs
 * to tell a partial result, which still stands, from one where nothing changed.
 */
export class TextureCompressionError extends Error {
	readonly failed: number
	readonly total: number

	constructor(failed: number, total: number, message: string) {
		super(message)
		this.name = 'TextureCompressionError'
		this.failed = failed
		this.total = total
	}

	/** True when at least one texture was compressed. */
	get isPartial(): boolean {
		return this.failed < this.total
	}
}

/**
 * The encoder a texture pass runs with: the caller's, or sharp where it can be
 * imported. Null when there is neither, and the pass falls back to
 * `runBasicTextureOptimization`.
 */
export async function resolveTextureEncoder(
	options: TextureCompressOptions
): Promise<TextureCompressionEncoder | null> {
	// Caller-provided, e.g. the OffscreenCanvas encoder in a browser.
	if (options.encoder) return options.encoder as TextureCompressionEncoder

	try {
		const sharpModule = await import(/* @vite-ignore */ SHARP_SPECIFIER)
		const encoder = sharpModule.default || sharpModule

		if (typeof encoder !== 'function') {
			throw new Error('Sharp is not available or not properly installed')
		}
		return encoder
	} catch (error) {
		console.warn(
			'Sharp-based compression failed, applying basic optimization:',
			error
		)
		return null
	}
}

/**
 * Compresses every texture of `document` in place, and returns what failed.
 *
 * Each texture is replaced only once its encode succeeded, so a failure leaves
 * that texture as it was. Whether a partial result stands is the caller's
 * decision, which is why it comes back as a value rather than a throw.
 */
export async function compressDocumentTextures(
	document: Document,
	options: TextureCompressOptions,
	encoder: TextureCompressionEncoder,
	emitProgress: ProgressEmitter
): Promise<TextureCompressionError | null> {
	emitProgress('Compressing textures', 0)

	const textures = document.getRoot().listTextures()
	const failures: Array<{ index: number; reason: string }> = []

	for (let i = 0; i < textures.length; i++) {
		try {
			await compressTexture(textures[i], {
				encoder,
				targetFormat: options.targetFormat,
				quality: options.quality,
				resize: options.resize
			})
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
		return new TextureCompressionError(
			failures.length,
			textures.length,
			`Texture compression failed for ${failures.length} of ${textures.length} textures. ${failureSummary}`
		)
	}

	emitProgress('Texture compression complete', 100)
	return null
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
