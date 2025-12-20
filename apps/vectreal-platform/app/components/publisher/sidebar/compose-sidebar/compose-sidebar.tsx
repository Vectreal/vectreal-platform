import { Accordion, AccordionContent } from '@shared/components/ui/accordion'
import { Camera, MountainSnow, Tornado } from 'lucide-react'

import { AccordionItem, AccordionTrigger } from '../accordion-components'

import { CameraControlsSettings } from './camera-controls-settings'
import { EnvironmentSettings } from './environment-settings'
import { ShadowSettings } from './shadow-settings'

const ComposeSidebarContent: React.FC = () => {
	return (
		<Accordion type="single" className="space-y-2" collapsible>
			<AccordionItem value="environment">
				<AccordionTrigger>
					<MountainSnow className="inline" size={14} />
					Environment Settings
				</AccordionTrigger>
				<AccordionContent>
					<EnvironmentSettings />
				</AccordionContent>
			</AccordionItem>
			<AccordionItem value="shadow">
				<AccordionTrigger>
					<Tornado className="inline" size={14} />
					Shadow Settings
				</AccordionTrigger>
				<AccordionContent>
					<ShadowSettings />
				</AccordionContent>
			</AccordionItem>
			<AccordionItem value="camera-controls">
				<AccordionTrigger>
					<Camera className="inline" size={14} />
					Camera Controls
				</AccordionTrigger>
				<AccordionContent>
					<CameraControlsSettings />
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	)
}

export default ComposeSidebarContent
