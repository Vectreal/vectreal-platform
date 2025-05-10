import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@vctrl-ui/ui/card'
import { FilePlus, Image } from 'lucide-react'

const PreparingStep = () => {
	return (
		<>
			<CardHeader>
				<CardTitle>Prepare Your 3D Scene</CardTitle>
				<CardDescription>
					Fine-tune your 3D assets with optimization options, scene
					customization, and environment settings.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid gap-4 py-4 md:grid-cols-2">
					<Card className="bg-muted/25 border-accent/10">
						<CardHeader>
							<FilePlus className="text-primary mb-2 h-6 w-6" />

							<CardTitle>Optimization Options</CardTitle>
							<CardDescription>
								Choose from three optimization modes: • Low - Highest visual
								quality • Medium - Balanced performance • High - Maximum
								performance boost
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
			</CardContent>
		</>
	)
}

export default PreparingStep
