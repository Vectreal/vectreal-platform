import { Badge } from '@shared/components/ui/badge'
import { cn } from '@shared/utils'

import type { SceneAssetSummary } from './scene'
import type { SerializedSceneAssetDataMap } from '../../../types/api'

function formatBytes(bytes: number | null | undefined): string {
	if (bytes == null || Number.isNaN(bytes)) return '—'
	if (bytes === 0) return '0 B'
	const units = ['B', 'KB', 'MB', 'GB']
	const i = Math.floor(Math.log(bytes) / Math.log(1024))
	return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

type TextureAssetProps = {
	asset: SceneAssetSummary & { type: 'texture' }
	textureUrl: string
	className?: string
}

type OtherAssetProps = {
	asset: Omit<SceneAssetSummary, 'type'> & { type: string }
	textureUrl?: never
	className?: string
}

type SceneAssetListItemProps = TextureAssetProps | OtherAssetProps

/** Derives a base64 data URL for a texture asset from the serialized asset map. */
function resolveTextureUrl(
	asset: SceneAssetSummary,
	assetData: SerializedSceneAssetDataMap | null | undefined
): string | undefined {
	if (
		asset.type !== 'texture' ||
		!asset.mimeType ||
		!asset.fileSize ||
		!assetData?.[asset.id]
	) {
		return undefined
	}
	const entry = assetData[asset.id]
	if (typeof entry.data !== 'string') return undefined
	return `data:${asset.mimeType};base64,${entry.data}`
}

/**
 * Builds typed props for SceneAssetListItem, enforcing that textureUrl
 * is present and required when the asset is of type 'texture'.
 */
export function buildAssetListItemProps(
	asset: SceneAssetSummary,
	assetData?: SerializedSceneAssetDataMap | null
): TextureAssetProps | OtherAssetProps {
	if (asset.type === 'texture') {
		const textureUrl = resolveTextureUrl(asset, assetData)
		if (textureUrl) {
			return {
				asset: asset as SceneAssetSummary & { type: 'texture' },
				textureUrl
			}
		}
	}
	return { asset }
}

export function SceneAssetListItem({
	asset,
	textureUrl,
	className
}: SceneAssetListItemProps) {
	return (
		<div className={cn('flex items-center gap-3 rounded-xl p-3', className)}>
			{textureUrl && (
				<img
					src={textureUrl}
					alt={asset.name}
					className="h-10 w-10 shrink-0 rounded-lg object-cover"
				/>
			)}
			<div className="min-w-0 flex-1">
				<div className="flex items-center justify-between gap-2">
					<p className="truncate text-sm font-medium">{asset.name}</p>
					<Badge variant="secondary" className="shrink-0">
						{asset.type}
					</Badge>
				</div>
				<p className="text-muted-foreground mt-1 text-xs">
					{formatBytes(asset.fileSize)}
					{asset.mimeType ? ` • ${asset.mimeType}` : ''}
				</p>
			</div>
		</div>
	)
}
