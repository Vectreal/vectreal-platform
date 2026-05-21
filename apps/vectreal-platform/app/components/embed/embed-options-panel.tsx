import { Button } from '@shared/components/ui/button'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger
} from '@shared/components/ui/tabs'
import { cn } from '@shared/utils'
import { Copy, ExternalLink, Link2 } from 'lucide-react'
import { useMemo, useState, type FC } from 'react'
import { toast } from 'sonner'

import {
	addPreviewTokenPlaceholder,
	buildFullscreenPreviewPath,
	buildResponsiveEmbedSnippet,
	buildSdkEmbedSnippet,
	EMBED_COPY,
	PREVIEW_API_KEY_PLACEHOLDER,
	toAbsoluteEmbedUrl
} from '../../lib/domain/embed/embed-snippet'
import { InfoTooltip } from '../info-tooltip'

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
	const [copiedSdk, setCopiedSdk] = useState(false)
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

	const absolutePreviewUrlNoToken = useMemo(() => {
		if (!previewPath || typeof window === 'undefined') return ''
		return toAbsoluteEmbedUrl(previewPath, window.location.origin)
	}, [previewPath])

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

	const generateSdkCode = () => {
		if (!absolutePreviewUrl) {
			return EMBED_COPY.sdkCodeUnavailable
		}

		return buildSdkEmbedSnippet({
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

	const handleCopySdk = async () => {
		if (!canEmbed) {
			toast.error(EMBED_COPY.missingSceneForEmbed)
			return
		}
		if (!navigator?.clipboard) {
			toast.error(EMBED_COPY.clipboardUnavailable)
			return
		}

		try {
			await navigator.clipboard.writeText(generateSdkCode())
			setCopiedSdk(true)
			window.setTimeout(() => setCopiedSdk(false), 1500)
			toast.success(EMBED_COPY.copySdkSuccess)
		} catch (error) {
			console.error('Failed to copy SDK snippet:', error)
			toast.error(EMBED_COPY.copySdkFailure)
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

	const handleOpenPreview = () => {
		if (!absolutePreviewUrlNoToken) return
		window.open(absolutePreviewUrlNoToken, '_blank', 'noopener,noreferrer')
	}

	return (
		<div className={cn('space-y-3', className)}>
			{!canEmbed && (
				<div className="border-warning/40 bg-warning/10 text-warning-muted-foreground rounded-2xl border px-3 py-2 text-xs">
					{EMBED_COPY.unavailableUntilSaved}
				</div>
			)}
			{canEmbed && (
				<div className="border-warning/40 bg-warning/10 text-warning-muted-foreground rounded-2xl border px-3 py-2 text-xs">
					{EMBED_COPY.draftWarningPrefix}
					<code className="mx-1">{PREVIEW_API_KEY_PLACEHOLDER}</code>
					{EMBED_COPY.draftWarningSuffix}
					<div className="text-warning-foreground/90 mt-1 text-[11px]">
						Tip: create separate keys per environment and restrict keys to only
						the projects each embed needs.
					</div>
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

			<div className="space-y-2">
				<Label className="text-sm">{EMBED_COPY.previewUrlLabel}</Label>
				<div className="flex items-center gap-2">
					<Input
						readOnly
						value={absolutePreviewUrl}
						placeholder={EMBED_COPY.previewUrlPlaceholder}
					/>
					<Button
						variant="secondary"
						size="sm"
						onClick={handleCopyUrl}
						disabled={!canEmbed}
					>
						<Link2 className="mr-2 h-3.5 w-3.5" />
						{copiedUrl ? EMBED_COPY.copied : EMBED_COPY.copyUrl}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={handleOpenPreview}
						disabled={!canEmbed}
						title={EMBED_COPY.openPreview}
					>
						<ExternalLink className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>

			<Tabs defaultValue="html">
				<TabsList className="w-full">
					<TabsTrigger value="html" className="flex-1">
						{EMBED_COPY.tabHtml}
					</TabsTrigger>
					<TabsTrigger value="sdk" className="flex-1">
						{EMBED_COPY.tabSdk}
					</TabsTrigger>
				</TabsList>

				<TabsContent value="html" className="mt-2 space-y-2">
					<div className="flex items-center gap-2">
						<Label className="w-fit max-w-full truncate text-sm">
							{EMBED_COPY.embedCodeLabel}
						</Label>
						<InfoTooltip content={EMBED_COPY.embedCodeHelp} />
					</div>
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
						<div className="bg-muted no-scrollbar relative overflow-x-auto rounded-2xl p-3 font-mono text-xs">
							<pre>{generateEmbedCode()}</pre>
						</div>
					</div>
				</TabsContent>

				<TabsContent value="sdk" className="mt-2 space-y-2">
					<div className="flex items-center gap-2">
						<Label className="w-fit max-w-full truncate text-sm">
							{EMBED_COPY.sdkCodeLabel}
						</Label>
						<InfoTooltip content={EMBED_COPY.sdkCodeHelp} />
					</div>
					<div className="relative">
						<Button
							variant="secondary"
							className="bg-muted/50 absolute top-2 right-2 z-10 backdrop-blur-sm"
							size="sm"
							onClick={handleCopySdk}
							disabled={!canEmbed}
						>
							<Copy className="mr-1 h-3 w-3" />
							{copiedSdk ? EMBED_COPY.copied : EMBED_COPY.copySdk}
						</Button>
						<div className="bg-muted no-scrollbar relative overflow-x-auto rounded-2xl p-3 font-mono text-xs">
							<pre>{generateSdkCode()}</pre>
						</div>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	)
}
