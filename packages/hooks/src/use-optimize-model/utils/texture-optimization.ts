/* vectreal-core | vctrl/hooks
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

import { createBrowserTextureEncoder } from './browser-texture-encoder'

import type {
	ModelOptimizer,
	TextureCompressOptions
} from '@vctrl/core/model-optimizer'

/**
 * Performs client-side texture compression using the browser-native encoder.
 * Delegates directly to optimizer.compressTextures() with the OffscreenCanvas
 * encoder injected — no network round-trip required.
 */
export const optimizeTextures = async (
	optimizer: ModelOptimizer,
	options?: TextureCompressOptions
): Promise<void> => {
	if (!optimizer.hasModel()) {
		return
	}

	await optimizer.compressTextures({
		...options,
		encoder: createBrowserTextureEncoder()
	})
}
