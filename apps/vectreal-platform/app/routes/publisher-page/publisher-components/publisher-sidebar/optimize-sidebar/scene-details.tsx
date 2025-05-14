import { formatFileSize } from '@vctrl-ui/utils'
import { Box, FileIcon, LayersIcon } from 'lucide-react'

interface DetailsData {
	initial: number
	current: number
}

interface SceneDetailsProps {
	vertices: DetailsData
	primitives: DetailsData
	textures: DetailsData
}

const SceneDetails = ({
	vertices,
	primitives,
	textures
}: SceneDetailsProps) => {
	return (
		<div className="bg-muted/25 grid grid-cols-2 gap-4 rounded-xl p-4 text-sm">
			<div className="flex items-center space-x-2">
				<LayersIcon className="h-5 w-5 text-zinc-400" />
				<div>
					<p className="text-sm font-medium">Vertex Count</p>
					<p className="text-xs text-zinc-400">
						{vertices.initial.toLocaleString()} →{' '}
						{vertices.current.toLocaleString()}
					</p>
				</div>
			</div>

			<div className="flex items-center space-x-2">
				<Box className="h-5 w-5 text-zinc-400" />
				<div>
					<p className="text-sm font-medium">GL Primitives</p>
					<p className="text-xs text-zinc-400">
						{primitives.initial.toLocaleString()} →{' '}
						{primitives.current.toLocaleString()}
					</p>
				</div>
			</div>
			<div className="flex items-center space-x-2">
				<FileIcon className="h-5 w-5 text-zinc-400" />
				<div>
					<p className="text-sm font-medium">Textures Size</p>
					<p className="text-xs text-zinc-400">
						{formatFileSize(textures.initial)} →{' '}
						{formatFileSize(textures.current)}
					</p>
				</div>
			</div>
		</div>
	)
}

export default SceneDetails
