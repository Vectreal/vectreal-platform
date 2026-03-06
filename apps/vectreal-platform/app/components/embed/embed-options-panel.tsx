import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { Separator } from '@shared/components/ui/separator'
import { cn } from '@shared/utils'
import { Copy, Link2 } from 'lucide-react'
import { useMemo, useState, type FC } from 'react'
import { toast } from 'sonner'

import {
	addPreviewTokenPlaceholder,
	buildFullscreenPreviewPath,
	buildResponsiveEmbedSnippet,
	EMBED_COPY,
	PREVIEW_API_KEY_PLACEHOLDER,
	toAbsoluteEmbedUrl
} from '../../lib/domain/embed/embed-snippet'

interface EmbedOptionsPanelProps {
	sceneId?: string
	projectId?: string
	className?: string
}

export const EmbedOptionsPanel: FC<EmbedOptionsPanelProps> = ({
	sceneId,
	projectId,
	className
}) => {
	const [width, setWidth] = useState('100%')
	const [height, setHeight] = useState('400px')
	const [copiedUrl, setCopiedUrl] = useState(false)
	const [copiedCode, setCopiedCode] = useState(false)
	const canEmbed = Boolean(sceneId && projectId)

	const previewPath = canEmbed
		? buildFullscreenPreviewPath({
				projectId: projectId as string,
				sceneId: sceneId as string
			})
		: ''
	const previewPathWithTokenPlaceholder = previewPath
		? addPreviewTokenPlaceholder(previewPath)
		: ''

	const absolutePreviewUrl = useMemo(() => {
		if (!previewPathWithTokenPlaceholder || typeof window === 'undefined') {
			return previewPathWithTokenPlaceholder
		}

		return toAbsoluteEmbedUrl(
			previewPathWithTokenPlaceholder,
			window.location.origin
		)
	}, [previewPathWithTokenPlaceholder])

	const generateEmbedCode = () => {
		if (!absolutePreviewUrl) {
			return EMBED_COPY.embedCodeUnavailable
		}

		return buildResponsiveEmbedSnippet({
			src: absolutePreviewUrl,
			width,
			height
		})
	}

	const handleCopyCode = async () => {
		if (!canEmbed) {
			toast.error(EMBED_COPY.missingSceneForEmbed)
			return
		}
		if (!navigator?.clipboard) {
			toast.error(EMBED_COPY.clipboardUnavailable)
			return
		}

		try {
			await navigator.clipboard.writeText(generateEmbedCode())
			setCopiedCode(true)
			window.setTimeout(() => setCopiedCode(false), 1500)
			toast.success(EMBED_COPY.copyEmbedSuccess)
		} catch (error) {
			console.error('Failed to copy embed code:', error)
			toast.error(EMBED_COPY.copyEmbedFailure)
		}
	}

	const handleCopyUrl = async () => {
		if (!canEmbed) {
			toast.error(EMBED_COPY.missingSceneForUrl)
			return
		}
		if (!navigator?.clipboard) {
			toast.error(EMBED_COPY.clipboardUnavailable)
			return
		}

		try {
			await navigator.clipboard.writeText(absolutePreviewUrl)
			setCopiedUrl(true)
			window.setTimeout(() => setCopiedUrl(false), 1500)
			toast.success(EMBED_COPY.copyUrlSuccess)
		} catch (error) {
			console.error('Failed to copy preview URL:', error)
			toast.error(EMBED_COPY.copyUrlFailure)
		}
	}

	return (
		<div className={cn('space-y-4', className)}>
			<div className="text-muted-foreground text-sm">
				{EMBED_COPY.description}
			</div>
			{!canEmbed && (
				<div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
					{EMBED_COPY.unavailableUntilSaved}
				</div>
			)}
			{canEmbed && (
				<div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
					{EMBED_COPY.draftWarningPrefix}
					<code className="mx-1">{PREVIEW_API_KEY_PLACEHOLDER}</code>
					{EMBED_COPY.draftWarningSuffix}
				</div>
			)}

			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-2">
					<Label htmlFor="embed-width" className="text-sm">
						Width
					</Label>
					<Input
						id="embed-width"
						value={width}
						onChange={(e) => setWidth(e.target.value)}
						placeholder="e.g. 100% or 600px"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="embed-height" className="text-sm">
						Height
					</Label>
					<Input
						id="embed-height"
						value={height}
						onChange={(e) => setHeight(e.target.value)}
						placeholder="e.g. 400px"
					/>
				</div>
			</div>

			<Separator />

			<div className="space-y-2">
				<Label className="text-sm">{EMBED_COPY.previewUrlLabel}</Label>
				<Input
					readOnly
					value={absolutePreviewUrl}
					placeholder={EMBED_COPY.previewUrlPlaceholder}
				/>
				<div className="flex justify-end">
					<Button
						variant="secondary"
						size="sm"
						onClick={handleCopyUrl}
						disabled={!canEmbed}
					>
						<Link2 className="mr-2 h-3.5 w-3.5" />
						{copiedUrl ? EMBED_COPY.copied : EMBED_COPY.copyUrl}
					</Button>
				</div>
			</div>

			<Separator />

			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label className="text-sm">{EMBED_COPY.embedCodeLabel}</Label>
				</div>
				<p>{EMBED_COPY.embedCodeHelp}</p>
				<div className="relative">
					<Button
						variant="secondary"
						className="bg-muted/50 absolute top-2 right-2 z-10 backdrop-blur-sm"
						size="sm"
						onClick={handleCopyCode}
						disabled={!canEmbed}
					>
						<Copy className="mr-1 h-3 w-3" />
						{copiedCode ? EMBED_COPY.copied : EMBED_COPY.copyEmbed}
					</Button>
					<div className="bg-muted no-scrollbar relative overflow-x-auto rounded-md p-3 font-mono text-xs">
						<pre>{generateEmbedCode()}</pre>
					</div>
				</div>
			</div>
		</div>
	)
}
