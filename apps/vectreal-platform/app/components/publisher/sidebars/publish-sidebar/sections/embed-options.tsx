import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { Separator } from '@shared/components/ui/separator'
import { motion } from 'framer-motion'
import { Copy, Link2 } from 'lucide-react'
import { useMemo, useState, type FC } from 'react'
import { toast } from 'sonner'

import { itemVariants } from '../../animation'

interface EmbedOptionsProps {
	sceneId?: string
	projectId?: string
}

export const EmbedOptions: FC<EmbedOptionsProps> = ({ sceneId, projectId }) => {
	const [width, setWidth] = useState('100%')
	const [height, setHeight] = useState('400px')
	const [copiedUrl, setCopiedUrl] = useState(false)
	const [copiedCode, setCopiedCode] = useState(false)
	const canEmbed = Boolean(sceneId && projectId)

	const previewPath = canEmbed
		? `/preview/fullscreen/${projectId}/${sceneId}`
		: ''
	const previewPathWithTokenPlaceholder = previewPath
		? `${previewPath}?token=YOUR_PREVIEW_API_KEY`
		: ''

	const absolutePreviewUrl = useMemo(() => {
		if (!previewPathWithTokenPlaceholder || typeof window === 'undefined') {
			return previewPathWithTokenPlaceholder
		}

		return new URL(
			previewPathWithTokenPlaceholder,
			window.location.origin
		).toString()
	}, [previewPathWithTokenPlaceholder])

	const generateEmbedCode = () => {
		if (!absolutePreviewUrl) {
			return '<!-- Save this scene before generating an embed snippet -->'
		}

		return `<iframe
  src="${absolutePreviewUrl}"
  width="${width}"
  height="${height}"
  allow="autoplay; xr-spatial-tracking"
  allowfullscreen
  frameborder="0"
></iframe>`
	}

	const handleCopyCode = async () => {
		if (!canEmbed) {
			toast.error('Save this scene first to generate an embed snippet.')
			return
		}
		if (!navigator?.clipboard) {
			toast.error('Clipboard is not available in this browser.')
			return
		}

		try {
			await navigator.clipboard.writeText(generateEmbedCode())
			setCopiedCode(true)
			window.setTimeout(() => setCopiedCode(false), 1500)
			toast.success('Embed code copied.')
		} catch (error) {
			console.error('Failed to copy embed code:', error)
			toast.error('Failed to copy embed code.')
		}
	}

	const handleCopyUrl = async () => {
		if (!canEmbed) {
			toast.error('Save this scene first to generate a preview URL.')
			return
		}
		if (!navigator?.clipboard) {
			toast.error('Clipboard is not available in this browser.')
			return
		}

		try {
			await navigator.clipboard.writeText(absolutePreviewUrl)
			setCopiedUrl(true)
			window.setTimeout(() => setCopiedUrl(false), 1500)
			toast.success('Preview URL copied.')
		} catch (error) {
			console.error('Failed to copy preview URL:', error)
			toast.error('Failed to copy preview URL.')
		}
	}

	return (
		<motion.div variants={itemVariants} className="space-y-4 px-2 py-2">
			<div className="text-muted-foreground text-sm">
				Generate code to embed your 3D scene on websites or apps. External
				embeds require a preview API key and only published scenes are rendered.
			</div>
			{!canEmbed && (
				<div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
					Embedding is unavailable until this scene is saved and linked to a
					project.
				</div>
			)}
			{canEmbed && (
				<div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
					Draft scenes are not externally embeddable. Publish first, then
					replace
					<code className="mx-1">YOUR_PREVIEW_API_KEY</code> with a valid
					preview key.
				</div>
			)}

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
				<Label className="text-sm">Embed Preview URL</Label>
				<Input
					readOnly
					value={absolutePreviewUrl}
					placeholder="Save scene to generate URL"
				/>
				<div className="flex justify-end">
					<Button
						variant="secondary"
						size="sm"
						onClick={handleCopyUrl}
						disabled={!canEmbed}
					>
						<Link2 className="mr-2 h-3.5 w-3.5" />
						{copiedUrl ? 'Copied' : 'Copy URL'}
					</Button>
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
						variant="secondary"
						className="absolute top-2 right-2 z-10"
						size="sm"
						onClick={handleCopyCode}
						disabled={!canEmbed}
					>
						<Copy className="mr-1 h-3 w-3" />
						{copiedCode ? 'Copied' : 'Copy Embed'}
					</Button>
					<pre>{generateEmbedCode()}</pre>
				</div>
			</div>
		</motion.div>
	)
}
