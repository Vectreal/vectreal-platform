/**
 * Dashboard Header Component
 * @description Main header component with title, description and actions
 * Simplified using composable useDashboardContent hook
 */

import { memo } from 'react'

import { DashboardActions } from './dashboard-actions'
import { useDashboardHeaderData } from '../../hooks/use-dashboard-content'
import { ACTION_VARIANT } from '../../types/dashboard'

/**
 * DashboardHeader component renders the main page header
 * with dynamic title, description, and contextual actions
 * Memoized to prevent unnecessary re-renders
 */
export const DashboardHeader = memo(() => {
	const { title, description, actionVariant } = useDashboardHeaderData()

	return (
		actionVariant !== ACTION_VARIANT.SCENE_DETAIL && (
			<div className="space-y-8 p-6">
				<div className="flex grow flex-col items-start justify-between gap-4 md:flex-row">
					<div className="space-y-2">
						{/*
					  The h2 rung rather than a raw `text-5xl`. This was the last
					  heading in the dashboard sizing itself outside the scale, and at
					  a fixed 48px it did not respond to viewport width the way every
					  other heading does.
					*/}
						<h1 className="text-h2">{title}</h1>
						<span className="text-primary/50">{description}</span>
					</div>

					{actionVariant && <DashboardActions variant={actionVariant} />}
				</div>
			</div>
		)
	)
})

DashboardHeader.displayName = 'DashboardHeader'
