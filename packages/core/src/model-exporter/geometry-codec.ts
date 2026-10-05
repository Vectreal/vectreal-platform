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
 * How a published GLB's geometry is encoded, in order of decode cost: plain
 * accessors cost nothing, meshopt decodes at memory speed in the parse, and
 * Draco needs a WebAssembly decoder, its download, and a worker round trip.
 */
export type GeometryCodec = 'none' | 'meshopt' | 'draco'

/**
 * Transfer size of the geometry under each codec, in gzipped bytes because the
 * origin gzips `model/gltf-binary`. A codec that was not measured, because it
 * is off or its encoder could not run, is absent.
 */
export interface GeometryCodecSizes {
	none: number
	meshopt?: number
	draco?: number
}

/** How much larger than Draco meshopt may be and still be chosen. */
export const DRACO_SIZE_MARGIN = 0.15

/**
 * The codec a published GLB ships its geometry in.
 *
 * Draco is the only codec whose decode is worth paying bytes to avoid, so it
 * has to win by more than `margin`. Between plain and meshopt the smaller
 * one wins, plain on a tie because meshopt's quantization is lossy.
 */
export function pickGeometryCodec(
	sizes: GeometryCodecSizes,
	margin = DRACO_SIZE_MARGIN
): GeometryCodec {
	const cheap: GeometryCodec =
		sizes.meshopt !== undefined && sizes.meshopt < sizes.none
			? 'meshopt'
			: 'none'
	const cheapBytes =
		cheap === 'meshopt' ? (sizes.meshopt as number) : sizes.none

	return sizes.draco !== undefined && cheapBytes > sizes.draco * (1 + margin)
		? 'draco'
		: cheap
}

/** Size of `bytes` once gzipped, as a browser receives them from the origin. */
export async function gzipSize(bytes: Uint8Array): Promise<number> {
	const gzipped = new Blob([bytes as Uint8Array<ArrayBuffer>])
		.stream()
		.pipeThrough(new CompressionStream('gzip'))
	return (await new Response(gzipped).arrayBuffer()).byteLength
}
