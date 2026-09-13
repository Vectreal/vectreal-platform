import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Progress } from '@shared/components/ui/progress'
import { data, Link, useLoaderData } from 'react-router'

import { Route } from './+types/usage'
import { UsageMeter, UsageMeterGrid } from '../../components/dashboard'
import { DetailPanelSection } from '../../components/layout-components'
import { DASHBOARD_ROUTES } from '../../constants/dashboard'
import {
	LIMIT_DISPLAY_LABELS,
	PLAN_DISPLAY_NAMES,
	STORAGE_USAGE_HINT,
	STORAGE_USAGE_LABEL
} from '../../constants/product-copy'
import { loadAuthenticatedUser } from '../../lib/domain/auth/auth-loader.server'
import {
	loadHeaviestScenes,
	loadLargestAssets,
	loadOrgUsage,
	loadProjectUsageBreakdown,
	loadStorageByAssetType
} from '../../lib/domain/billing/billing-dashboard-loader.server'
import {
	getOrgSubscription,
	getQuotaLimit
} from '../../lib/domain/billing/entitlement-service.server'
import { describeUsageVerdict } from '../../lib/domain/dashboard/usage-verdict'

const MB = 1024 * 1024

/*
  A quarter of a whole scene's storage allowance, in one file.

  Not a number chosen here: `storage_bytes_per_scene` is enforced, varies by
  plan, and is what a heavy asset is actually competing for. A configurable
  threshold would want somewhere to live, and the only candidate -
  `org_limit_overrides` - has no write path in the product, so it would be a
  setting nobody can set. Filed rather than faked.
*/
const HEAVY_SHARE_OF_SCENE = 0.25

/** Relative where it is recent, absolute once it stops being news. */
function formatChanged(iso: string) {
	const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)

	if (days < 1) return 'today'
	if (days === 1) return 'yesterday'
	if (days < 30) return `${days} days ago`

	return new Date(iso).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	})
}

export async function loader({ request }: Route.LoaderArgs) {
	const { userWithDefaults, headers } = await loadAuthenticatedUser(request)
	const organizationId = userWithDefaults.organization.id

	const [usage, byProject, byType, largest, heaviest, { plan }, perSceneLimit] =
		await Promise.all([
			loadOrgUsage(organizationId),
			loadProjectUsageBreakdown(organizationId),
			loadStorageByAssetType(organizationId),
			loadLargestAssets(organizationId),
			loadHeaviestScenes(organizationId),
			getOrgSubscription(organizationId),
			getQuotaLimit(organizationId, 'storage_bytes_per_scene')
		])

	return data(
		{
			usage,
			byProject,
			byType,
			largest,
			heaviest,
			plan,
			perSceneLimit: perSceneLimit.limit
		},
		{ headers }
	)
}

export { DashboardErrorBoundary as ErrorBoundary } from '../../components/errors'

/**
 * What this organization is consuming, against what its plan allows.
 *
 * Its own route because consumption and money are different questions. The same
 * five readings were rendered on `/dashboard/billing`, which exists to answer
 * what you pay and how, and four of them again on `/dashboard`, which exists to
 * get someone back into work. Neither page was asking this.
 *
 * Splitting it also gives a refusal somewhere to point. A quota rejection needs
 * to say why, and "you are at 10 of 10 scenes" is not a sentence a billing page
 * should have to carry.
 *
 * One column of rows, not a grid, for the reason the billing panel gave before
 * it moved: five cells across two columns leave the last one alone beside an
 * empty cell, and the row variant drops its rail entirely on an unlimited
 * limit, which in a grid would show as a gap under whichever neighbour still
 * had one.
 */
const UsagePage = () => {
	const { usage, byProject, byType, largest, heaviest, plan, perSceneLimit } =
		useLoaderData<typeof loader>()

	const readings = [
		{
			key: 'scenes_total' as const,
			label: LIMIT_DISPLAY_LABELS.scenes_total,
			current: usage.scenesTotal,
			limit: usage.sceneLimit
		},
		{
			key: 'scenes_published_concurrent' as const,
			label: LIMIT_DISPLAY_LABELS.scenes_published_concurrent,
			current: usage.publishedScenes,
			limit: usage.publishedSceneLimit
		},
		{
			key: 'projects_total' as const,
			label: LIMIT_DISPLAY_LABELS.projects_total,
			current: usage.projectsTotal,
			limit: usage.projectsLimit
		},
		{
			key: 'folders_total' as const,
			label: LIMIT_DISPLAY_LABELS.folders_total,
			current: usage.foldersTotal,
			limit: usage.foldersLimit
		},
		{
			/* Megabytes on both sides: the meter formats reading and limit with
			   one function, so bytes on one and MB on the other is how a bar
			   reads full at a fraction of its limit. */
			key: 'storage_bytes_total' as const,
			label: `${STORAGE_USAGE_LABEL} (MB)`,
			hint: STORAGE_USAGE_HINT,
			current: Math.round(usage.storageBytesTotal / MB),
			limit:
				usage.storageLimit !== null ? Math.round(usage.storageLimit / MB) : null
		}
	]

	const planLabel = PLAN_DISPLAY_NAMES[plan]
	const verdict = describeUsageVerdict(readings, planLabel)
	const binding = readings.find((r) => r.key === verdict.bindingKey)
	const rest = readings.filter((r) => r.key !== verdict.bindingKey)

	return (
		<div className="space-y-4 p-6">
			{/*
			  The verdict, then its evidence, then everything else.

			  Five equally-weighted tiles made the reader compare them to find the
			  one that mattered, which is work the page can do. When something is
			  binding it is shown large beside the answer and the remedy; when
			  nothing is, there is no hero and the readings are a quiet list.
			*/}
			<section className="ds-raised space-y-4 rounded-2xl p-5">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-0 space-y-1">
						<h2 className="text-h3">{verdict.headline}</h2>
						{verdict.remedy ? (
							<p className="text-muted-foreground text-sm">{verdict.remedy}</p>
						) : null}
					</div>
					<Badge variant="secondary">{planLabel}</Badge>
				</div>

				{/*
				  A rail only where the reading can move. On the `plan` tone the
				  binding limit is one, occupied - "Free includes one project" - and
				  a full destructive bar under that sentence says something is wrong
				  while the sentence says this is simply the plan. It is a plan
				  attribute, not a meter, so the sentence carries it alone.
				*/}
				{binding && verdict.tone !== 'plan' ? (
					<UsageMeter
						label={binding.label}
						hint={binding.hint}
						current={binding.current}
						limit={binding.limit}
					/>
				) : null}

				{/*
				  The unlimited case has no readings worth a rail - every one of them
				  says "No limit" - so the list is skipped rather than rendered as
				  five identical nothings.
				*/}
				{verdict.tone === 'unlimited' ? null : (
					<UsageMeterGrid
						className={
							binding && verdict.tone !== 'plan'
								? 'lg:grid-cols-4'
								: 'lg:grid-cols-3'
						}
					>
						{rest.map((reading) => (
							<UsageMeter
								key={reading.key}
								label={reading.label}
								hint={reading.hint}
								current={reading.current}
								limit={reading.limit}
							/>
						))}
					</UsageMeterGrid>
				)}
			</section>

			{heaviest.length > 0 ? (
				<DetailPanelSection surface="raised" title="Heaviest scenes">
					{/*
					  The actionable unit. A project total says where to look, a file
					  says what is fat, but a scene is the thing you open in the
					  publisher and optimize - so this is the list that turns "storage
					  is filling up" into something to do next.
					*/}
					<ul className="space-y-2">
						{heaviest.map((scene) => (
							<li
								key={scene.id}
								className="flex items-center justify-between gap-3"
							>
								<span className="min-w-0 flex-1">
									<Link
										to={DASHBOARD_ROUTES.SCENE_DETAIL(
											scene.projectId,
											scene.id
										)}
										className="block truncate text-sm font-medium hover:underline"
									>
										{scene.name}
									</Link>
									<span className="text-muted-foreground text-xs">
										{scene.projectName}
										{' · '}
										{scene.assetCount === 1
											? '1 file'
											: `${scene.assetCount} files`}
										{' · '}
										changed {formatChanged(scene.updatedAt)}
									</span>
								</span>
								<span className="shrink-0 text-xs font-medium tabular-nums">
									{Math.round(scene.storageBytes / MB).toLocaleString()} MB
								</span>
							</li>
						))}
					</ul>

					{/*
					  Said out loud, because the arithmetic invites the question. A
					  texture used by three scenes is counted against all three: the
					  figure answers "how heavy is this to load", not "how much would
					  deleting it free".
					*/}
					<p className="text-muted-foreground text-xs">
						A file used by more than one scene counts toward each of them, so
						these do not add up to the total above.
					</p>
				</DetailPanelSection>
			) : null}

			{/*
			  Where it is going. The tiles above say how much; only this says what
			  is using it, which is the difference between a number and something
			  a reader can act on.

			  Shares are of the storage limit, not of the total used, so a bar here
			  reads against the same denominator as the Scene storage tile. On an
			  unlimited plan there is no denominator to share, so the size stands
			  alone.
			*/}
			{byProject.length > 0 ? (
				<DetailPanelSection surface="raised" title="Where it is going">
					<ul className="space-y-3">
						{byProject.map((project) => {
							const mb = Math.round(project.storageBytes / MB)
							const share =
								usage.storageLimit && usage.storageLimit > 0
									? Math.min(
											Math.round(
												(project.storageBytes / usage.storageLimit) * 100
											),
											100
										)
									: null

							return (
								<li key={project.id} className="space-y-1.5">
									<div className="flex items-center justify-between gap-3">
										<Link
											to={DASHBOARD_ROUTES.PROJECT_DETAIL(project.id)}
											className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
										>
											{project.name}
										</Link>
										<span className="text-muted-foreground shrink-0 text-xs tabular-nums">
											{project.sceneCount === 1
												? '1 scene'
												: `${project.sceneCount} scenes`}
											{' · '}
											{mb.toLocaleString()} MB
										</span>
									</div>
									{share === null ? null : (
										<Progress value={share} className="h-1" />
									)}
									<p className="text-muted-foreground text-xs">
										{project.lastChangedAt
											? `Last changed ${formatChanged(project.lastChangedAt)}`
											: 'Nothing in it yet'}
									</p>
								</li>
							)
						})}
					</ul>
				</DetailPanelSection>
			) : null}

			{byType.length > 0 ? (
				<DetailPanelSection surface="raised" title="By file type">
					{/*
					  The cut that changes what you do about it. Textures are usually
					  most of the weight and the fix for a texture - resize, recompress
					  - is nothing like the fix for geometry, so a total that does not
					  separate them cannot tell anyone where to start.
					*/}
					<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{byType.map((entry) => (
							<li key={entry.type} className="ds-sunken rounded-xl p-3">
								<p className="text-muted-foreground text-eyebrow capitalize">
									{entry.type}
								</p>
								<p className="mt-1 font-medium tabular-nums">
									{Math.round(entry.storageBytes / MB).toLocaleString()} MB
								</p>
								<p className="text-muted-foreground text-xs">
									{entry.fileCount === 1
										? '1 file'
										: `${entry.fileCount.toLocaleString()} files`}
								</p>
							</li>
						))}
					</ul>
				</DetailPanelSection>
			) : null}

			{largest.length > 0 ? (
				<DetailPanelSection surface="raised" title="Largest files">
					{/*
					  "Unusually large" is measured against `storage_bytes_per_scene`,
					  not against a number invented here. One file taking a quarter of
					  what an entire scene is allowed is worth a second look, and that
					  limit already exists, already varies by plan, and is already
					  enforced - so the flag moves when the plan does.
					*/}
					<ul className="space-y-2">
						{largest.map((asset) => {
							const heavy =
								perSceneLimit !== null &&
								asset.storageBytes >= perSceneLimit * HEAVY_SHARE_OF_SCENE

							return (
								<li
									key={asset.id}
									className="flex items-center justify-between gap-3"
								>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm">{asset.name}</span>
										<Link
											to={DASHBOARD_ROUTES.PROJECT_DETAIL(asset.projectId)}
											className="text-muted-foreground text-xs hover:underline"
										>
											{asset.projectName}
										</Link>
										<span className="text-muted-foreground text-xs capitalize">
											{' · '}
											{asset.type}
										</span>
									</span>
									<span className="flex shrink-0 items-center gap-2">
										{heavy ? (
											<Badge variant="secondary" className="text-warning">
												Large
											</Badge>
										) : null}
										<span className="text-xs font-medium tabular-nums">
											{Math.round(asset.storageBytes / MB).toLocaleString()} MB
										</span>
									</span>
								</li>
							)
						})}
					</ul>

					{perSceneLimit !== null ? (
						<p className="text-muted-foreground text-xs">
							Flagged at{' '}
							{Math.round((perSceneLimit * HEAVY_SHARE_OF_SCENE) / MB)} MB, a
							quarter of the {Math.round(perSceneLimit / MB).toLocaleString()}{' '}
							MB a single scene may hold on {PLAN_DISPLAY_NAMES[plan]}.
						</p>
					) : null}
				</DetailPanelSection>
			) : null}

			{/*
			  A door, not a pitch. The panel this replaces raised an upgrade modal
			  from here, which on `/dashboard/billing` did nothing at all - the
			  modal closes itself on that path - and would have started working by
			  accident the moment the panel moved. The modal exists to interrupt
			  someone who hit a limit somewhere else; a reader already looking at
			  their limits needs a link, and only if there is a plan above theirs.
			*/}
			{plan !== 'enterprise' ? (
				<div className="px-1">
					<Button variant="ghost" size="sm" asChild>
						<Link to={DASHBOARD_ROUTES.BILLING_UPGRADE}>Compare plans</Link>
					</Button>
				</div>
			) : null}
		</div>
	)
}

export default UsagePage
