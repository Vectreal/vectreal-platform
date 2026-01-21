import { formatFileSize } from '@shared/utils'
import { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'
import { Box, FileIcon, Grid, LayersIcon } from 'lucide-react'

interface SceneDetailsProps {
	info: OptimizationInfo
}

const SceneDetails = ({ info: { initial, optimized } }: SceneDetailsProps) => {
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
					<p className="text-sm font-medium">GL Primitives</p>
					<p className="text-xs text-zinc-400">
						{initial.primitivesCount.toLocaleString()} →{' '}
						{optimized.primitivesCount.toLocaleString()}
					</p>
				</div>
			</div>
			<div className="flex items-center space-x-2">
				<Grid className="h-5 w-5 text-zinc-400" />
				<div>
					<p className="text-sm font-medium">Meshes Size</p>
					<p className="text-xs text-zinc-400">
						{formatFileSize(initial.meshesSize)} →{' '}
						{formatFileSize(optimized.meshesSize)}
					</p>
				</div>
			</div>

			<div className="flex items-center space-x-2">
				<FileIcon className="h-5 w-5 text-zinc-400" />
				<div>
					<p className="text-sm font-medium">Textures Size</p>
					<p className="text-xs text-zinc-400">
						{formatFileSize(initial.texturesSize)} →{' '}
						{formatFileSize(optimized.texturesSize)}
					</p>
				</div>
			</div>
		</div>
	)
}

export default SceneDetails
