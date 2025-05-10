import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from '@vctrl-ui/ui/card'
import { FilePlus, Image } from 'lucide-react'

const UploadingStep = () => {
	return (
		<>
			<CardHeader>
				<CardTitle>Upload Your 3D Assets</CardTitle>
				<CardDescription>
					Here's what you need to know about supported formats and how we help
					optimize your content.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid gap-4 py-4 md:grid-cols-2">
					<Card className="bg-muted/25 border-accent/10">
						<CardHeader>
							<FilePlus className="text-primary mb-2 h-6 w-6" />

							<CardTitle>File Formats We Support</CardTitle>
							<CardDescription>
								You can upload: glTF, glTF-Draco, glTF-embedded, glTF with
								textures, USDZ (USDA), and OBJ files.
							</CardDescription>
						</CardHeader>
					</Card>
					<Card className="bg-muted/25 border-accent/10">
						<CardHeader>
							<Image className="text-primary mb-2 h-6 w-6" />
							<CardTitle>Texture Files</CardTitle>
							<CardDescription>
								Use PNG, JPG, or WEBP for your textures - all are fully
								supported and ready to go.
							</CardDescription>
						</CardHeader>
					</Card>
				</div>
				<CardDescription className="text-muted-foreground/50 text-xs">
					Need more help? Check out our documentation for detailed guidance on
					preparing your files for the best results.
				</CardDescription>
			</CardContent>
		</>
	)
}

export default UploadingStep
