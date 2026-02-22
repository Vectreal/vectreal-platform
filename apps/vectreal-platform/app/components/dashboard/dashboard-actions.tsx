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
import { Edit, Folder, FolderOpen, MoreVertical, Plus } from 'lucide-react'
import { memo } from 'react'
import { Link, useParams } from 'react-router'

import { ACTION_VARIANT } from '../../types/dashboard'
import { createFolderDialogAtom } from '../../lib/stores/dashboard-management-store'

// Types
interface DashboardActionsProps {
	variant: ACTION_VARIANT
	className?: string
}

interface ActionConfig {
	label: string
	icon: typeof Plus
	to?: string
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
	replacements?: Record<string, string>
}

interface ActionsMenuProps {
	actions: ActionConfig[]
	replacements?: Record<string, string>
}

// Action Configurations
const ACTION_CONFIGS: Record<ACTION_VARIANT, ActionGroupConfig | null> = {
	[ACTION_VARIANT.DASHBOARD]: {
		primary: {
			label: 'New Project',
			icon: Plus,
			to: '/dashboard/projects/new'
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
			label: 'Open Publisher',
			icon: Plus,
			to: '/publisher',
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
			label: 'Open Publisher',
			icon: Plus,
			to: '/publisher',
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
const ActionButton = memo<ActionButtonProps>(({ action, replacements }) => {
	const { label, icon: Icon, to, onClick, variant = 'default' } = action

	const resolvedTo =
		to && replacements
			? Object.entries(replacements).reduce(
					(path, [key, value]) => path.replace(`:${key}`, value),
					to
				)
			: to

	const button = (
		<Button variant={variant} onClick={onClick}>
			<Icon className="mr-2 h-4 w-4" />
			{label}
		</Button>
	)

	// Skip view transition for drawer routes to prevent header flickering
	const useViewTransition = resolvedTo !== '/dashboard/projects/new'

	return resolvedTo ? (
		<Link viewTransition={useViewTransition} to={resolvedTo}>
			{button}
		</Link>
	) : (
		button
	)
})

ActionButton.displayName = 'ActionButton'

const ActionsMenu = memo<ActionsMenuProps>(({ actions, replacements }) => (
	<DropdownMenu>
		<DropdownMenuTrigger asChild>
			<Button variant="outline" size="icon" aria-label="More actions">
				<MoreVertical className="h-4 w-4" />
			</Button>
		</DropdownMenuTrigger>
		<DropdownMenuContent align="end">
			{actions.map((action) => {
				const { label, icon: Icon, to, onClick } = action
				const resolvedTo =
					to && replacements
						? Object.entries(replacements).reduce(
								(path, [key, value]) => path.replace(`:${key}`, value),
								to
							)
						: to

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
))

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

		const replacements = sceneId ? { sceneId } : undefined

		return (
			<>
				<div className={className}>
					<div className="flex gap-2">
						<ActionButton action={config.primary} replacements={replacements} />
						{config.secondary && (
							<ActionButton
								action={config.secondary}
								replacements={replacements}
							/>
						)}
						{config.menu && config.menu.length > 0 && (
							<ActionsMenu actions={config.menu} replacements={replacements} />
						)}
					</div>
				</div>
			</>
		)
	}
)

DashboardActions.displayName = 'DashboardActions'
