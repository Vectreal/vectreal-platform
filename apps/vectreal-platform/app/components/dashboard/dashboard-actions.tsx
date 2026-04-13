/**
 * Dashboard Action Buttons
 * @description Centralized action buttons component for different dashboard views
 */

import { Button } from '@shared/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@shared/components/ui/dropdown-menu'
import { useSetAtom } from 'jotai/react'
import {
	ArrowUp,
	Edit,
	Folder,
	FolderOpen,
	MoreVertical,
	Plus
} from 'lucide-react'
import { memo, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import { identifyDrawerRoute } from './utils'
import { PUBLISHER_ROUTES } from '../../constants/dashboard'
import { createFolderDialogAtom } from '../../lib/stores/dashboard-management-store'
import { ACTION_VARIANT } from '../../types/dashboard'

// Types
interface DashboardActionsProps {
	variant: ACTION_VARIANT
	className?: string
}

/** Context supplied to dynamic route resolver functions. */
interface RouteContext {
	projectId?: string
	folderId?: string
	sceneId?: string
}

/** A route can be a static path string or a resolver that receives URL context. */
type RouteValue = string | ((ctx: RouteContext) => string)

interface ActionConfig {
	label: string
	icon: typeof Plus
	to?: RouteValue
	onClick?: () => void
	variant?: 'default' | 'outline'
}

interface ActionGroupConfig {
	primary: ActionConfig
	secondary?: ActionConfig
	menu?: ActionConfig[]
}

interface ActionButtonProps {
	action: ActionConfig
	routeContext: RouteContext
}

interface ActionsMenuProps {
	actions: ActionConfig[]
	routeContext: RouteContext
}

// Action Configurations
const ACTION_CONFIGS: Record<ACTION_VARIANT, ActionGroupConfig | null> = {
	[ACTION_VARIANT.DASHBOARD]: {
		primary: {
			label: 'Upload Model',
			icon: ArrowUp,
			to: '/publisher'
		},
		menu: [
			{
				label: 'Browse Projects',
				icon: FolderOpen,
				to: '/dashboard/projects'
			},
			{
				label: 'Manage Organizations',
				icon: Folder,
				to: '/dashboard/organizations'
			}
		]
	},
	[ACTION_VARIANT.PROJECT_LIST]: {
		primary: {
			label: 'New Project',
			icon: Plus,
			to: '/dashboard/projects/new'
		}
	},
	[ACTION_VARIANT.API_KEYS_LIST]: {
		primary: {
			label: 'New API Key',
			icon: Plus,
			to: '/dashboard/api-keys/new'
		}
	},
	[ACTION_VARIANT.CREATE_PROJECT]: {
		primary: {
			label: 'Create Project',
			icon: Plus
		}
	},
	[ACTION_VARIANT.PROJECT_DETAIL]: {
		primary: {
			label: 'New Folder',
			icon: Plus,
			variant: 'outline'
		},
		secondary: {
			label: 'Upload Model',
			icon: ArrowUp,
			to: ({ projectId }: RouteContext) =>
				PUBLISHER_ROUTES.withContext(projectId),
			variant: 'default'
		},
		menu: [
			{
				label: 'Edit Project',
				icon: Edit,
				to: '/dashboard/projects/:projectId/edit'
			}
		]
	},
	[ACTION_VARIANT.FOLDER_DETAIL]: {
		primary: {
			label: 'New Folder',
			icon: Plus,
			variant: 'outline'
		},
		secondary: {
			label: 'Upload Model',
			icon: ArrowUp,
			to: ({ projectId, folderId }: RouteContext) =>
				PUBLISHER_ROUTES.withContext(projectId, folderId),
			variant: 'default'
		}
	},
	[ACTION_VARIANT.SCENE_DETAIL]: {
		primary: {
			label: 'Edit Scene',
			icon: Edit,
			to: '/publisher/:sceneId'
		}
	},
	[ACTION_VARIANT.ORG_LIST]: null
}

// Components
const ActionButton = memo<ActionButtonProps>(({ action, routeContext }) => {
	const { label, icon: Icon, to, onClick, variant = 'default' } = action

	const resolvedTo = to
		? typeof to === 'function'
			? to(routeContext)
			: Object.entries(routeContext).reduce(
					(path, [key, value]) =>
						value ? path.replace(`:${key}`, value) : path,
					to
				)
		: undefined

	const button = (
		<Button variant={variant} onClick={onClick}>
			<Icon className="mr-2 h-4 w-4" />
			{label}
		</Button>
	)

	// Skip view transition for drawer routes to prevent header flickering
	const isDrawerRoute = identifyDrawerRoute(resolvedTo || '')
	const useViewTransition = !isDrawerRoute

	return resolvedTo ? (
		<Link viewTransition={useViewTransition} to={resolvedTo}>
			{button}
		</Link>
	) : (
		button
	)
})

ActionButton.displayName = 'ActionButton'

const ActionsMenu = memo<ActionsMenuProps>(({ actions, routeContext }) => {
	const [isClientMounted, setIsClientMounted] = useState(false)
	useEffect(() => setIsClientMounted(true), [])

	const trigger = (
		<Button
			variant="outline"
			size="icon"
			aria-label="More actions"
			disabled={!isClientMounted}
		>
			<MoreVertical className="h-4 w-4" />
		</Button>
	)

	if (!isClientMounted) return trigger

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{actions.map((action) => {
					const { label, icon: Icon, to, onClick } = action
					const resolvedTo = to
						? typeof to === 'function'
							? to(routeContext)
							: Object.entries(routeContext).reduce(
									(path, [key, value]) =>
										value ? path.replace(`:${key}`, value) : path,
									to
								)
						: undefined

					const content = (
						<>
							<Icon className="mr-2 h-4 w-4" />
							{label}
						</>
					)

					return resolvedTo ? (
						<DropdownMenuItem key={label} asChild>
							<Link viewTransition to={resolvedTo}>
								{content}
							</Link>
						</DropdownMenuItem>
					) : (
						<DropdownMenuItem key={label} onClick={onClick}>
							{content}
						</DropdownMenuItem>
					)
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	)
})

ActionsMenu.displayName = 'SecondaryActionsMenu'

/**
 * DashboardActions component renders contextual action buttons
 * with a primary action and optional secondary actions in a dropdown menu
 * Memoized to prevent unnecessary re-renders
 */
export const DashboardActions = memo<DashboardActionsProps>(
	({ variant, className }) => {
		const { sceneId, projectId, folderId } = useParams()
		const setCreateFolderDialog = useSetAtom(createFolderDialogAtom)

		let config = ACTION_CONFIGS[variant]

		if (
			config !== undefined &&
			(variant === ACTION_VARIANT.PROJECT_DETAIL ||
				variant === ACTION_VARIANT.FOLDER_DETAIL)
		) {
			config = {
				...config,
				primary: {
					label: 'New Folder',
					icon: Plus,
					variant: 'outline',
					onClick: () => {
						setCreateFolderDialog({
							open: true,
							projectId: projectId || '',
							parentFolderId: folderId || null,
							name: '',
							description: ''
						})
					}
				}
			}
		}

		if (!config) {
			return null
		}

		const routeContext: RouteContext = { projectId, folderId, sceneId }

		return (
			<>
				<div className={className}>
					<div className="flex gap-2">
						<ActionButton action={config.primary} routeContext={routeContext} />
						{config.secondary && (
							<ActionButton
								action={config.secondary}
								routeContext={routeContext}
							/>
						)}
						{config.menu && config.menu.length > 0 && (
							<ActionsMenu actions={config.menu} routeContext={routeContext} />
						)}
					</div>
				</div>
			</>
		)
	}
)

DashboardActions.displayName = 'DashboardActions'
