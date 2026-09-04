import type { VectrealViewerProps } from '@vctrl/viewer'

export type EmbedViewerTheme = NonNullable<VectrealViewerProps['theme']>

/**
 * The embed's default color scheme.
 *
 * `system` resolves against `prefers-color-scheme`, which inside an iframe is
 * the visitor's browser/OS setting rather than anything the host page's CSS
 * says. That is a proxy for the host, not the host itself - a site that forces
 * light against a dark OS still mismatches - which is why `?theme=` exists
 * beside it rather than instead of it.
 *
 * It is still the right default. The alternative in place until now was a
 * hardcoded `dark` on every embed, which mismatches every light host with no
 * way for that host to say so.
 */
const DEFAULT_EMBED_THEME: EmbedViewerTheme = 'system'

const THEMES: readonly EmbedViewerTheme[] = ['light', 'dark', 'system']

/**
 * Reads the embed URL's `theme` parameter, for a host that knows its own
 * scheme and wants to state it.
 *
 * Anything unrecognized falls back to the default rather than erroring: this
 * is a URL a third-party site wrote by hand, and a typo should leave the scene
 * rendering, not blank.
 */
export function parseEmbedViewerTheme(value: null | string): EmbedViewerTheme {
	const candidate = value?.trim().toLowerCase()

	return THEMES.find((theme) => theme === candidate) ?? DEFAULT_EMBED_THEME
}
