import { Card, CardDescription, CardHeader, CardTitle } from '@vctrl-ui/ui/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle
} from '@vctrl-ui/ui/dialog'

import { useAtom } from 'jotai'
import { FilePlus, Image } from 'lucide-react'

import { processAtom } from '../../../../lib/stores/publisher-config-store'

const PreparingStepInfo = () => {
	const [{ showInfo }, setProcess] = useAtom(processAtom)

	function closeInfo(isOpen: boolean) {
		setProcess((prev) => ({
			...prev,
			showInfo: isOpen
		}))
	}

	return (
		<Dialog open={showInfo} onOpenChange={closeInfo}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Prepare Your 3D Scene</DialogTitle>
					<DialogDescription>
						Fine-tune your 3D assets with optimization options, scene
						customization, and environment settings.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4 py-4">
					<Card className="bg-muted/25 border-accent/10">
						<CardHeader>
							<FilePlus className="text-primary mb-2 h-6 w-6" />

							<CardTitle>Optimization Options</CardTitle>
							<CardDescription>
								<p>Choose from three optimization modes:</p>
								<ul className="list-disc pt-4 pl-4">
									<li>Low - Highest visual quality</li>
									<li>Medium - Balanced performance</li>
									<li>High - Maximum performance boost</li>
								</ul>
							</CardDescription>
						</CardHeader>
					</Card>
					<Card className="bg-muted/25 border-accent/10">
						<CardHeader>
							<Image className="text-primary mb-2 h-6 w-6" />
							<CardTitle>Scene Customization</CardTitle>
							<CardDescription>
								Adjust lighting, camera angles, and environment settings to
								enhance your scene's visual appeal and performance.
							</CardDescription>
						</CardHeader>
					</Card>
				</div>
				<CardDescription className="text-muted-foreground/50 text-xs">
					For granular control, use the Advanced Mode to manually configure
					expert optimization settings.
				</CardDescription>
			</DialogContent>
		</Dialog>
	)
}

export default PreparingStepInfo
