import { Badge } from '@shared/components/ui/badge'
import { cn } from '@shared/utils'
import { toSerializedAssetBytes } from '@vctrl/core'

import type { SceneAssetSummary } from '../../routes/dashboard-page/projects/scene'
import type { SerializedSceneAssetDataMap } from '../../types/api'

function formatBytes(bytes: number | null | undefined): string {
	if (bytes == null || Number.isNaN(bytes)) return '-'
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

export type SceneAssetListItemProps = TextureAssetProps | OtherAssetProps

function bytesToBase64(bytes: Uint8Array): string {
	let binary = ''
	for (let index = 0; index < bytes.length; index += 1) {
		binary += String.fromCharCode(bytes[index])
	}
	return btoa(binary)
}

/**
 * Derives a preview data URL for a texture asset from serialized asset bytes.
 * Accepts number[]/Uint8Array/base64 payloads via toSerializedAssetBytes.
 */
function resolveTextureUrl(
	asset: SceneAssetSummary,
	assetData: SerializedSceneAssetDataMap | null | undefined
): string | undefined {
	if (asset.type !== 'texture' || !assetData?.[asset.id]) {
		return undefined
	}

	const entry = assetData[asset.id]
	if (!entry?.mimeType) {
		return undefined
	}

	const bytes = toSerializedAssetBytes(entry)
	if (bytes.length === 0) {
		return undefined
	}

	return `data:${entry.mimeType};base64,${bytesToBase64(bytes)}`
}

/**
 * Builds typed props for SceneAssetListItem, enforcing that textureUrl
 * is present and required when the asset is of type 'texture'.
 */
export function buildAssetListItemProps(
	asset: SceneAssetSummary,
	assetData?: SerializedSceneAssetDataMap | null
): TextureAssetProps | OtherAssetProps {
	if (asset.type === 'texture' && assetData) {
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
