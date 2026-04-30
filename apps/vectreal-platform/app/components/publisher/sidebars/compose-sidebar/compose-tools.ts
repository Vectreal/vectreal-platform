import { Camera, MountainSnow, Tornado } from 'lucide-react'

import { CameraControlsSettings } from './camera-controls-settings'
import { EnvironmentSettings } from './environment-settings'
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
			'Manage saved cameras, framing, and movement settings in one focused inspector.',
		icon: Camera,
		component: CameraControlsSettings
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
