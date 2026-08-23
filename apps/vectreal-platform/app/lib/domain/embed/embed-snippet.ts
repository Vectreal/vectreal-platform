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
	tokenLabel: 'API key',
	tokenPlaceholder: 'vctrl_...',
	tokenHelp:
		'The snippet below carries this key. A key cannot be read back after it is created, so paste the one you saved or create a new key for this project.',
	tokenMissingNotice:
		'Add an API key to generate a snippet that works. Without one the embed answers "not found" on every site.',
	copyNeedsToken:
		'Add an API key first - a snippet without one answers "not found" on every site.',
	tokenReveal: 'Show key',
	tokenHide: 'Hide key',
	tokenMismatch:
		'This does not look like the selected key: the last four characters do not match.',
	keyPickerLabel: 'Key for this project',
	keyPickerPlaceholder: 'Which key are you using?',
	keyPickerEmpty: 'No API keys are scoped to this project yet.',
	keyPickerHint:
		'Picking a key here only labels the field below - the full value was shown once, when the key was created.',
	keyRevokedSuffix: 'revoked',
	keyExpiredSuffix: 'expired',
	createKey: 'Create a key for this project',
	createKeyShort: 'Create key',
	createKeyPending: 'Creating...',
	createKeyFailure: 'Could not create an API key.',
	/*
	  The show-once dialog's copy is deliberately not here. It moved to
	  `components/api-keys/one-time-key-dialog.tsx`, which is now the only such
	  dialog in the app: the dashboard opens it too, and it could not read its
	  words from a module that describes the embed snippet without the dashboard
	  taking a dependency on the embed domain. That was the reason two dialogs
	  existed.
	*/
	allowedDomainsLabel: 'Allowed domains',
	allowedDomainsEmpty:
		'This project allows no domains, so every third-party site is refused - even with a valid key. Add the site you are embedding on before you ship.',
	allowedDomainsHelp:
		'Only these sites may load the embed. Vectreal itself is always permitted, which is why the test button below cannot check this list for you.',
	editProject: 'Project settings',
	identifiersLabel: 'Identifiers',
	projectIdLabel: 'Project ID',
	sceneIdLabel: 'Scene ID',
	copyIdSuccess: 'Copied.',
	previewUrlLabel: 'Embed URL',
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
	copyUrlSuccess: 'Embed URL copied.',
	copyUrlFailure: 'Failed to copy embed URL.',
	clipboardUnavailable: 'Clipboard is not available in this browser.',
	missingSceneForEmbed: 'Save this scene first to generate an embed snippet.',
	missingSceneForUrl: 'Save this scene first to generate an embed URL.',
	embedCodeUnavailable:
		'<!-- Save this scene before generating an embed snippet -->',
	sdkCodeUnavailable: '// Save this scene before generating an SDK snippet',
	openPreview: 'Open preview',
	openPreviewHelp:
		'Opens the internal preview, which authenticates with your dashboard session. It always works for you, and so proves nothing about the embed.',
	testEmbedUrl: 'Test embed URL',
	testEmbedUrlHelp:
		'Opens the real embed URL carrying the key above. This checks the key and the published scene, but not the domain list: a request from this site is always permitted, so a visitor on your own site can still be refused. Needs a key.',
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

export function toAbsoluteEmbedUrl(path: string, origin: string): string {
	return new URL(path, origin).toString()
}

/**
 * The embed URL a visitor loads, token included.
 *
 * Built through `URLSearchParams` rather than string concatenation so the token
 * is percent-encoded. The panel used to emit a literal `YOUR_PREVIEW_API_KEY`
 * for the user to substitute by hand inside an HTML attribute, and the obvious
 * substitution - pasting a quoted key - closed the attribute early:
 *
 *     src="https://vectreal.com/embed/p/s?token="vctrl_abc"   style="..."
 *
 * The browser then requested `?token=`, and an empty token is a 404. Nothing
 * about that failure points at the quoting, which is why the placeholder is
 * gone and the real token is interpolated here instead.
 */
export function buildEmbedUrl(params: {
	origin: string
	projectId: string
	sceneId: string
	token?: string
}): string {
	const url = new URL(
		buildEmbedPath({ projectId: params.projectId, sceneId: params.sceneId }),
		params.origin
	)

	const token = params.token?.trim()
	if (token) {
		url.searchParams.set('token', token)
	}

	return url.toString()
}

/**
 * Escapes a value for interpolation into a quoted HTML attribute.
 *
 * `&` has to go first, or the escapes emitted below get double-escaped. Both
 * quote characters are covered so the result is safe in either quoting style
 * rather than only in the one the snippet builders happen to use today.
 *
 * A multi-parameter embed URL is the case that needs this: `URLSearchParams`
 * percent-encodes the values but joins them with a bare `&`, which is invalid
 * inside an attribute and silently truncates the URL in strict parsers.
 */
export function escapeHtmlAttributeValue(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

/**
 * Every value either builder interpolates, escaped.
 *
 * `width` and `height` are free text from the panel's own inputs and land in a
 * quoted `style` attribute, so a value ending in a quote breaks out of it
 * exactly the way the old `?token=` placeholder broke out of `src`. Escaping
 * rather than validating: the only caller is the panel, the only author is the
 * scene's owner, and the goal is a snippet that parses - not a policy about
 * which CSS lengths are allowed, which would silently discard `calc(...)`.
 */
function escapeSnippetValues(options: EmbedSnippetOptions): {
	width: string
	height: string
	src: string
} {
	return {
		width: escapeHtmlAttributeValue(options.width?.trim() || DEFAULT_WIDTH),
		height: escapeHtmlAttributeValue(options.height?.trim() || DEFAULT_HEIGHT),
		src: escapeHtmlAttributeValue(options.src)
	}
}

export function buildResponsiveEmbedSnippet(
	options: EmbedSnippetOptions
): string {
	const { width, height, src } = escapeSnippetValues(options)

	return `<div style="width: ${width}; max-width: 100%; height: ${height};">
  <iframe
    src="${src}"
    style="width: 100%; height: 100%; border: 0;"
    allow="autoplay; xr-spatial-tracking"
    allowfullscreen
  ></iframe>
</div>`
}

export function buildSdkEmbedSnippet(options: EmbedSnippetOptions): string {
	const { width, height, src } = escapeSnippetValues(options)

	return `<!-- 1. Include the SDK (or: npm install @vctrl/embed) -->
<script src="${EMBED_SDK_CDN_URL}"></script>

<!-- 2. Your iframe -->
<div style="width: ${width}; max-width: 100%; height: ${height};">
  <iframe
    id="vectreal-scene"
    src="${src}"
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
