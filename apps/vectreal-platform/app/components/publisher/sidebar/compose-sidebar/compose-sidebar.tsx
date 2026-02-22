import { Accordion, AccordionContent } from '@shared/components/ui/accordion'
import { Camera, MountainSnow, Tornado } from 'lucide-react'
import { memo, useMemo } from 'react'

import { AccordionItem, AccordionTrigger } from '../accordion-components'
import { CameraControlsSettings } from './camera-controls-settings'
import { EnvironmentSettings } from './environment-settings'
import { ShadowSettings } from './shadow-settings'

/**
 * Accordion section configuration
 * Following React best practices:
 * - rendering-hoist-jsx: Static config hoisted outside component
 */
const ACCORDION_SECTIONS = [
	{
		value: 'environment',
		icon: MountainSnow,
		title: 'Environment Settings',
		component: EnvironmentSettings
	},
	{
		value: 'shadow',
		icon: Tornado,
		title: 'Shadow Settings',
		component: ShadowSettings
	},
	{
		value: 'camera-controls',
		icon: Camera,
		title: 'Camera Controls',
		component: CameraControlsSettings
	}
] as const

/**
 * ComposeSidebarContent component
 *
 * Following React best practices:
 * - rendering-hoist-jsx: Static section configs hoisted outside
 * - rerender-memo: Memoized to prevent unnecessary re-renders
 */
const ComposeSidebarContent = memo(() => {
	// Memoize accordion items to prevent recreation on each render
	const accordionItems = useMemo(
		() =>
			ACCORDION_SECTIONS.map(
				({ value, icon: Icon, title, component: Component }) => (
					<AccordionItem key={value} value={value}>
						<AccordionTrigger>
							<Icon className="inline" size={14} />
							{title}
						</AccordionTrigger>
						<AccordionContent>
							<Component />
						</AccordionContent>
					</AccordionItem>
				)
			),
		[]
	)

	return (
		<Accordion type="single" className="space-y-2" collapsible>
			{accordionItems}
		</Accordion>
	)
})

ComposeSidebarContent.displayName = 'ComposeSidebarContent'

export default ComposeSidebarContent
