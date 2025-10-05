import { Accordion, AccordionContent } from '@vctrl-ui/ui/accordion'

import { CardDescription, CardHeader, CardTitle } from '@vctrl-ui/ui/card'
import { Separator } from '@vctrl-ui/ui/separator'
import { motion } from 'framer-motion'
import { BookMarked, Code, Save } from 'lucide-react'

import { AccordionItem, AccordionTrigger } from '../accordion-components'

import { sidebarContentVariants } from '../animation'

import { EmbedOptions } from './sections/embed-options'
import { SaveOptions } from './sections/save-options'
import { ScenePreview } from './sections/scene-preview'

interface PublishSidebarProps {
	userId?: string
	sceneId?: string
	projectId?: string
}

const PublishSidebarContent: React.FC<PublishSidebarProps> = ({
	userId,
	sceneId,
	projectId
}) => {
	return (
		<div className="no-scrollbar grow overflow-auto pb-2">
			<motion.div
				variants={sidebarContentVariants}
				initial="initial"
				animate="animate"
				exit="exit"
				key="publish-sidebar"
				className="overflow-auto"
			>
				<CardHeader className="py-6">
					<CardTitle>Publish Your Scene</CardTitle>
					<CardDescription>
						Save, publish, and share your 3D scene with the world
					</CardDescription>
				</CardHeader>

				<Separator />

				<ScenePreview />

				<Separator />

				<Accordion type="single" collapsible className="space-y-2 px-2">
					<AccordionItem value="save" className="px-4">
						<AccordionTrigger className="px-2">
							<span className="flex items-center gap-3">
								<Save className="inline" size={14} />
								Save & Export
							</span>
						</AccordionTrigger>
						<AccordionContent>
							<SaveOptions
								userId={userId}
								sceneId={sceneId}
								projectId={projectId}
							/>
						</AccordionContent>
					</AccordionItem>

					{/* <AccordionItem value="publish" className="px-4">
						<AccordionTrigger className="px-2">
							<span className="flex items-center gap-3">
								<Globe className="inline" size={14} />
								Publish
							</span>
						</AccordionTrigger>
						<AccordionContent>
							<PublishOptions />
						</AccordionContent>
					</AccordionItem> */}

					<AccordionItem value="embed" className="px-4">
						<AccordionTrigger className="px-2">
							<span className="flex items-center gap-3">
								<Code className="inline" size={14} />
								Embed
							</span>
						</AccordionTrigger>
						<AccordionContent>
							<EmbedOptions />
						</AccordionContent>
					</AccordionItem>

					{/* <AccordionItem value="share" className="px-4">
						<AccordionTrigger className="px-2">
							<span className="flex items-center gap-3">
								<Share2 className="inline" size={14} />
								Share
							</span>
						</AccordionTrigger>
						<AccordionContent>
							<ShareOptions />
						</AccordionContent>
					</AccordionItem> */}

					<AccordionItem value="history" className="px-4">
						<AccordionTrigger className="px-2">
							<span className="flex items-center gap-3">
								<BookMarked className="inline" size={14} />
								Version History
							</span>
						</AccordionTrigger>
						<AccordionContent>
							<div className="space-y-4 px-2 py-2">
								<div className="text-muted-foreground text-sm">
									Manage your scene's version history and restore previous
									versions.
								</div>
								{/* Version history would be displayed here */}
								<div className="text-muted-foreground py-8 text-center text-sm">
									No previous versions available.
								</div>
							</div>
						</AccordionContent>
					</AccordionItem>
				</Accordion>
			</motion.div>
		</div>
	)
}

export default PublishSidebarContent
