import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { VectrealLogoSmall } from '@shared/components/assets/icons/vectreal-logo-small'
import { Separator } from '@shared/components/ui/separator'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger
} from '@shared/components/ui/tooltip'
import { cn } from '@shared/utils'
import { Link, useLocation } from 'react-router'

import { PUBLISHER_LAYER } from './shell-layout'
import { UserMenu } from '../../user-menu'
import { CopyExampleSettingsButton } from '../copy-example-settings-button'
import SaveButton from '../save-button'
import { SceneNameAndLocation } from '../scene-name-and-location'

import type { SaveAvailabilityState } from '../../../lib/domain/scene/client/scene-save-state'
import type {
	SaveLocationTarget,
	SaveSceneFn
} from '../../../types/publisher-scene'
import type { User } from '@supabase/supabase-js'
import type { FC } from 'react'

interface PublisherHeaderProps {
	user: null | User
	sceneId: null | string
	sceneDetailsHref?: string
	saveLocationTarget: SaveLocationTarget
	saveAvailability: SaveAvailabilityState
	saveSceneSettings: SaveSceneFn
	onRequireAuth: () => Promise<void> | void
	onLogout: () => void
	publishedAt?: null | string
	isPreviewMode: boolean
	/** Dims and blocks the row while the scene is mid-load or mid-optimization. */
	actionsDisabled: boolean
	/**
	 * Whether there is a scene for the name, location and save controls to act
	 * on. An empty stage has none, so the header carries only the way home and
	 * the account.
	 */
	showSceneControls: boolean
}

/**
 * Row 1 of the publisher shell.
 *
 * Identity on the left, state and account on the right. A real grid row rather
 * than floating pills, so the canvas below starts at a predictable offset and
 * the sidebars have a hard edge to stop at.
 */
export const PublisherHeader: FC<PublisherHeaderProps> = ({
	user,
	sceneId,
	sceneDetailsHref,
	saveLocationTarget,
	saveAvailability,
	saveSceneSettings,
	onRequireAuth,
	onLogout,
	publishedAt,
	isPreviewMode,
	actionsDisabled,
	showSceneControls
}) => {
	const isPublished = Boolean(publishedAt)
	// Back to this page, a scene route included: signed out there, the scene is not loaded and the stage is empty.
	const { pathname } = useLocation()
	const homeHref = user ? '/dashboard' : '/'
	const homeLabel = user ? 'Dashboard' : 'Vectreal home'
	// Says more than the label, since a screen reader reads both when the tooltip opens on focus.
	const homeHint = user
		? 'Back to your dashboard'
		: 'Back to the Vectreal home page'

	// The header is positioned with a z-index, which makes it a stacking context:
	// everything inside is capped at the header's own level. Sitting below the
	// tool bar meant the location dropdown painted behind the bar no matter how
	// high its own z-index went.
	return (
		<header
			className={cn(
				'border-shell-border-soft bg-shell-surface/85 relative flex h-14 shrink-0 items-center gap-3 border-b px-3 backdrop-blur-xl md:px-4',
				PUBLISHER_LAYER.header
			)}
		>
			{/*
			  The way out. The publisher carries no site nav, and a signed-out
			  visitor has no account menu either, so without this the only exit was
			  the browser's back button. Signed in, it leads to the dashboard, where
			  the dashboard's own logo leads too: someone with an account expects to
			  land on their work, not on the landing page. Signed out it leads home.
			  The tooltip says which, since the same mark goes to two places.

			  The full wordmark while the stage is empty and the header has room;
			  the mark alone once a scene's controls take the row.
			*/}
			<Tooltip>
				<TooltipTrigger asChild>
					<Link
						to={homeHref}
						viewTransition
						aria-label={homeLabel}
						className="flex h-9 shrink-0 items-center rounded-xl px-2"
					>
						{/*
						  One mark under the whole wordmark, so the exchange is a hand-over
						  rather than a swap: the letters fade off the mark while the link
						  narrows to it, and the scene's name comes in after them.
						*/}
						<span
							className={cn(
								'relative block h-5 overflow-hidden transition-[width] duration-(--duration-slow) ease-(--ease-out) motion-reduce:transition-none',
								showSceneControls ? 'w-5' : 'w-[calc(var(--spacing)*5*400/120)]'
							)}
						>
							<VectrealLogoSmall className="text-orange absolute top-0 left-0 size-5" />
							<span
								className={cn(
									'absolute top-0 left-0 h-5 transition-opacity duration-(--duration-base) ease-(--ease-out) motion-reduce:transition-none',
									showSceneControls && 'opacity-0'
								)}
							>
								<VectrealLogoAnimated
									animated={false}
									colored
									className="h-5 w-auto"
								/>
							</span>
						</span>
					</Link>
				</TooltipTrigger>
				<TooltipContent side="bottom">{homeHint}</TooltipContent>
			</Tooltip>

			<div
				className={cn(
					'min-w-0 flex-1',
					actionsDisabled && 'pointer-events-none opacity-45 saturate-50'
				)}
			>
				{/* Pushed in from the left as the wordmark leaves, a beat after it, so the name takes the room the letters gave up. */}
				{showSceneControls && (
					<div className="animate-in fade-in-0 slide-in-from-left-3 fill-mode-both delay-150 duration-(--duration-slow) ease-(--ease-out) motion-reduce:animate-none">
						<SceneNameAndLocation
							authenticated={!!user}
							className="max-w-[min(30rem,100%)]"
						/>
					</div>
				)}
			</div>

			<div className="flex shrink-0 items-center gap-2">
				{showSceneControls && isPublished && (
					<>
						<span className="hidden items-center gap-3 px-3 sm:flex">
							<span
								className="bg-orange h-1.5 w-1.5 rounded-full"
								aria-hidden="true"
							/>
							<p className="text-muted-foreground text-xs font-medium tracking-wide">
								Published
							</p>
						</span>
						<Separator
							orientation="vertical"
							className="bg-shell-border-strong hidden h-4 sm:block"
						/>
					</>
				)}

				{import.meta.env.DEV && showSceneControls && (
					<CopyExampleSettingsButton />
				)}

				{showSceneControls && (
					<SaveButton
						sceneId={sceneId}
						userId={user?.id}
						saveLocationTarget={saveLocationTarget}
						saveAvailability={saveAvailability}
						forceDisabled={isPreviewMode}
						onRequireAuth={onRequireAuth}
						saveSceneSettings={saveSceneSettings}
					/>
				)}

				{user ? (
					<UserMenu
						size="sm"
						user={user}
						onLogout={onLogout}
						sceneDetailsHref={sceneDetailsHref}
					/>
				) : (
					/*
					  Signed out with nothing on the stage, this is the way in: the
					  site nav that used to carry it is gone from the publisher. Once
					  a model is in, "Sign In to Save" takes over, and it keeps the
					  scene as a draft through the round trip.
					*/
					!showSceneControls && (
						<Link
							to={`/sign-in?next=${encodeURIComponent(pathname)}`}
							className="text-muted-foreground hover:text-foreground px-3 text-sm font-medium"
						>
							Sign in
						</Link>
					)
				)}
			</div>
		</header>
	)
}
