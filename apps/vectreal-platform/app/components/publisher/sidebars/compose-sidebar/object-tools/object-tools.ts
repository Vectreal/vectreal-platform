import { BoxSelect, Layers, Sliders } from 'lucide-react'

import { ObjectListPanel, ObjectOverridesPanel } from '.'
import { AssetsSettings } from '../assets-settings'

import type { ObjectTool } from '../../../../../types/publisher-config'
import type { LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'

export interface ObjectToolDefinition {
	value: ObjectTool
	label: string
	shortLabel: string
	description: string
	icon: LucideIcon
	component: ComponentType
}

export const OBJECT_TOOL_DEFINITIONS: ObjectToolDefinition[] = [
	{
		value: 'object-list',
		label: 'Object List',
		shortLabel: 'Objects',
		description: 'Browse all nodes in the loaded scene document.',
		icon: Layers,
		component: ObjectListPanel
	},
	{
		value: 'object-overrides',
		label: 'Object Overrides',
		shortLabel: 'Overrides',
		description: 'Apply per-node transform and material overrides.',
		icon: Sliders,
		component: ObjectOverridesPanel
	},
	{
		value: 'placeables',
		label: 'Placeables',
		shortLabel: 'Placeables',
		description: 'Add built-in objects to the scene.',
		icon: BoxSelect,
		component: AssetsSettings
	}
]

export function getObjectToolDefinition(tool: ObjectTool): ObjectToolDefinition {
	return (
		OBJECT_TOOL_DEFINITIONS.find((d) => d.value === tool) ??
		OBJECT_TOOL_DEFINITIONS[0]
	)
}
