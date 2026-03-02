import { OptimizationInfo } from '@vctrl/hooks/use-optimize-model'
import { Box, Grid, LayersIcon, Shapes } from 'lucide-react'

import {
	buildSceneMetrics,
	formatMetricBytes,
	formatMetricCount,
	formatMetricResolutions
} from './scene-metrics'

import type { SizeInfo } from './use-optimization-process'
import type { SceneStatsData } from '../../../../types/api'
import type { OptimizationReport } from '@vctrl/core'

interface SceneDetailsProps {
	info: OptimizationInfo
	report?: OptimizationReport | null
	sizeInfo: SizeInfo
	stats?: SceneStatsData | null
}

const SceneDetails = ({
	info,
	report,
	sizeInfo,
	stats
}: SceneDetailsProps) => {
	const metrics = buildSceneMetrics({ info, report, sizeInfo, stats })
	const showTextureResolutions =
		metrics.textureResolutionsInitial.length > 0 ||
		metrics.textureResolutionsOptimized.length > 0

	return (
		<div className="bg-muted/25 grid grid-cols-2 gap-4 rounded-xl p-4 text-sm">
			<div className="flex items-center space-x-2">
				<LayersIcon className="h-5 w-5 text-zinc-400" />
				<div>
					<p className="text-sm font-medium">Vertex Count</p>
					<p className="text-xs text-zinc-400">
						{metrics.vertexInitial.toLocaleString()} →{' '}
						{metrics.vertexOptimized.toLocaleString()}
					</p>
				</div>
			</div>

			<div className="flex items-center space-x-2">
				<Box className="h-5 w-5 text-zinc-400" />
				<div>
					<p className="text-sm font-medium">Triangle Count</p>
					<p className="text-xs text-zinc-400">
						{metrics.triangleInitial.toLocaleString()} →{' '}
						{metrics.triangleOptimized.toLocaleString()}
					</p>
				</div>
			</div>
			<div className="flex items-center space-x-2">
				<Grid className="h-5 w-5 text-zinc-400" />
				<div>
					<p className="text-sm font-medium">Mesh Count</p>
					<p className="text-xs text-zinc-400">
						{metrics.meshInitial.toLocaleString()} →{' '}
						{metrics.meshOptimized.toLocaleString()}
					</p>
				</div>
			</div>

			<div className="flex items-center space-x-2">
				<Shapes className="h-5 w-5 text-zinc-400" />
				<div>
					<p className="text-sm font-medium">Texture Size</p>
					<p className="text-xs text-zinc-400">
						{formatMetricBytes(metrics.textureSizeInitial)} →{' '}
						{formatMetricBytes(metrics.textureSizeOptimized)}
					</p>
				</div>
			</div>

			<div className="flex items-center space-x-2">
				<LayersIcon className="h-5 w-5 text-zinc-400" />
				<div>
					<p className="text-sm font-medium">Scene Size</p>
					<p className="text-xs text-zinc-400">
						{formatMetricBytes(metrics.sceneBytesInitial)} →{' '}
						{formatMetricBytes(metrics.sceneBytesCurrent)}
					</p>
				</div>
			</div>

			<div className="flex items-center space-x-2">
				<Shapes className="h-5 w-5 text-zinc-400" />
				<div>
					<p className="text-sm font-medium">Texture Count</p>
					<p className="text-xs text-zinc-400">
						{formatMetricCount(metrics.textureCountInitial)} →{' '}
						{formatMetricCount(metrics.textureCountOptimized)}
					</p>
				</div>
			</div>

			{showTextureResolutions ? (
				<div className="col-span-2 flex items-center space-x-2">
					<Shapes className="h-5 w-5 text-zinc-400" />
					<div>
						<p className="text-sm font-medium">Texture Resolutions</p>
						<p className="text-xs text-zinc-400">
							{formatMetricResolutions(metrics.textureResolutionsInitial)} →{' '}
							{formatMetricResolutions(metrics.textureResolutionsOptimized)}
						</p>
					</div>
				</div>
			) : null}
		</div>
	)
}

export default SceneDetails
