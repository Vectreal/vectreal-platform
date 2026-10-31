import {
	Camera,
	Clapperboard,
	Lightbulb,
	Locate,
	MousePointer2
} from 'lucide-react'

import { AnimationToolSettings } from './animation-settings'
import { CameraControlsSettings } from './camera-controls-settings'
import { HotspotsSettings } from './hotspot-settings'
import InteractionControlsSettings from './interaction-controls-settings-panel'
import { LightingSettings } from './lighting-settings'

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
		value: 'lighting',
		label: 'Lighting',
		shortLabel: 'Lighting',
		description:
			'Light the model with a studio setup: the environment, up to three lights and the shadows they cast.',
		icon: Lightbulb,
		component: LightingSettings
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
	},
	{
		value: 'animation',
		label: 'Animation',
		shortLabel: 'Animation',
		description:
			'Play the animation clips that come with the model, together or one after another.',
		icon: Clapperboard,
		component: AnimationToolSettings
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
