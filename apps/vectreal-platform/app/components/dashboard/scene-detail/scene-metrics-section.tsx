import { DetailPanelSection, StatGrid, StatTile } from '../../layout-components'

import type { SceneDetailsSummary } from '../../../types/dashboard'

/**
 * Bytes as a scene page says them.
 *
 * Not `formatFileSize` from `@shared/utils`, and not the copy inside
 * `scene-asset-list-item.tsx`: all three round differently, and swapping one for
 * another here would change every figure on this surface for no reason anybody
 * asked for. The three are a real duplication and are filed as their own row.
 */
function formatBytes(bytes: number | null | undefined): string {
	if (bytes == null || Number.isNaN(bytes)) {
		return '-'
	}

	if (bytes === 0) {
		return '0 B'
	}

	const units = ['B', 'KB', 'MB', 'GB']
	const index = Math.min(
		Math.floor(Math.log(bytes) / Math.log(1024)),
		units.length - 1
	)
	const size = bytes / 1024 ** index
	return `${size >= 100 ? Math.round(size) : size.toFixed(size < 10 ? 1 : 0)} ${units[index]}`
}

/**
 * Texture weight, or the count when the weight was never recorded.
 *
 * Both figures come from optimizer stats that predate each other, so a scene
 * saved before `currentTextureBytes` existed has only a count. Saying
 * "4 textures" under a heading that reads Texture Size is worse than a dash
 * only if the dash is the truth, and it is not.
 */
function describeTextures(details: SceneDetailsSummary): string {
	if (details.textureBytes != null) {
		return formatBytes(details.textureBytes)
	}

	if (details.textureCount != null) {
		return `${details.textureCount} textures`
	}

	return '-'
}

interface SceneMetricsSectionProps {
	details: SceneDetailsSummary
	/**
	 * The rung this sits on in its host's outline.
	 *
	 * `h2` in the aside, which is the top of this page's outline because
	 * `dashboard-layout.tsx` suppresses `DashboardHeader` on the scene route.
	 * `h3` inside the details sheet, whose `DrawerTitle` Radix renders as the
	 * `h2` above it - without this the section would announce as a peer of its
	 * own container.
	 */
	headingLevel?: 'h2' | 'h3'
}

/**
 * What the scene weighs, in one grid.
 *
 * There were two of these - one in the aside, one in the drawer - and they had
 * drifted apart on labels for identical numbers: `Size` against `Current Size`,
 * `Meshes` against `Meshes / Vertices`. This is the surviving label set.
 *
 * Two hosts now: the aside, and the details sheet that stands in for it below
 * `xl`. They sit at different depths, which is why `headingLevel` is a prop and
 * not the constant it was while the aside was the only host.
 */
export function SceneMetricsSection({
	details,
	headingLevel = 'h2'
}: SceneMetricsSectionProps) {
	return (
		<DetailPanelSection
			eyebrow="At a Glance"
			title="Scene Metrics"
			headingLevel={headingLevel}
		>
			<StatGrid>
				<StatTile label="Size" value={formatBytes(details.fileSizeBytes)} />
				<StatTile label="Assets" value={details.assetCount} />
				<StatTile label="Texture Size" value={describeTextures(details)} />
				<StatTile
					label="Meshes / Vertices"
					value={`${details.meshesCount ?? '-'} / ${details.verticesCount ?? '-'}`}
				/>
			</StatGrid>
		</DetailPanelSection>
	)
}
