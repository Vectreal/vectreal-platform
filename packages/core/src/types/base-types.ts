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
}
