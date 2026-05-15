import { Camera, MountainSnow, Package, Sparkles, Tornado } from 'lucide-react'

import { AssetsSettings } from './assets-settings'
import { CameraToolsSettings } from './camera-tools-settings'
import { EnvironmentSettings } from './environment-settings'
import { HotspotsSettings } from './hotspots-settings'
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
		value: 'camera-tools',
		label: 'Camera & Interaction',
		shortLabel: 'Camera',
		description:
			'Manage saved cameras, field of view, transitions, and viewer interaction behaviour.',
		icon: Camera,
		component: CameraToolsSettings
	},
	{
		value: 'hotspots',
		label: 'Hotspots',
		shortLabel: 'Hotspots',
		description:
			'Place and configure hotspot markers linked to camera positions.',
		icon: Sparkles,
		component: HotspotsSettings
	},
	{
		value: 'assets',
		label: 'Assets',
		shortLabel: 'Assets',
		description:
			'Browse scene assets — textures, materials, and models — and save them for reuse.',
		icon: Package,
		component: AssetsSettings
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
