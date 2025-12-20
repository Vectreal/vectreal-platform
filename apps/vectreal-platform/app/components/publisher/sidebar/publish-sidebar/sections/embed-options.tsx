import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { Separator } from '@shared/components/ui/separator'
import { motion } from 'framer-motion'
import { ClipboardCopy } from 'lucide-react'
import { useState } from 'react'

import { itemVariants } from '../../animation'

export const EmbedOptions: React.FC = () => {
	const [width, setWidth] = useState('100%')
	const [height, setHeight] = useState('400px')
	const [autoRotate] = useState(true)
	const [showControls] = useState(true)
	const [showUI] = useState(true)

	const generateEmbedCode = () => {
		return `<iframe
  src="https://example.com/embed/scene-id?autoRotate=${autoRotate}&controls=${showControls}&ui=${showUI}"
  width="${width}"
  height="${height}"
  allow="autoplay; xr-spatial-tracking"
  allowfullscreen
  frameborder="0"
></iframe>`
	}

	const handleCopyCode = () => {
		navigator.clipboard
			.writeText(generateEmbedCode())
			.then(() => {
				console.log('Code copied to clipboard')
			})
			.catch((err) => {
				console.error('Failed to copy code: ', err)
			})
	}

	return (
		<motion.div variants={itemVariants} className="space-y-4 px-2 py-2">
			<div className="text-muted-foreground text-sm">
				Generate code to embed your 3D scene on websites or apps
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label htmlFor="width" className="text-sm">
						Width
					</Label>
					<Input
						id="width"
						value={width}
						onChange={(e) => setWidth(e.target.value)}
						placeholder="e.g. 100% or 600px"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="height" className="text-sm">
						Height
					</Label>
					<Input
						id="height"
						value={height}
						onChange={(e) => setHeight(e.target.value)}
						placeholder="e.g. 400px"
					/>
				</div>
			</div>

			<Separator />

			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label className="text-sm">Embed Code</Label>
				</div>
				<p>Use the code below to embed your scene into your website or app.</p>
				<div className="bg-muted no-scrollbar relative overflow-x-auto rounded-md p-3 font-mono text-xs">
					<Button
						variant="outline"
						className="absolute top-2 right-2 z-10"
						size="sm"
						onClick={handleCopyCode}
					>
						<ClipboardCopy className="mr-1 h-3 w-3" />
						Copy
					</Button>
					<pre>{generateEmbedCode()}</pre>
				</div>
			</div>
		</motion.div>
	)
}
