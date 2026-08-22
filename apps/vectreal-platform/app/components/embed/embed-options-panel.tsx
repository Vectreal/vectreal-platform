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
import { useEffect, useMemo, useState, type FC } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { EmbedKeyField } from './embed-key-field'
import { useEmbedApiKeys } from './use-embed-api-keys'
import { useClipboardCopy } from '../../hooks/use-clipboard-copy'
import {
	buildEmbedUrl,
	buildInternalPreviewPath,
	buildResponsiveEmbedSnippet,
	buildSdkEmbedSnippet,
	EMBED_COPY,
	toAbsoluteEmbedUrl
} from '../../lib/domain/embed/embed-snippet'
import { InfoTooltip } from '../info-tooltip'
import { InlineNotice } from '../layout-components'

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

	// Read after mount rather than during render: the server has no `window`, so
	// deriving the URL inline renders one thing on the server and another on the
	// client, which is a hydration mismatch on a form value.
	const [origin, setOrigin] = useState('')
	useEffect(() => setOrigin(window.location.origin), [])

	const canEmbed = Boolean(sceneId && projectId)
	const clipboard = useClipboardCopy()
	const keysApi = useEmbedApiKeys({ projectId, enabled: canEmbed })

	const embedUrl = useMemo(() => {
		if (!canEmbed || !origin) return ''

		return buildEmbedUrl({
			origin,
			projectId: projectId as string,
			sceneId: sceneId as string,
			token: keysApi.token
		})
	}, [canEmbed, origin, projectId, sceneId, keysApi.token])

	const internalPreviewUrl = useMemo(() => {
		if (!canEmbed || !origin) return ''

		return toAbsoluteEmbedUrl(
			buildInternalPreviewPath({
				projectId: projectId as string,
				sceneId: sceneId as string
			}),
			origin
		)
	}, [canEmbed, origin, projectId, sceneId])

	const embedCode = embedUrl
		? buildResponsiveEmbedSnippet({ src: embedUrl, width, height })
		: EMBED_COPY.embedCodeUnavailable

	const sdkCode = embedUrl
		? buildSdkEmbedSnippet({ src: embedUrl, width, height })
		: EMBED_COPY.sdkCodeUnavailable

	const copySnippet = (
		id: 'embed' | 'sdk',
		value: string,
		messages: { success: string; failure: string }
	) => {
		if (!canEmbed) {
			toast.error(EMBED_COPY.missingSceneForEmbed)
			return
		}

		void clipboard.copy(id, value, {
			...messages,
			unavailable: EMBED_COPY.clipboardUnavailable
		})
	}

	const handleCopyUrl = () => {
		if (!canEmbed) {
			toast.error(EMBED_COPY.missingSceneForUrl)
			return
		}

		void clipboard.copy('url', embedUrl, {
			success: EMBED_COPY.copyUrlSuccess,
			failure: EMBED_COPY.copyUrlFailure,
			unavailable: EMBED_COPY.clipboardUnavailable
		})
	}

	const copyIdentifier = (id: 'project-id' | 'scene-id', value: string) => {
		void clipboard.copy(id, value, {
			success: EMBED_COPY.copyIdSuccess,
			failure: EMBED_COPY.copyUrlFailure,
			unavailable: EMBED_COPY.clipboardUnavailable
		})
	}

	/*
	  `noopener` without `noreferrer`, deliberately. `noreferrer` strips the
	  `Referer` header, and `validatePreviewApiKeyForProject` then sees no
	  requester host at all: off a localhost-like instance that falls straight
	  through to `domain_not_allowed`, so the button meant to prove the embed
	  works would 403 on every production scene that is in fact fine.
	*/
	const openInNewTab = (url: string) => {
		if (!url) return
		window.open(url, '_blank', 'noopener')
	}

	return (
		<div className={cn('space-y-3', className)}>
			{!canEmbed && (
				<InlineNotice>{EMBED_COPY.unavailableUntilSaved}</InlineNotice>
			)}

			{canEmbed && (
				<>
					<EmbedKeyField api={keysApi} clipboard={clipboard} />

					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<Label className="text-sm">
								{EMBED_COPY.allowedDomainsLabel}
							</Label>
							<InfoTooltip content={EMBED_COPY.allowedDomainsHelp} />
							<Link
								to={`/dashboard/projects/${projectId}/edit`}
								className="text-label-xs text-muted-foreground hover:text-foreground ml-auto underline"
							>
								{EMBED_COPY.editProject}
							</Link>
						</div>
						{keysApi.allowedDomains.length === 0 ? (
							<InlineNotice>{EMBED_COPY.allowedDomainsEmpty}</InlineNotice>
						) : (
							<div className="flex flex-wrap gap-1">
								{keysApi.allowedDomains.map((domain) => (
									<code
										key={domain}
										className="bg-muted rounded-md px-2 py-0.5 font-mono text-xs"
									>
										{domain}
									</code>
								))}
							</div>
						)}
					</div>
				</>
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
						value={embedUrl}
						placeholder={EMBED_COPY.previewUrlPlaceholder}
					/>
					<Button
						variant="secondary"
						size="sm"
						onClick={handleCopyUrl}
						disabled={!canEmbed}
					>
						<Link2 className="mr-2 h-3.5 w-3.5" />
						{clipboard.copiedId === 'url'
							? EMBED_COPY.copied
							: EMBED_COPY.copyUrl}
					</Button>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => openInNewTab(internalPreviewUrl)}
						disabled={!canEmbed}
					>
						<ExternalLink className="mr-1 h-3.5 w-3.5" />
						{EMBED_COPY.openPreview}
					</Button>
					<InfoTooltip content={EMBED_COPY.openPreviewHelp} />
					<Button
						variant="ghost"
						size="sm"
						onClick={() => openInNewTab(embedUrl)}
						disabled={!canEmbed || !keysApi.token.trim()}
					>
						<ExternalLink className="mr-1 h-3.5 w-3.5" />
						{EMBED_COPY.testEmbedUrl}
					</Button>
					<InfoTooltip content={EMBED_COPY.testEmbedUrlHelp} />
				</div>
			</div>

			{canEmbed && (
				<div className="space-y-1">
					<Label className="text-sm">{EMBED_COPY.identifiersLabel}</Label>
					<div className="grid gap-1">
						{(
							[
								{
									id: 'project-id' as const,
									label: EMBED_COPY.projectIdLabel,
									value: projectId as string
								},
								{
									id: 'scene-id' as const,
									label: EMBED_COPY.sceneIdLabel,
									value: sceneId as string
								}
							] satisfies Array<{
								id: 'project-id' | 'scene-id'
								label: string
								value: string
							}>
						).map((identifier) => (
							<div key={identifier.id} className="flex items-center gap-2">
								<span className="text-muted-foreground w-20 shrink-0 text-xs">
									{identifier.label}
								</span>
								<code className="bg-muted min-w-0 flex-1 truncate rounded-md px-2 py-1 font-mono text-xs">
									{identifier.value}
								</code>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => copyIdentifier(identifier.id, identifier.value)}
									aria-label={identifier.label}
								>
									<Copy className="h-3 w-3" />
									{clipboard.copiedId === identifier.id && (
										<span className="ml-1 text-xs">{EMBED_COPY.copied}</span>
									)}
								</Button>
							</div>
						))}
					</div>
				</div>
			)}

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
							onClick={() =>
								copySnippet('embed', embedCode, {
									success: EMBED_COPY.copyEmbedSuccess,
									failure: EMBED_COPY.copyEmbedFailure
								})
							}
							disabled={!canEmbed}
						>
							<Copy className="mr-1 h-3 w-3" />
							{clipboard.copiedId === 'embed'
								? EMBED_COPY.copied
								: EMBED_COPY.copyEmbed}
						</Button>
						<div className="bg-muted no-scrollbar relative overflow-x-auto rounded-2xl p-3 font-mono text-xs">
							<pre>{embedCode}</pre>
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
							onClick={() =>
								copySnippet('sdk', sdkCode, {
									success: EMBED_COPY.copySdkSuccess,
									failure: EMBED_COPY.copySdkFailure
								})
							}
							disabled={!canEmbed}
						>
							<Copy className="mr-1 h-3 w-3" />
							{clipboard.copiedId === 'sdk'
								? EMBED_COPY.copied
								: EMBED_COPY.copySdk}
						</Button>
						<div className="bg-muted no-scrollbar relative overflow-x-auto rounded-2xl p-3 font-mono text-xs">
							<pre>{sdkCode}</pre>
						</div>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	)
}
