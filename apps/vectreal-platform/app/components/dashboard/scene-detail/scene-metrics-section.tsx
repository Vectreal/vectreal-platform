import { formatFileSize } from '@shared/utils'

import { DetailPanelSection, StatGrid, StatTile } from '../../layout-components'

import type { SceneDetailsSummary } from '../../../types/dashboard'

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
		return formatFileSize(details.textureBytes)
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
 *
 * No eyebrow. `At a Glance` labelled the section as a category above its own
 * name, which said nothing the heading did not - and it was the last kicker in
 * the column once Publishing gained a real title.
 */
export function SceneMetricsSection({
	details,
	headingLevel = 'h2'
}: SceneMetricsSectionProps) {
	return (
		<DetailPanelSection title="Scene Metrics" headingLevel={headingLevel}>
			<StatGrid>
				<StatTile label="Size" value={formatFileSize(details.fileSizeBytes)} />
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
