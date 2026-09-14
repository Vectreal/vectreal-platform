import { Badge } from '@shared/components/ui/badge'
import { cn, formatFileSize } from '@shared/utils'

import type { TextureThumbnailUrls } from '../../hooks/use-texture-thumbnail-urls'
import type { SceneAssetSummary } from '../../types/dashboard'

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

/**
 * Builds typed props for SceneAssetListItem, enforcing that textureUrl
 * is present and required when the asset is of type 'texture'.
 *
 * Takes a URL per asset rather than the asset's bytes. The bytes used to be
 * passed down to here and base64-encoded one character at a time on every
 * recomputation; the page now makes one object URL per image and this only
 * looks it up. See `useTextureThumbnailUrls` for why bytes must not travel
 * through props at all.
 */
export function buildAssetListItemProps(
	asset: SceneAssetSummary,
	textureUrls?: TextureThumbnailUrls
): TextureAssetProps | OtherAssetProps {
	if (asset.type === 'texture') {
		const textureUrl = textureUrls?.[asset.id]
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
					{formatFileSize(asset.fileSize)}
					{asset.mimeType ? ` • ${asset.mimeType}` : ''}
				</p>
			</div>
		</div>
	)
}
