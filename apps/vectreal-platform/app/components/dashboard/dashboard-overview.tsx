import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { ArrowRight, Layers, Pencil, Play, Plus } from 'lucide-react'
import { Link } from 'react-router'

import { RelativeTime } from './relative-time'
import { SceneStatusTag } from './scene-status'
import { SceneThumbnail } from './scene-thumbnail'
import { DitherGrain } from '../layout-components/dither-grain'

import type { SceneSummary } from './scene-card'
import type { Tidbit } from '../../lib/domain/dashboard/dashboard-tidbits'

interface DashboardOverviewProps {
	resumeScene: SceneSummary | null
	tidbit: Tidbit
}

/**
 * Where each group comes in, in reading order, as the publisher's empty stage
 * does: the scene first, the fact beside it a beat later.
 */
const ARRIVAL_STEP_MS = 120
const arrivalDelay = (step: number) => ({
	animationDelay: `${step * ARRIVAL_STEP_MS}ms`
})

/**
 * The scene to pick up again.
 *
 * Three ways in, because "pick up" means three different things: keep editing
 * it, look at it as a visitor will, or see what it is made of. The third is the
 * scene's own page, with its assets, stats and publish state, and it was only
 * reachable from here by leaving for the project list.
 */
function ResumeCard({ scene }: { scene: SceneSummary }) {
	return (
		<div className="ds-raised overflow-hidden rounded-2xl">
			{/*
			  The picture bleeds to the card's edge and only the text carries the
			  padding, as on every `EntityCard` below it. Inset with its own radius,
			  it read as a second card framed inside the first.
			*/}
			<div className="grid sm:grid-cols-[minmax(0,16rem)_1fr]">
				{/*
				  A pointer shortcut to the Details button below, so it stays out of
				  the tab order and the accessibility tree.
				*/}
				<Link
					to={`/dashboard/projects/${scene.projectId}/${scene.id}`}
					viewTransition
					className="block"
					tabIndex={-1}
					aria-hidden
				>
					<SceneThumbnail
						src={scene.thumbnailUrl}
						className="rounded-none sm:h-full"
					/>
				</Link>

				<div className="min-w-0 space-y-3 self-center p-5">
					<div className="min-w-0 space-y-1">
						<p className="text-muted-foreground text-eyebrow">Jump back in</p>
						<h2 className="text-h3 truncate">{scene.name}</h2>
						{/*
						  Status in the caption, as on every scene card below. Laid on
						  the thumbnail it crowded the card's rounded corner, and in the
						  button row it read as a control that did nothing.
						*/}
						<div className="flex min-w-0 items-center gap-3 text-sm">
							<SceneStatusTag status={scene.status} className="shrink-0" />
							<p className="text-muted-foreground truncate">
								{scene.projectName ? `${scene.projectName} · ` : ''}
								edited <RelativeTime at={scene.updatedAt} />
							</p>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<Button size="sm" asChild>
							<Link to={`/publisher/${scene.id}`} viewTransition>
								<Pencil className="size-3.5" />
								Open in publisher
							</Link>
						</Button>
						<Button size="sm" variant="secondary" asChild>
							<Link to={`/preview/${scene.projectId}/${scene.id}`}>
								<Play className="size-3.5" />
								Preview
							</Link>
						</Button>
						<Button size="sm" variant="ghost" asChild>
							<Link
								to={`/dashboard/projects/${scene.projectId}/${scene.id}`}
								viewTransition
							>
								<Layers className="size-3.5" />
								Details
							</Link>
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}

/**
 * The first scene, for someone who has none.
 *
 * Printed on the page rather than boxed in a card: with nothing to resume, the
 * invitation is the whole opening view, and a centered card in an empty page
 * read as a placeholder for something that had not loaded.
 */
function FirstScene() {
	return (
		<div className="max-w-lg space-y-4">
			<h2 className="text-h2">Publish your first 3D scene</h2>
			<p className="text-muted-foreground text-body">
				Upload a model and the publisher optimizes it, then hands you a preview
				link and an embed snippet for your site.
			</p>
			<Button className="mt-2" asChild>
				<Link to="/publisher" viewTransition>
					Upload a model
					<ArrowRight className="size-4" />
				</Link>
			</Button>
		</div>
	)
}

/**
 * One fact drawn from this person's own work, a different one each visit.
 *
 * Set on the page's dither, the same printed grain the marketing pages, the
 * converters and the publisher's empty stage stand on, so the dashboard reads
 * as the same place. A figure rather than a character or a greeting: the point
 * is that the numbers are theirs, and true.
 */
function TidbitFigure({ tidbit }: { tidbit: Tidbit }) {
	return (
		<figure className="min-w-0">
			<p className="text-muted-foreground text-eyebrow">
				{tidbit.id === 'formats' ? 'Good to know' : 'Across your workspace'}
			</p>
			<p className="text-stat mt-2 break-words">{tidbit.figure}</p>
			<figcaption className="text-muted-foreground text-body-sm mt-2 max-w-xs leading-relaxed">
				{tidbit.caption}
			</figcaption>
		</figure>
	)
}

/**
 * The dashboard's opening view: what to pick up, and one thing worth knowing.
 *
 * Replaces a single card that was the whole page for anyone with fewer than two
 * scenes. It answered "what was I doing" and nothing else, and offered no way to
 * a scene's assets or toward a second scene.
 */
export function DashboardOverview({
	resumeScene,
	tidbit
}: DashboardOverviewProps) {
	return (
		<section className="relative isolate">
			{/*
			  Out to the edges of the dashboard's scroller rather than the page
			  measure, as ground under the page instead of a patch inside it. The
			  measure is centered in that scroller, so the band's center is its
			  center too.
			*/}
			<DitherGrain
				origin="right"
				className="right-auto left-1/2 w-[100cqw] -translate-x-1/2"
			/>

			<div className="grid gap-10 py-12 lg:min-h-112 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:items-center lg:gap-16">
				<div className="animate-arrive" style={arrivalDelay(0)}>
					{resumeScene ? <ResumeCard scene={resumeScene} /> : <FirstScene />}
				</div>
				<div className="animate-arrive" style={arrivalDelay(1)}>
					<TidbitFigure tidbit={tidbit} />
				</div>
			</div>
		</section>
	)
}

/**
 * The standing invitation to add another scene, first in the recent grid.
 *
 * Sized by the grid row, so it matches the cards beside it without restating
 * their thumbnail height. With one scene left, this and that scene are the page,
 * and the next step is always one click away rather than in the header chrome.
 */
export function NewSceneTile({ className }: { className?: string }) {
	return (
		<Link
			to="/publisher"
			viewTransition
			className={cn(
				'ds-raised-interactive flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl p-5 text-center',
				className
			)}
		>
			<span className="ds-raised flex size-10 items-center justify-center rounded-full">
				<Plus className="size-4" aria-hidden />
			</span>
			<span className="space-y-1">
				<span className="block font-medium">New scene</span>
				<span className="text-muted-foreground block text-xs">
					Upload a model to the publisher
				</span>
			</span>
		</Link>
	)
}

export default DashboardOverview
