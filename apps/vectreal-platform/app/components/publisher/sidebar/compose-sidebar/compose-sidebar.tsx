import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from '@vctrl-ui/ui/accordion'

import { CardDescription, CardHeader, CardTitle } from '@vctrl-ui/ui/card'
import { Separator } from '@vctrl-ui/ui/separator'
import { MountainSnow, Tornado } from 'lucide-react'

import { EnvironmentSettings } from './environment-settings'
import { ShadowSettings } from './shadow-settings'

const ComposeSidebarContent: React.FC = () => {
	return (
		<div className="no-scrollbar flex h-full grow flex-col overflow-y-auto">
			<CardHeader className="py-6">
				<CardTitle>Compose Your Scene</CardTitle>
				<CardDescription>
					Perfect your 3D scene by adjusting lighting, shadows, and positioning
					to create the ideal presentation
				</CardDescription>
			</CardHeader>

			<Separator />

			<Accordion type="single" defaultValue="environment" collapsible>
				<AccordionItem value="environment" className="px-4">
					<AccordionTrigger className="px-2">
						<span className="flex items-center gap-3">
							<MountainSnow className="inline" size={14} />
							Environment Settings
						</span>
					</AccordionTrigger>
					<AccordionContent>
						<EnvironmentSettings />
					</AccordionContent>
				</AccordionItem>
				<AccordionItem value="shadow" className="px-4">
					<AccordionTrigger className="px-2">
						<span className="flex items-center gap-3">
							<Tornado className="inline" size={14} />
							Shadow Settings
						</span>
					</AccordionTrigger>
					<AccordionContent>
						<ShadowSettings />
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	)
}

export default ComposeSidebarContent
