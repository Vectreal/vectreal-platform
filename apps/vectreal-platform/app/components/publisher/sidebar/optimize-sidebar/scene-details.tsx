import { formatFileSize } from '@shared/utils'
import type { OptimizationReport } from '@vctrl/core'
import { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'
import { Box, Grid, LayersIcon, Shapes } from 'lucide-react'

interface SceneDetailsProps {
	info: OptimizationInfo
	report?: OptimizationReport | null
}

const SceneDetails = ({
	info: { initial, optimized },
	report
}: SceneDetailsProps) => {
	const textureSizeInitial = initial.texturesCount
	const textureSizeOptimized = optimized.texturesCount
	const textureCountInitial = report?.stats.texturesCount?.before ?? null
	const textureCountOptimized = report?.stats.texturesCount?.after ?? null
	const textureResolutionsInitial =
		report?.stats.textureResolutions?.before ?? []
	const textureResolutionsOptimized =
		report?.stats.textureResolutions?.after ?? []
	const showTextureResolutions =
		textureResolutionsInitial.length > 0 ||
		textureResolutionsOptimized.length > 0
	const formatCount = (value: number | null) =>
		value === null ? '—' : value.toLocaleString()
	const formatResolutions = (values: string[]) => values.join(', ')
	const formatBytes = (value: number) => formatFileSize(value)

	return (
		<div className="bg-muted/25 grid grid-cols-2 gap-4 rounded-xl p-4 text-sm">
			<div className="flex items-center space-x-2">
				<LayersIcon className="h-5 w-5 text-zinc-400" />
				<div>
					<p className="text-sm font-medium">Vertex Count</p>
					<p className="text-xs text-zinc-400">
						{initial.verticesCount.toLocaleString()} →{' '}
						{optimized.verticesCount.toLocaleString()}
					</p>
				</div>
			</div>

			<div className="flex items-center space-x-2">
				<Box className="h-5 w-5 text-zinc-400" />
				<div>
					<p className="text-sm font-medium">Triangle Count</p>
					<p className="text-xs text-zinc-400">
						{initial.primitivesCount.toLocaleString()} →{' '}
						{optimized.primitivesCount.toLocaleString()}
					</p>
				</div>
			</div>
			<div className="flex items-center space-x-2">
				<Grid className="h-5 w-5 text-zinc-400" />
				<div>
					<p className="text-sm font-medium">Mesh Count</p>
					<p className="text-xs text-zinc-400">
						{initial.meshesCount.toLocaleString()} →{' '}
						{optimized.meshesCount.toLocaleString()}
					</p>
				</div>
			</div>

			<div className="flex items-center space-x-2">
				<Shapes className="h-5 w-5 text-zinc-400" />
				<div>
					<p className="text-sm font-medium">Texture Size</p>
					<p className="text-xs text-zinc-400">
						{formatBytes(textureSizeInitial)} →{' '}
						{formatBytes(textureSizeOptimized)}
					</p>
				</div>
			</div>

			<div className="flex items-center space-x-2">
				<Shapes className="h-5 w-5 text-zinc-400" />
				<div>
					<p className="text-sm font-medium">Texture Count</p>
					<p className="text-xs text-zinc-400">
						{formatCount(textureCountInitial)} →{' '}
						{formatCount(textureCountOptimized)}
					</p>
				</div>
			</div>

			{showTextureResolutions ? (
				<div className="col-span-2 flex items-center space-x-2">
					<Shapes className="h-5 w-5 text-zinc-400" />
					<div>
						<p className="text-sm font-medium">Texture Resolutions</p>
						<p className="text-xs text-zinc-400">
							{formatResolutions(textureResolutionsInitial)} →{' '}
							{formatResolutions(textureResolutionsOptimized)}
						</p>
					</div>
				</div>
			) : null}
		</div>
	)
}

export default SceneDetails
