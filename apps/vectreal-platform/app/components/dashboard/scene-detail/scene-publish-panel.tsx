import { Button } from '@shared/components/ui/button'
import { cn, formatFileSize } from '@shared/utils'
import { ExternalLink, Rocket } from 'lucide-react'
import { Link } from 'react-router'

import { SceneShareDrawer } from './scene-share-drawer'
import { DetailPanelSection } from '../../layout-components'

import type { ScenePublishStateResponse } from '../../../types/api'

interface ScenePublishPanelProps {
	sceneId: string
	projectId: string
	publishState: ScenePublishStateResponse
	publisherPath: string
	/**
	 * Forwarded to the drawer's publish control, which takes a callback.
	 *
	 * This panel's own affordances are real `Link`s to the same destination -
	 * they are navigations, and a navigation should be middle-clickable - so the
	 * two spellings of one route sit side by side here deliberately.
	 */
	onPublish: () => void
	className?: string
}

/**
 * Whether this scene is on the web, and the way forward from wherever it is.
 *
 * Publishing was three understated fragments: a `Published` chip in the header's
 * meta row, a quiet door in the aside, and an `Open in Publisher` call to action
 * that went to the same place the door's own publish button did. Each was small
 * because none of them was the whole thing, and this page exists to get a scene
 * onto someone else's site - so the answer is not to shout, it is to put the
 * state, the facts and the way forward in one surface and give it the top of the
 * column.
 *
 * Two designs, not one with blanks in it, because the question differs by state.
 * A draft has no date and no size to report; what it has is a reason to act. A
 * published scene has three facts and a snippet to fetch.
 *
 * Colour lands on the status dot alone. The surface is `ds-raised` like its
 * neighbours, so prominence comes from position and size rather than from a
 * tinted block that would read as an alert on a page where nothing is wrong.
 */
export function ScenePublishPanel({
	sceneId,
	projectId,
	publishState,
	publisherPath,
	onPublish,
	className
}: ScenePublishPanelProps) {
	const isPublished = publishState.status === 'published'

	const publishedAt = publishState.publishedAt
		? new Date(publishState.publishedAt)
		: null
	const publishedOn =
		publishedAt && !Number.isNaN(publishedAt.getTime())
			? publishedAt.toLocaleDateString()
			: null
	const publishedSize =
		typeof publishState.publishedAssetSizeBytes === 'number'
			? formatFileSize(publishState.publishedAssetSizeBytes)
			: null

	return (
		<DetailPanelSection
			title="Publishing"
			/*
			  `h2`, the rung Scene Metrics sits on beside it: the scene route renders
			  no `h1`, because `dashboard-layout.tsx` suppresses `DashboardHeader` on
			  it, so these sections are the top of the document's outline.

			  A real title rather than the bare eyebrow this had. `DetailPanelSection`
			  puts its `action` on the title row, so the eyebrow left the Publisher
			  link stranded on a centred row of its own below the door - and this was
			  the only section in the column without a heading.
			*/
			headingLevel="h2"
			action={
				isPublished ? (
					/*
					  The house idiom for a link on a section's heading row - a ghost
					  button at `text-xs` and muted, the shape `EmbedOptionsPanel` uses
					  for `Project settings`. Only when live: a draft's whole surface is
					  the invitation to publish, and the button below says so louder
					  than this could.
					*/
					<Button
						variant="ghost"
						size="sm"
						asChild
						className="text-muted-foreground hover:text-foreground text-xs"
					>
						<Link viewTransition to={publisherPath}>
							Open in Publisher
							<ExternalLink />
						</Link>
					</Button>
				) : null
			}
			className={className}
			contentClassName="space-y-3"
		>
			<p className="flex items-center gap-2 pt-1">
				{/*
				  The one piece of colour. Brand orange for a draft, because a draft is
				  the state with something to do about it; `--success` once it is live,
				  which is the token the rest of the app already uses to mean "this
				  worked".
				*/}
				<span
					aria-hidden
					className={cn(
						'size-2 shrink-0 rounded-full',
						isPublished ? 'bg-success' : 'bg-orange'
					)}
				/>
				<span className="text-h4 text-foreground">
					{isPublished ? 'Live' : 'Not live'}
				</span>
			</p>

			{isPublished ? (
				<>
					{/*
					  The two facts a published scene is asked about: when it went out,
					  and what it costs a visitor to load.
					*/}
					<p className="text-muted-foreground text-xs">
						{[publishedOn && `Published ${publishedOn}`, publishedSize]
							.filter(Boolean)
							.join(' · ') || 'Published'}
					</p>

					<SceneShareDrawer
						sceneId={sceneId}
						projectId={projectId}
						publishState={publishState}
						onPublish={onPublish}
					/>
				</>
			) : (
				<>
					<p className="text-muted-foreground text-xs">
						This scene is not on the web yet. Publishing happens in the
						Publisher, so the model that ships is the optimized one.
					</p>

					{/*
					  The primary action of the whole page while a scene is a draft, and
					  the only route to it now that the header carries Preview alone.
					*/}
					<Button asChild className="w-full">
						<Link viewTransition to={publisherPath}>
							<Rocket className="mr-2 h-4 w-4 shrink-0" />
							Open in Publisher
						</Link>
					</Button>
				</>
			)}
		</DetailPanelSection>
	)
}
