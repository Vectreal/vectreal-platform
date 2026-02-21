/**
 * Dashboard Header Component
 * @description Main header component with title, description and actions
 * Simplified using composable useDashboardContent hook
 */

import { memo } from 'react'

import { useDashboardHeaderData } from '../../hooks/use-dashboard-content'

import { ACTION_VARIANT } from '../../types/dashboard'

import { DashboardActions } from './dashboard-actions'

/**
 * DashboardHeader component renders the main page header
 * with dynamic title, description, and contextual actions
 * Memoized to prevent unnecessary re-renders
 */
export const DashboardHeader = memo(() => {
	const { title, description, actionVariant } = useDashboardHeaderData()
	console.log(
		'DashboardHeader rendered with title:',
		title,
		'and actionVariant:',
		actionVariant
	)

	return (
		actionVariant !== ACTION_VARIANT.SCENE_DETAIL && (
			<div className="space-y-8 p-6">
				<div className="flex grow flex-col items-start justify-between gap-4 md:flex-row">
					<div className="space-y-2">
						<h1 className="text-5xl font-normal">{title}</h1>
						<span className="text-primary/50">{description}</span>
					</div>

					{actionVariant && <DashboardActions variant={actionVariant} />}
				</div>
			</div>
		)
	)
})

DashboardHeader.displayName = 'DashboardHeader'
