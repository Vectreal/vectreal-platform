export const PREVIEW_API_KEY_PLACEHOLDER = 'YOUR_PREVIEW_API_KEY'

export const EMBED_COPY = {
	description:
		'Generate code to embed your 3D scene on websites or apps. External embeds require a preview API key and only published scenes are rendered.',
	unavailableUntilSaved:
		'Embedding is unavailable until this scene is saved and linked to a project.',
	draftWarningPrefix:
		'Draft scenes are not externally embeddable. Publish first, then replace',
	draftWarningSuffix: 'with a valid preview key.',
	previewUrlLabel: 'Embed Preview URL',
	previewUrlPlaceholder: 'Save scene to generate URL',
	embedCodeLabel: 'Embed Code',
	embedCodeHelp:
		'Use the code below to embed your scene into your website or app.',
	copyUrl: 'Copy URL',
	copyEmbed: 'Copy Embed',
	copied: 'Copied',
	copyEmbedSuccess: 'Embed code copied.',
	copyEmbedFailure: 'Failed to copy embed code.',
	copyUrlSuccess: 'Preview URL copied.',
	copyUrlFailure: 'Failed to copy preview URL.',
	clipboardUnavailable: 'Clipboard is not available in this browser.',
	missingSceneForEmbed: 'Save this scene first to generate an embed snippet.',
	missingSceneForUrl: 'Save this scene first to generate a preview URL.',
	embedCodeUnavailable:
		'<!-- Save this scene before generating an embed snippet -->'
} as const

type EmbedSnippetOptions = {
	src: string
	width?: string
	height?: string
}

const DEFAULT_WIDTH = '100%'
const DEFAULT_HEIGHT = '400px'

export function buildFullscreenPreviewPath(params: {
	projectId: string
	sceneId: string
}): string {
	return `/preview/fullscreen/${params.projectId}/${params.sceneId}`
}

export function addPreviewTokenPlaceholder(previewPath: string): string {
	const url = new URL(previewPath, 'http://localhost')
	url.searchParams.set('token', PREVIEW_API_KEY_PLACEHOLDER)
	return `${url.pathname}${url.search}`
}

export function toAbsoluteEmbedUrl(path: string, origin: string): string {
	return new URL(path, origin).toString()
}

export function buildResponsiveEmbedSnippet(
	options: EmbedSnippetOptions
): string {
	const width = options.width?.trim() || DEFAULT_WIDTH
	const height = options.height?.trim() || DEFAULT_HEIGHT

	return `<div style="width: ${width}; max-width: 100%; height: ${height};">
  <iframe
    src="${options.src}"
    style="width: 100%; height: 100%; border: 0;"
    allow="autoplay; xr-spatial-tracking"
    allowfullscreen
  ></iframe>
</div>`
}
