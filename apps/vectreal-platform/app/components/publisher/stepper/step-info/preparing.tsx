import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle
} from '@shared/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle
} from '@shared/components/ui/dialog'
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

				<div className="flex w-full flex-col gap-4 py-4 md:flex-row">
					<Card className="bg-muted/25 w-full border-none">
						<CardHeader>
							<div className="flex items-center gap-2">
								<FilePlus className="text-primary mb-2 h-6 w-6" />
								<CardTitle>Optimization Options</CardTitle>
							</div>
							<CardDescription>
								<p>Choose from three optimization modes:</p>
								<ul className="list-disc pt-4 pl-4">
									<li>
										<strong className="text-primary">Low</strong>- Highest
										visual quality
									</li>
									<li>
										<strong className="text-primary">Medium</strong>- Balanced
										performance
									</li>
									<li>
										<strong className="text-primary">High</strong>- Maximum
										performance boost
									</li>
								</ul>
							</CardDescription>
						</CardHeader>
					</Card>
					<Card className="bg-muted/25 w-full border-none">
						<CardHeader>
							<div className="flex items-center gap-2">
								<Image className="text-primary mb-2 h-6 w-6" />
								<CardTitle>Scene Customization</CardTitle>
							</div>
							<CardDescription>
								Adjust lighting, camera angles, and environment settings to
								enhance your scene's visual appeal and performance.
							</CardDescription>
						</CardHeader>
					</Card>
				</div>
				<CardDescription className="text-muted-foreground/50 text-center text-xs">
					For granular control, use the Advanced Mode to manually configure
					expert optimization settings.
				</CardDescription>
			</DialogContent>
		</Dialog>
	)
}

export default PreparingStepInfo
