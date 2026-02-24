/* vectreal-core | vctrl/hooks
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>. */

// Export hooks
export { default as useLoadModel } from './use-load-model/use-load-model'
export { default as useExportModel } from './use-export-model/use-export-model'
export { default as useOptimizeModel } from './use-optimize-model/use-optimize-model'

// Export utilities
export { reconstructGltfFiles } from './use-load-model/utils/reconstruct-files'
export { ServerCommunicationService } from './utils/server-communication'
export type { ServerRequestConfig } from './utils/server-communication'

// Re-export types for convenience
export type {
	EventTypes,
	EventHandler,
	ModelFile,
	LoadData,
	UseLoadModelReturn,
	SceneDataLoadOptions,
	SceneLoadOptions,
	ServerSceneData,
	SceneLoadResult
} from './use-load-model/types'
