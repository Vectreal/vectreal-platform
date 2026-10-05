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

import type { WebGLRenderer } from 'three'
import type { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'

interface MemoizedLoader {
	transcoderPath: string
	loader: Promise<KTX2Loader>
}

let memoized: MemoizedLoader | null = null

interface CompressedTextureSupport {
	extensions: ReadonlySet<string>
	astcProfiles: readonly string[]
}

const NO_SUPPORT: CompressedTextureSupport = {
	extensions: new Set(),
	astcProfiles: []
}

/**
 * The compressed formats this device's WebGL exposes.
 *
 * `KTX2Loader.detectSupport` wants a renderer, and models are parsed before
 * the viewer's canvas exists, so a throwaway context answers instead and is
 * released straight away. Without one every format reads as unsupported, and
 * the transcoder falls back to uncompressed RGBA, which every GPU can upload.
 */
function detectCompressedTextureSupport(): CompressedTextureSupport {
	const canvas =
		typeof OffscreenCanvas !== 'undefined'
			? new OffscreenCanvas(1, 1)
			: typeof document !== 'undefined'
				? document.createElement('canvas')
				: null
	const gl = (canvas?.getContext('webgl2') ?? canvas?.getContext('webgl')) as
		WebGLRenderingContext | null | undefined
	if (!gl) return NO_SUPPORT

	const extensions = new Set(gl.getSupportedExtensions() ?? [])
	const astc = extensions.has('WEBGL_compressed_texture_astc')
		? gl.getExtension('WEBGL_compressed_texture_astc')
		: null
	const astcProfiles = astc?.getSupportedProfiles() ?? []
	gl.getExtension('WEBGL_lose_context')?.loseContext()

	return { extensions, astcProfiles }
}

/**
 * The part of a renderer `detectSupport` reads. three never touches
 * `capabilities` there, only `extensions.has` and, for ASTC HDR, `get`.
 */
function rendererReporting({
	extensions,
	astcProfiles
}: CompressedTextureSupport): WebGLRenderer {
	return {
		isWebGPURenderer: false,
		extensions: {
			has: (name: string) => extensions.has(name),
			get: () => ({ getSupportedProfiles: () => astcProfiles })
		}
	} as unknown as WebGLRenderer
}

/**
 * Returns a memoized `THREE.KTX2Loader` for `GLTFLoader.setKTX2Loader()`,
 * shared so the transcoder and its workers are only spun up once.
 *
 * Created on first use only, by a model that declares `KHR_texture_basisu`,
 * because creating it opens the throwaway WebGL context above.
 *
 * As with `getThreeDracoLoader`, a loader whose transcoder download fails
 * keeps that rejection forever, so it is disposed and dropped and the next
 * caller gets a new one.
 */
export async function getThreeKtx2Loader(
	transcoderPath: string
): Promise<KTX2Loader> {
	// One transcoder path per page, as with Draco: a loader for a path given
	// up on is left alive, because a parse may still be transcoding with it and
	// disposing it would leave that parse waiting forever.
	if (memoized?.transcoderPath === transcoderPath) return memoized.loader

	const entry: MemoizedLoader = {
		transcoderPath,
		loader: import('three/examples/jsm/loaders/KTX2Loader.js').then(
			({ KTX2Loader }) => {
				const loader = new KTX2Loader()
					.setTranscoderPath(transcoderPath)
					.detectSupport(rendererReporting(detectCompressedTextureSupport()))

				// Disposed once: three counts active loaders, and twice miscounts.
				const init = loader.init.bind(loader)
				let disposed = false
				loader.init = () =>
					init().catch((error: unknown) => {
						if (memoized === entry) memoized = null
						if (!disposed) {
							disposed = true
							loader.dispose()
						}
						throw error
					})

				return loader
			}
		)
	}
	memoized = entry

	return entry.loader
}

/**
 * Downloads the transcoder ahead of the first texture that needs it, and
 * reports a failed download to the caller.
 */
export async function prepareThreeKtx2Transcoder(
	transcoderPath: string
): Promise<void> {
	const loader = await getThreeKtx2Loader(transcoderPath)
	await loader.init()
}
