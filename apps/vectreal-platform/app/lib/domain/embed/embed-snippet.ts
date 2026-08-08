export const PREVIEW_API_KEY_PLACEHOLDER = 'YOUR_PREVIEW_API_KEY'

/**
 * CDN URL for the `@vctrl/embed` UMD build used by the generated SDK snippet.
 *
 * This used to point at `cdn.vectreal.com`, a host that has never existed - no
 * DNS record for it is provisioned in `terraform/cloudflare.tf` and nothing
 * uploads build output to a CDN. The UMD bundle only ever ships inside the npm
 * tarball, so the snippet serves it from an npm CDN instead.
 *
 * Deliberately unversioned: unpkg resolves the bare specifier to the latest
 * published version, so there is no version here to drift out of step with
 * `packages/embed/package.json`.
 */
export const EMBED_SDK_CDN_URL =
	'https://unpkg.com/@vctrl/embed/vectreal-embed.umd.js'

export const EMBED_COPY = {
	unavailableUntilSaved:
		'Embedding is unavailable until this scene is saved and linked to a project.',
	draftWarningPrefix:
		'External embeds stay protected. Publish first, then replace',
	draftWarningSuffix:
		'with a valid preview API key token. Signed-in dashboard users can preview via session auth.',
	previewUrlLabel: 'Embed Preview URL',
	previewUrlPlaceholder: 'Save scene to generate URL',
	embedCodeLabel: 'Embed Code',
	embedCodeHelp:
		'Embed with a plain iframe or use the JavaScript SDK for runtime control - camera switching, scroll interactions, and event callbacks.',
	sdkCodeLabel: 'JavaScript SDK',
	sdkCodeHelp:
		'Include the SDK to control the embed from your page: switch cameras, listen to events, trigger scroll interactions, and more. Install via npm or use the CDN script tag.',
	copyUrl: 'Copy URL',
	copyEmbed: 'Copy Embed',
	copySdk: 'Copy SDK',
	copied: 'Copied',
	copyEmbedSuccess: 'Embed code copied.',
	copyEmbedFailure: 'Failed to copy embed code.',
	copySdkSuccess: 'SDK snippet copied.',
	copySdkFailure: 'Failed to copy SDK snippet.',
	copyUrlSuccess: 'Preview URL copied.',
	copyUrlFailure: 'Failed to copy preview URL.',
	clipboardUnavailable: 'Clipboard is not available in this browser.',
	missingSceneForEmbed: 'Save this scene first to generate an embed snippet.',
	missingSceneForUrl: 'Save this scene first to generate a preview URL.',
	embedCodeUnavailable:
		'<!-- Save this scene before generating an embed snippet -->',
	sdkCodeUnavailable: '// Save this scene before generating an SDK snippet',
	openPreview: 'Open preview',
	tabHtml: 'HTML',
	tabSdk: 'SDK'
} as const

type EmbedSnippetOptions = {
	src: string
	width?: string
	height?: string
}

const DEFAULT_WIDTH = '100%'
const DEFAULT_HEIGHT = '400px'

/** External embed target. Token-authenticated, never renders internal chrome. */
export function buildEmbedPath(params: {
	projectId: string
	sceneId: string
}): string {
	return `/embed/${params.projectId}/${params.sceneId}`
}

/** Internal preview target. Session-authenticated, reachable from the dashboard. */
export function buildInternalPreviewPath(params: {
	projectId: string
	sceneId: string
}): string {
	return `/preview/${params.projectId}/${params.sceneId}`
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

export function buildSdkEmbedSnippet(options: EmbedSnippetOptions): string {
	const width = options.width?.trim() || DEFAULT_WIDTH
	const height = options.height?.trim() || DEFAULT_HEIGHT

	return `<!-- 1. Include the SDK (or: npm install @vctrl/embed) -->
<script src="${EMBED_SDK_CDN_URL}"></script>

<!-- 2. Your iframe -->
<div style="width: ${width}; max-width: 100%; height: ${height};">
  <iframe
    id="vectreal-scene"
    src="${options.src}"
    style="width: 100%; height: 100%; border: 0;"
    allow="autoplay; xr-spatial-tracking"
    allowfullscreen
  ></iframe>
</div>

<!-- 3. Control it -->
<script>
  // The UMD build exposes named exports on the global, so the class is
  // reached as VectrealEmbed.VectrealEmbed.
  const embed = new VectrealEmbed.VectrealEmbed(
    document.getElementById('vectreal-scene')
  )

  embed.ready().then(({ cameras }) => {
    console.log('Scene ready. Cameras:', cameras)
  })

  // Switch camera
  // embed.activateCamera('your-camera-id')

  // Listen to events
  embed.on('camera_changed', ({ cameraId }) => {
    console.log('Active camera:', cameraId)
  })
</script>`
}
