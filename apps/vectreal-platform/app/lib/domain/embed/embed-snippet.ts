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

/**
 * The embedding guide, which is where the detail this panel used to inline
 * lives now.
 *
 * A path rather than a literal at the call site, so `embed-snippet.spec.ts` can
 * check it against `docsPages` - a link into the docs that no longer resolves is
 * invisible from the panel it is rendered in.
 */
export const EMBED_DOCS_PATH = '/docs/guides/publish-embed'

/*
  A working panel explains itself; this module is what is left when it cannot.

  The panel used to declare 757 characters of prose and render 415 of them with
  nothing wrong, because it was built around pasting a key: two hint lines
  saying which of two controls filled the field, a notice for the empty field, a
  warning for a mismatched one, and a caption under every group. The key is
  selected now, so the happy path renders none of these - every string below is
  conditional on a state the user needs told about.

  `embed-snippet.spec.ts` caps each one at 80 characters, with a named
  exemption map for the notices that are read once in place. It caps every
  string rather than the ones whose names end in `Help`: a cap a rename can
  escape is not a cap.
*/
export const EMBED_COPY = {
	unavailableUntilSaved:
		'Embedding is unavailable until this scene is saved and linked to a project.',
	accessTitle: 'Access',
	keyLabel: 'API key',
	keyPickerPlaceholder: 'Select a key',
	/*
	  Said once, above the picker, rather than once per row. Reaching this state
	  means every row is suffixed with the reason it cannot be used, so repeating
	  those reasons in a sentence adds nothing the list is not already showing.
	*/
	keyNoneUsable: 'No key here can build a snippet yet.',
	keyRevokedSuffix: 'revoked',
	keyExpiredSuffix: 'expired',
	/*
	  Not "rotate to fix". Rotation is refused for a revoked or expired key -
	  `rotateApiKey` throws unless the key is active - so this suffix belongs to
	  the third case only: a live key whose stored value cannot be read back.
	*/
	keyRotateSuffix: 'rotate to use',
	createKey: 'Create a key',
	createKeyPending: 'Creating...',
	/*
	  The whole message, not a prefix on the server's.

	  This briefly rendered `createError` alone, on the reasoning that the route
	  already returns a sentence. It does not: that string is only the fallback
	  for a non-`Error` throw, and every realistic failure is an `Error`, so
	  `error.message` went straight to the user - "database is down" from the
	  route's own spec, or the name of an organization they cannot see.
	*/
	createKeyFailure: 'Could not create an API key. Try again in a moment.',
	retry: 'Try again',
	retryPending: 'Trying...',
	allowedDomainsLabel: 'Allowed domains',
	allowedDomainsEmpty:
		'This project allows no domains, so every third-party site is refused - even with a valid key. Add the site you are embedding on before you ship.',
	editProject: 'Project settings',
	docsLink: 'Embedding guide',
	embedCodeLabel: 'Embed Code',
	copyHtml: 'Copy HTML',
	copySdk: 'Copy SDK',
	copyUrl: 'Copy URL',
	copyOptions: 'Copy options',
	copied: 'Copied',
	copyHtmlSuccess: 'HTML snippet copied.',
	copyHtmlFailure: 'Failed to copy the HTML snippet.',
	copySdkSuccess: 'SDK snippet copied.',
	copySdkFailure: 'Failed to copy SDK snippet.',
	copyUrlSuccess: 'Embed URL copied.',
	copyUrlFailure: 'Failed to copy embed URL.',
	clipboardUnavailable: 'Clipboard is not available in this browser.',
	testEmbedUrl: 'Test embed URL',
	tabHtml: 'HTML',
	tabSdk: 'SDK',
	tabUrl: 'URL'
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
 * `width` and `height` are builder options that default to the box below; the
 * panel no longer offers fields for them, because the values are visible and
 * editable in the snippet it hands over. They still land in a quoted `style`
 * attribute, so a value ending in a quote breaks out of it exactly the way the
 * old `?token=` placeholder broke out of `src`, and any caller that passes one
 * gets the same escaping. Escaping rather than validating: the goal is a
 * snippet that parses, not a policy about which CSS lengths are allowed, which
 * would silently discard `calc(...)`.
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
