import { Badge } from '@shared/components/ui/badge'
import { Button } from '@shared/components/ui/button'
import { ArrowRight, Pencil, Play } from 'lucide-react'
import { Link } from 'react-router'

import { SceneThumbnail } from './scene-thumbnail'

export interface ResumeScene {
	id: string
	projectId: string
	name: string
	status: string
	thumbnailUrl: null | string
	updatedAt: Date | string
	projectName: string
}

interface DashboardOverviewProps {
	resumeScene: ResumeScene | null
}

function formatEdited(updatedAt: Date | string) {
	const date = updatedAt instanceof Date ? updatedAt : new Date(updatedAt)
	const minutes = Math.floor((Date.now() - date.getTime()) / 60_000)

	if (minutes < 1) return 'edited just now'
	if (minutes < 60) return `edited ${minutes} min ago`
	if (minutes < 1440) return `edited ${Math.floor(minutes / 60)}h ago`
	if (minutes < 43_200) return `edited ${Math.floor(minutes / 1440)}d ago`

	return `edited ${date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	})}`
}

/**
 * The scene to pick up again.
 *
 * The loader always knew which one this was - it computed `mostRecentSceneId`,
 * serialized it to the client, and nothing ever read it. The first question
 * this page is asked is "what was I doing?", and answering it takes one card
 * rather than four counts.
 */
function ResumeBand({ scene }: { scene: ResumeScene }) {
	return (
		<section className="ds-raised overflow-hidden rounded-2xl">
			<div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-center">
				{/*
				  The status sits on the thumbnail, labelling the scene itself.

				  It began the button row, where it read as a third control that
				  happened not to be clickable; next to the "Jump back in" eyebrow it
				  was worse, conflating the section's label with the scene's state.
				  Over the image it is unambiguously a property of the thing shown.
				*/}
				<div className="relative">
					<SceneThumbnail src={scene.thumbnailUrl} />
					<Badge
						variant={scene.status === 'published' ? 'default' : 'secondary'}
						className="absolute top-2 left-2 capitalize shadow-sm"
					>
						{scene.status}
					</Badge>
				</div>

				<div className="min-w-0 space-y-3">
					<div className="min-w-0 space-y-1">
						<p className="text-muted-foreground text-eyebrow">Jump back in</p>
						<h2 className="text-h3 truncate">{scene.name}</h2>
						<p className="text-muted-foreground truncate text-sm">
							{scene.projectName ? `${scene.projectName} · ` : ''}
							{formatEdited(scene.updatedAt)}
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<Button size="sm" asChild>
							<Link to={`/publisher/${scene.id}`}>
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
					</div>
				</div>
			</div>
		</section>
	)
}

/**
 * The first scene, for someone who has none.
 *
 * What this replaces had an icon, two sentences and no way out - the only route
 * forward was a button in the layout header, which reads as chrome rather than
 * as the next step.
 */
function FirstSceneBand() {
	return (
		<section className="ds-raised rounded-2xl p-8 text-center sm:p-12">
			<h2 className="text-h3">Publish your first 3D scene</h2>
			<p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-relaxed">
				Upload a model and the publisher will optimize it, give you a preview
				link, and an embed snippet for your site.
			</p>
			<Button className="mt-6" asChild>
				<Link to="/publisher">
					Upload a model
					<ArrowRight className="size-4" />
				</Link>
			</Button>
		</section>
	)
}

/**
 * The dashboard's opening view.
 *
 * Replaces four raw counts beside a decorative panel. The counts had no
 * denominators, so they reported activity without ever saying whether any of it
 * was near a limit, and the panel was a blurred gradient plus a docs link
 * occupying a third of the page's prime area.
 */
export function DashboardOverview({ resumeScene }: DashboardOverviewProps) {
	return resumeScene ? <ResumeBand scene={resumeScene} /> : <FirstSceneBand />
}

export default DashboardOverview
