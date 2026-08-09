/**
 * Scene colors, aligned to the brand tokens.
 *
 * `accent` is the brand orange (--orange, #FC6C18), used as a sparse contour
 * highlight rather than a fill. `line` is a cool near-white hairline.
 */
export const PALETTE = {
	background: '#08080a',
	line: '206, 216, 228',
	accent: '252, 108, 24',
	lineAlpha: 0.5,
	accentAlpha: 0.95
} as const

/**
 * Surface colors for UI drawn directly on top of a scene.
 *
 * These deliberately do NOT follow the theme. The scene is near-white hairlines
 * on near-black, so it is unreadable on a light surface; anything sitting over
 * it has to stay dark regardless of the user's theme. Pinning them here also
 * keeps the article hero identical to the baked og:image, which has no theme at
 * all.
 *
 * Applied as inline styles rather than Tailwind arbitrary values so the
 * design-token lint rule stays meaningful for genuinely themed UI.
 */
export const SCENE_SURFACE = {
	background: PALETTE.background,
	border: 'rgba(255, 255, 255, 0.1)',
	text: '#f2f3f5',
	/** Body copy over a scene: lighter than muted so it stays readable on the scrim. */
	excerptText: '#a8adb4',
	mutedText: '#8b8f96',
	faintText: '#55595f'
} as const
