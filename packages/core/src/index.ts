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

// Export all core services
export * from './model-loader'
export * from './model-optimizer'
export * from './model-exporter'

// Re-export commonly used types for convenience
export { ModelFileTypes } from './model-loader'
export type {
	ModelLoadResult,
	LoadProgress,
	ThreeJSModelResult
} from './model-loader'

export type {
	SimplifyOptions,
	DedupOptions,
	QuantizeOptions,
	NormalsOptions,
	TextureCompressOptions,
	ServerOptions,
	OptimizationReport,
	OptimizationProgress
} from './model-optimizer'

export type {
	ExportOptions,
	ExportProgress,
	ExportResult
} from './model-exporter'
