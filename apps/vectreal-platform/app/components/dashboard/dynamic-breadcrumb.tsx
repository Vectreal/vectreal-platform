/**
 * Dynamic Breadcrumb Component
 * @description Smart breadcrumb navigation that adapts to current route
 * Simplified using composable useDashboardContent hook
 */

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator
} from '@shared/components/ui/breadcrumb'
import React, { memo } from 'react'
import { Link } from 'react-router'

import { useDashboardContent } from '../../hooks'

/**
 * DynamicBreadcrumb component renders context-aware breadcrumb navigation
 * Uses shared dashboard content hook for consistent state management
 * Memoized to prevent unnecessary re-renders
 */
export const DynamicBreadcrumb = memo(() => {
	const { breadcrumbs } = useDashboardContent()

	// No breadcrumbs to render
	if (!breadcrumbs || breadcrumbs.length === 0) {
		return null
	}

	return (
		<Breadcrumb className="grow">
			<BreadcrumbList className="text-primary/75">
				{breadcrumbs.map((item, index) => {
					const isFirst = index === 0
					const showSeparator = !isFirst

					return (
						<React.Fragment key={item.to || item.label}>
							{showSeparator && <BreadcrumbSeparator />}
							<BreadcrumbItem>
								{item.isLast ? (
									<BreadcrumbPage className="text-primary">
										{item.label}
									</BreadcrumbPage>
								) : item.to ? (
									<BreadcrumbLink asChild>
										<Link viewTransition to={item.to}>
											{item.label}
										</Link>
									</BreadcrumbLink>
								) : (
									<BreadcrumbPage>{item.label}</BreadcrumbPage>
								)}
							</BreadcrumbItem>
						</React.Fragment>
					)
				})}
			</BreadcrumbList>
		</Breadcrumb>
	)
})

DynamicBreadcrumb.displayName = 'DynamicBreadcrumb'

DynamicBreadcrumb.displayName = 'DynamicBreadcrumb'
