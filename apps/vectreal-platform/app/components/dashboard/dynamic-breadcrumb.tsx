/**
 * Dynamic Breadcrumb Component
 * @description Smart breadcrumb navigation that adapts to current route
 * Simplified using composable useDashboardContent hook
 * Features skeleton loading states and smooth fade animations
 */

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator
} from '@shared/components/ui/breadcrumb'
import { Skeleton } from '@shared/components/ui/skeleton'
import { AnimatePresence, motion } from 'framer-motion'
import { Fragment, memo } from 'react'
import { Link } from 'react-router'

import {
	getRouteContext,
	parseRouteParams
} from '../../components/dashboard/utils'
import { useDashboardHeaderData } from '../../hooks/use-dashboard-content'

import type { NavigationState } from '../../types/dashboard'

const getBreadcrumbNavigationState = (
	to: string,
	label: string
): NavigationState | undefined => {
	const routeContext = getRouteContext(to, parseRouteParams(to))

	switch (routeContext) {
		case 'project-detail':
			return { name: label, type: 'project' }
		case 'folder-detail':
			return { name: label, type: 'folder' }
		case 'scene-detail':
			return { name: label, type: 'scene' }
		default:
			return undefined
	}
}

/**
 * DynamicBreadcrumb component renders context-aware breadcrumb navigation
 * Uses shared dashboard content hook for consistent state management
 * Memoized to prevent unnecessary re-renders
 * Shows skeleton during loading and animates transitions
 */
export const DynamicBreadcrumb = memo(() => {
	const { breadcrumbs, isLoading } = useDashboardHeaderData()

	// No breadcrumbs to render (even when not loading)
	if (!isLoading && (!breadcrumbs || breadcrumbs.length === 0)) {
		return null
	}

	// Create a stable key that changes between loading and loaded states
	const contentKey = isLoading
		? 'breadcrumb-loading'
		: breadcrumbs?.map((item) => item.to || item.label).join('-') || 'empty'

	return (
		<AnimatePresence mode="wait" initial={false}>
			<motion.div
				key={contentKey}
				initial={{ opacity: 0, x: -4 }}
				animate={{ opacity: 1, x: 0 }}
				exit={{ opacity: 0, x: 12 }}
				transition={{
					duration: 0.15,
					ease: 'easeOut'
				}}
			>
				{isLoading ? (
					<Breadcrumb className="grow">
						<BreadcrumbList className="text-primary/75">
							<BreadcrumbItem>
								<Skeleton className="h-4 w-20" />
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<Skeleton className="h-4 w-16" />
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<Skeleton className="h-4 w-24" />
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				) : (
					<Breadcrumb className="grow">
						<BreadcrumbList className="text-primary/75">
							{breadcrumbs?.map((item, index) => {
								const isFirst = index === 0
								const showSeparator = !isFirst

								return (
									<Fragment key={item.to || item.label}>
										{showSeparator && <BreadcrumbSeparator />}
										<BreadcrumbItem>
											{item.isLast ? (
												<BreadcrumbPage className="text-primary">
													{item.label}
												</BreadcrumbPage>
											) : item.to ? (
												<BreadcrumbLink asChild>
													<Link
														viewTransition
														to={item.to}
														state={getBreadcrumbNavigationState(
															item.to,
															item.label
														)}
													>
														{item.label}
													</Link>
												</BreadcrumbLink>
											) : (
												<BreadcrumbPage>{item.label}</BreadcrumbPage>
											)}
										</BreadcrumbItem>
									</Fragment>
								)
							})}
						</BreadcrumbList>
					</Breadcrumb>
				)}
			</motion.div>
		</AnimatePresence>
	)
})

DynamicBreadcrumb.displayName = 'DynamicBreadcrumb'
