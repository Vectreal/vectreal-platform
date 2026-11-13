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
 * Represents a before/after metric for optimization statistics.
 * Used to track changes in counts (vertices, triangles, etc.) during optimization.
 */
export interface BeforeAfterMetric {
	/** Value before optimization */
	before: number
	/** Value after optimization */
	after: number
}

/**
 * Serialized asset for JSON transfer.
 * Used when Map<string, Uint8Array> needs to be serialized for API transport.
 */
export interface SerializedAsset {
	/** Original filename of the asset */
	fileName: string
	/** Binary data as array of numbers (Uint8Array serialized) */
	data: number[]
	/** MIME type of the asset */
	mimeType: string
}

/**
 * Base interface for operation progress tracking.
 * Used across loading, optimization, and export operations.
 */
export interface OperationProgress {
	/** Current operation name */
	operation: string
	/** Progress percentage (0-100) */
	progress: number
	/** Additional details about the current operation */
	details?: string
	/**
	 * Files the parse has finished and started, from the three.js
	 * `LoadingManager` the parse runs through: textures and buffers. The total
	 * grows as the parser discovers more, so it is a count, not a fraction.
	 */
	items?: ItemProgress
}

/**
 * Where a model load is, in the words every surface uses.
 *
 * - `fetching`: bytes are on their way. The only phase with a real measure.
 * - `parsing`: the bytes are here and become a three.js scene, decoding
 *   Draco, meshopt and KTX2 on the way. Not split further: decoding happens
 *   inside `GLTFLoader.parse` and cannot be watched apart from it.
 * - `preparing`: the viewer has the scene and is loading its environment,
 *   compiling shaders and framing the first view.
 */
export type LoadPhase = 'fetching' | 'parsing' | 'preparing'

/** Bytes arrived, and the size expected; `total` is null when nothing says. */
export interface ByteProgress {
	loaded: number
	total: number | null
}

/** Files done out of files started. */
export interface ItemProgress {
	loaded: number
	total: number
}

/**
 * One load's progress, shared by `@vctrl/hooks` (fetching, parsing) and
 * `@vctrl/viewer` (preparing), so a host can draw both with one indicator.
 */
export interface LoadProgress {
	phase: LoadPhase
	/** Only while fetching. */
	bytes?: ByteProgress
	/** Only while parsing or preparing, and only once a file has started. */
	items?: ItemProgress
}
