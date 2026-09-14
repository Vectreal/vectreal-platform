import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { Progress } from '@shared/components/ui/progress'
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger
} from '@shared/components/ui/tabs'
import { data, Link, useLoaderData } from 'react-router'

import { Route } from './+types/usage'
import {
	RelativeTime,
	UsageMeter,
	UsageMeterList
} from '../../components/dashboard'
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

import type { LimitKey } from '../../constants/plan-config'

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

/**
 * The five readings, as plain data.
 *
 * Shared by the loader, which turns them into the verdict, and the page, which
 * renders them - so the numbers the headline is about and the numbers on screen
 * cannot come from two different lists. `hint` and `format` are re-attached at
 * render because a function does not survive the loader.
 */
function buildReadings(usage: Awaited<ReturnType<typeof loadOrgUsage>>) {
	return [
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
			   one function, so bytes on one and MB on the other is how a bar reads
			   full at a fraction of its limit.

			   The unit rides on the value rather than in the label. "Scene storage
			   (MB)" put it in the one place a reader does not look for it, and made
			   this the only reading whose heading was not just its name. */
			key: 'storage_bytes_total' as const,
			label: STORAGE_USAGE_LABEL,
			current: Math.round(usage.storageBytesTotal / MB),
			limit:
				usage.storageLimit !== null ? Math.round(usage.storageLimit / MB) : null
		}
	]
}

/** Re-attached at render: neither survives serialization. */
const READING_DISPLAY: Partial<
	Record<LimitKey, { hint?: string; format?: (value: number) => string }>
> = {
	storage_bytes_total: {
		hint: STORAGE_USAGE_HINT,
		format: (value: number) => `${value.toLocaleString()} MB`
	}
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

	/*
	  The verdict is computed here, not in the body, because it is a fact about
	  the page rather than a detail of its layout. The header renders it as this
	  route's description - the way `organization-detail` renders its member and
	  project counts - and a value computed inside the card would be reachable
	  only from inside the card.
	*/
	const readings = buildReadings(usage)
	const verdict = describeUsageVerdict(readings, PLAN_DISPLAY_NAMES[plan])

	return data(
		{
			usage,
			readings,
			verdict,
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
 * The readings are rows in a narrow grid rather than tiles, for the reason the
 * billing panel gave before it moved: five tiles across three columns leave the
 * last one alone beside two empty cells. A row list ending short is just a list
 * ending.
 */
const UsagePage = () => {
	const {
		usage,
		readings: rawReadings,
		verdict,
		byProject,
		byType,
		largest,
		heaviest,
		plan,
		perSceneLimit
	} = useLoaderData<typeof loader>()

	const readings = rawReadings.map((reading) => ({
		...reading,
		...READING_DISPLAY[reading.key]
	}))
	/*
		Only the groupings that have something to say.

		A tab that opens onto an empty list is worse than a missing tab: it reads
		as a broken page rather than as an account with nothing in it. Projects
		additionally needs a second project - with one, every byte is in it by
		definition, so the row restates the total and the rail is always full.
	*/
	const breakdowns = [
		{ value: 'scenes', label: 'Scenes', show: heaviest.length > 0 },
		{ value: 'projects', label: 'Projects', show: byProject.length > 1 },
		{ value: 'types', label: 'File types', show: byType.length > 0 },
		{ value: 'files', label: 'Files', show: largest.length > 0 }
	].filter((tab) => tab.show)

	const planLabel = PLAN_DISPLAY_NAMES[plan]
	const binding = readings.find((r) => r.key === verdict.bindingKey)
	const rest = readings.filter((r) => r.key !== verdict.bindingKey)

	return (
		<div className="space-y-8 py-6">
			{/*
			  The verdict, then its evidence, then everything else.

			  Five equally-weighted tiles made the reader compare them to find the
			  one that mattered, which is work the page can do. When something is
			  binding it is shown large beside the answer and the remedy; when
			  nothing is, there is no hero and the readings are a quiet list.
			*/}
			<section className="ds-raised space-y-4 rounded-2xl p-5">
				{/*
				  No plan badge. The sidebar footer carries the tier on every
				  dashboard page, so a badge here is the same fact a second time on
				  one screen - and it wrapped below the remedy at 375px, where it read
				  as a third paragraph rather than as a label.
				*/}
				{/*
				  The headline is the page's description now, rendered by the shared
				  header beside the h1 - it describes the state of this page, which is
				  what that slot is for, and `organization-detail` already sets its
				  own from loader data. Repeating it here as an `h2` said the same
				  sentence twice, two heading levels apart.

				  The remedy stays, because it points at the evidence below it.
				*/}
				<div className="min-w-0 space-y-1">
					<p className="text-muted-foreground text-label-xs">
						{planLabel} plan
					</p>
					{verdict.remedy ? (
						<p className="text-foreground text-sm font-medium">
							{verdict.remedy}
						</p>
					) : null}
				</div>

				{/* The reading the headline is about, ahead of the rest. */}
				{binding ? (
					<UsageMeter
						variant="row"
						label={binding.label}
						hint={binding.hint}
						format={binding.format}
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
					<UsageMeterList>
						{rest.map((reading) => (
							<UsageMeter
								key={reading.key}
								variant="row"
								label={reading.label}
								hint={reading.hint}
								format={reading.format}
								current={reading.current}
								limit={reading.limit}
							/>
						))}
					</UsageMeterList>
				)}
			</section>

			{/*
			  One question, asked four ways - so it is one section, not four.

			  Heaviest scenes, per project, by file type and largest files are four
			  groupings of a single number, and they were four stacked panels of
			  equal weight. A reader wanting "which scene do I optimise" had to
			  scroll past three lists answering something else, and on a phone that
			  is five screens to reach a total the first line already gave.

			  Scenes leads because a scene is the unit you can act on: it is what
			  opens in the publisher and what optimisation runs against. A project
			  total says where to look and a file says what is fat, but neither is a
			  thing you can open and fix.
			*/}
			{breakdowns.length > 0 ? (
				<DetailPanelSection
					surface="raised"
					title="Where storage is going"
					contentClassName="space-y-0"
				>
					<Tabs defaultValue={breakdowns[0].value}>
						{/*
						  `w-full`, not `overflow-x-auto`. Measured at 375px the four
						  triggers are 265px in 309px of room, so nothing scrolled - and
						  `TabsList`'s own `justify-center` would have clipped the first
						  trigger 36px left of the scroll origin, permanently
						  unreachable, if it ever had. Full width is what
						  `embed-snippet-card.tsx` uses for the same problem and it
						  neutralises the centring.

						  `ds-sunken` because a `TabsList` inside a `ds-raised` panel has
						  no ground of its own: its default `bg-muted/50` over this
						  surface measures 1.00 contrast, so only the active pill showed.
						*/}
						<TabsList className="ds-sunken mb-4 w-full">
							{breakdowns.map((tab) => (
								<TabsTrigger key={tab.value} value={tab.value}>
									{tab.label}
								</TabsTrigger>
							))}
						</TabsList>

						<TabsContent value="scenes" className="space-y-3">
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
												{' \u00b7 '}
												{scene.assetCount === 1
													? '1 file'
													: `${scene.assetCount} files`}
												{' \u00b7 '}
												changed <RelativeTime at={scene.updatedAt} />
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
							  figure answers "how heavy is this to load", not "how much
							  would deleting it free".
							*/}
							<p className="text-muted-foreground text-xs">
								A file used by more than one scene counts toward each of them,
								so these do not add up to the total above.
							</p>
						</TabsContent>

						{/*
						  Only with a second project to compare against. One project holds
						  everything by definition, so the row restates the total above it
						  and the rail is always full.
						*/}
						{byProject.length > 1 ? (
							<TabsContent value="projects">
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
														{' \u00b7 '}
														{mb.toLocaleString()} MB
													</span>
												</div>
												{share === null ? null : (
													<Progress value={share} className="h-1" />
												)}
												<p className="text-muted-foreground text-xs">
													{project.lastChangedAt ? (
														<>
															Last changed{' '}
															<RelativeTime at={project.lastChangedAt} />
														</>
													) : (
														'Nothing in it yet'
													)}
												</p>
											</li>
										)
									})}
								</ul>
							</TabsContent>
						) : null}

						{byType.length > 0 ? (
							<TabsContent value="types">
								{/*
								  The cut that changes what you do about it. Textures are
								  usually most of the weight and the fix for a texture -
								  resize, recompress - is nothing like the fix for geometry,
								  so a total that does not separate them cannot tell anyone
								  where to start.

								  Rows, not tiles. Three tiles stacked full-width on a phone
								  spent roughly a hundred pixels each on one number.
								*/}
								<ul className="space-y-2">
									{byType.map((entry) => (
										<li
											key={entry.type}
											className="flex items-baseline justify-between gap-3"
										>
											<span className="text-sm capitalize">{entry.type}</span>
											<span className="flex shrink-0 items-baseline gap-2 tabular-nums">
												<span className="text-sm font-medium">
													{Math.round(entry.storageBytes / MB).toLocaleString()}{' '}
													MB
												</span>
												<span className="text-muted-foreground text-xs">
													{entry.fileCount === 1
														? '1 file'
														: `${entry.fileCount.toLocaleString()} files`}
												</span>
											</span>
										</li>
									))}
								</ul>
							</TabsContent>
						) : null}

						{largest.length > 0 ? (
							<TabsContent value="files" className="space-y-3">
								{/*
								  "Unusually large" is measured against
								  `storage_bytes_per_scene`, not against a number invented
								  here. One file taking a quarter of what an entire scene is
								  allowed is worth a second look, and that limit already
								  exists, already varies by plan, and is already enforced - so
								  the flag moves when the plan does.
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
													<span className="block truncate text-sm">
														{asset.name}
													</span>
													<Link
														to={DASHBOARD_ROUTES.PROJECT_DETAIL(
															asset.projectId
														)}
														className="text-muted-foreground text-xs hover:underline"
													>
														{asset.projectName}
													</Link>
													<span className="text-muted-foreground text-xs capitalize">
														{' \u00b7 '}
														{asset.type}
													</span>
												</span>
												<span className="flex shrink-0 items-center gap-2">
													{heavy ? (
														/*
														  `--warning-muted-foreground`, not `--warning`. The
														  bright token on a `secondary` pill computes to
														  1.96:1 in light, against 4.5:1 for 12px text;
														  `contrast-tokens.spec.ts` pins no `--warning` pair,
														  which is how it survived. The muted one is 7.12:1,
														  and `inline-notice.tsx` records this same confusion
														  being resolved once before.
														*/
														<Badge
															variant="secondary"
															className="text-warning-muted-foreground"
														>
															Large
														</Badge>
													) : null}
													<span className="text-xs font-medium tabular-nums">
														{Math.round(
															asset.storageBytes / MB
														).toLocaleString()}{' '}
														MB
													</span>
												</span>
											</li>
										)
									})}
								</ul>

								{perSceneLimit !== null ? (
									<p className="text-muted-foreground text-xs">
										Flagged at{' '}
										{Math.round((perSceneLimit * HEAVY_SHARE_OF_SCENE) / MB)}{' '}
										MB, a quarter of the{' '}
										{Math.round(perSceneLimit / MB).toLocaleString()} MB a
										single scene may hold on {PLAN_DISPLAY_NAMES[plan]}.
									</p>
								) : null}
							</TabsContent>
						) : null}
					</Tabs>
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
