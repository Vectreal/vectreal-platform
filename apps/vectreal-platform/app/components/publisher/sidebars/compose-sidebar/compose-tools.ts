import {
	Camera,
	Locate,
	MountainSnow,
	MousePointer2,
	Tornado
} from 'lucide-react'

import { CameraControlsSettings } from './camera-controls-settings'
import { EnvironmentSettings } from './environment-settings'
import { HotspotsSettings } from './hotspots-settings'
import { InteractionControlsSettings } from './interaction-controls-settings'
import { ShadowSettings } from './shadow-settings'

import type { ComposeTool } from '../../../../types/publisher-config'
import type { LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'

interface ComposeToolDefinition {
	value: ComposeTool
	label: string
	shortLabel: string
	description: string
	icon: LucideIcon
	component: ComponentType
}

const COMPOSE_TOOL_DEFINITIONS: ComposeToolDefinition[] = [
	{
		value: 'environment',
		label: 'Environment',
		shortLabel: 'Environment',
		description:
			'Shape ambient lighting, reflections, and the scene background.',
		icon: MountainSnow,
		component: EnvironmentSettings
	},
	{
		value: 'shadow',
		label: 'Shadows',
		shortLabel: 'Shadows',
		description:
			'Adjust contact and soft shadows without opening a full settings stack.',
		icon: Tornado,
		component: ShadowSettings
	},
	{
		value: 'camera-controls',
		label: 'Camera',
		shortLabel: 'Camera',
		description:
			'Manage saved cameras, field of view, and animated transitions.',
		icon: Camera,
		component: CameraControlsSettings
	},
	{
		value: 'interaction-controls',
		label: 'Interaction',
		shortLabel: 'Interaction',
		description:
			'Configure how viewers orbit, zoom, and move around the scene.',
		icon: MousePointer2,
		component: InteractionControlsSettings
	},
	{
		value: 'hotspots',
		label: 'Hotspots',
		shortLabel: 'Hotspots',
		description:
			'Add point-of-interest markers linked to saved camera positions.',
		icon: Locate,
		component: HotspotsSettings
	}
]

function getComposeToolDefinition(value: ComposeTool): ComposeToolDefinition {
	return (
		COMPOSE_TOOL_DEFINITIONS.find((tool) => tool.value === value) ??
		COMPOSE_TOOL_DEFINITIONS[0]
	)
}

export { COMPOSE_TOOL_DEFINITIONS, getComposeToolDefinition }
export type { ComposeToolDefinition }
