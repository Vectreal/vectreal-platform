import { CleanupFields } from './fields/cleanup-fields'
import { GeometryCompressionField } from './fields/geometry-compression-field'
import { MeshReductionField } from './fields/mesh-reduction-field'
import { TextureField } from './fields/texture-field'

import type { FC } from 'react'

/**
 * Ordered by what actually moves the needle, which is not the order the
 * pipeline runs them in: geometry compression first because it is the largest
 * saving, then textures, then the cheap cleanup passes, and polygon reduction
 * last because it is the only destructive one.
 */
export const AdvancedPanel: FC = () => (
	<div className="mx-auto w-full max-w-3xl space-y-6">
		<GeometryCompressionField />
		<TextureField />
		<CleanupFields />
		<MeshReductionField />
	</div>
)

export default AdvancedPanel
