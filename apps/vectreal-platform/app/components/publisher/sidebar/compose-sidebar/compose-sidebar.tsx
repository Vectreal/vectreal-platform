import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from '@vctrl-ui/ui/accordion'

import { CardDescription, CardHeader, CardTitle } from '@vctrl-ui/ui/card'
import { Separator } from '@vctrl-ui/ui/separator'
import { MountainSnow } from 'lucide-react'

import { EnvironmentSettings } from './environment-settings'

const ComposeSidebarContent: React.FC = () => {
	return (
		<div className="flex h-full flex-col">
			<div className="no-scrollbar grow overflow-y-auto">
				<CardHeader className="py-6">
					<CardTitle>Compose Your Scene</CardTitle>
					<CardDescription>
						Perfect your 3D scene by adjusting lighting, shadows, and
						positioning to create the ideal presentation
					</CardDescription>
				</CardHeader>

				<Separator />

				<Accordion type="single" defaultValue="basic" collapsible>
					<AccordionItem value="basic" className="px-4">
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
				</Accordion>
			</div>
		</div>
	)
}

export default ComposeSidebarContent
