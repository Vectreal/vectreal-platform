import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger
} from '@shared/components/ui/drawer'
import { cn } from '@shared/utils'
import { useEffect, useState } from 'react'

import { SceneTriggerCard } from './scene-trigger-card'

import type { ReactNode } from 'react'

/**
 * `xl`, the same boundary the page's own layout switches on.
 *
 * Not `useIsMobile` from `@shared/components`, which is pinned to 768: between
 * 768 and 1280 this page has no aside, so a drawer keyed to that hook would
 * slide in from the right on a tablet whose layout is the stacked one. The
 * direction has to change where the layout changes, or the two disagree in a
 * 512px band.
 */
const ASIDE_BREAKPOINT = '(min-width: 80rem)'

/**
 * Which edge a scene detail surface opens from.
 *
 * `bottom` on the first render, client and server alike, so there is no
 * hydration mismatch to reconcile - and nothing to reconcile in practice
 * either, since a closed drawer renders no content and the direction cannot
 * matter until someone opens one, which is always after mount.
 */
function useSurfaceDirection(): 'bottom' | 'right' {
	const [hasAside, setHasAside] = useState(false)

	useEffect(() => {
		const query = window.matchMedia(ASIDE_BREAKPOINT)
		const sync = () => setHasAside(query.matches)

		sync()
		query.addEventListener('change', sync)
		return () => query.removeEventListener('change', sync)
	}, [])

	return hasAside ? 'right' : 'bottom'
}

interface SceneSurfaceDrawerProps {
	/** The door's label, and the drawer's title. */
	label: string
	/** One line on the door saying what it currently holds. */
	summary: ReactNode
	description: string
	triggerClassName?: string
	children: ReactNode
}

/**
 * One door, one drawer, one set of rules - for both scene detail surfaces.
 *
 * Publish & Embed and Scene details were built separately and immediately
 * drifted: one opened from the right at every width, the other from the bottom,
 * and each carried its own copy of the padding and of the trap below. Two
 * surfaces of the same kind, opening differently on the same phone, is the
 * inconsistency a user feels first.
 *
 * The direction follows the layout rather than the surface: from the bottom
 * wherever the page is a single stacked column, from the right once there is an
 * aside beside it. That is one behaviour expressed once, so the two cannot
 * disagree again.
 *
 * The width token is applied to the right direction only, and this is the whole
 * reason it lives here. A bottom `DrawerContent` is stretched across both
 * horizontal insets; capping its width without also centring it pins the sheet
 * to the left edge of the phone instead of filling it. That trap is now
 * impossible to hit twice.
 */
export function SceneSurfaceDrawer({
	label,
	summary,
	description,
	triggerClassName,
	children
}: SceneSurfaceDrawerProps) {
	const direction = useSurfaceDirection()

	return (
		<Drawer direction={direction}>
			<DrawerTrigger asChild>
				<SceneTriggerCard
					label={label}
					summary={summary}
					className={triggerClassName}
				/>
			</DrawerTrigger>

			<DrawerContent
				className={cn(
					'border-0',
					direction === 'right' && 'max-w-detail-panel!'
				)}
			>
				<DrawerHeader>
					<DrawerTitle>{label}</DrawerTitle>
					<DrawerDescription>{description}</DrawerDescription>
				</DrawerHeader>

				{/*
				  Padded on three sides only. `DrawerHeader` already carries 24px all
				  round, so padding the top here stacked two gaps under the
				  description. The left edge still matches the heading, which is the
				  alignment `drawer.tsx` records having fixed once.
				*/}
				<div className="space-y-6 overflow-y-auto px-6 pb-6">{children}</div>
			</DrawerContent>
		</Drawer>
	)
}
