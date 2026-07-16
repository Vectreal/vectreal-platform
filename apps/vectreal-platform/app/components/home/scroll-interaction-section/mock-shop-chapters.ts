// Scene chapters for the home-page mock-shop scrollytell section, plus the pure
// helpers that map scroll progress onto chapters and the filmstrip transform.

export const DEMO_SCENE_URL =
	typeof import.meta !== 'undefined' &&
	(import.meta.env.VITE_PUBLIC_DEMO_SCENE_URL as string | undefined)
		? (import.meta.env.VITE_PUBLIC_DEMO_SCENE_URL as string)
		: `https://vectreal.com/preview/fullscreen/395a09f0-9340-42f2-ac98-03339cf27c9c/488bd4a1-46d3-4ee1-8497-25f68a5d6fa2?token=${import.meta.env.VITE_PUBLIC_VECTREAL_API_KEY_PROD}`

export const CHAPTERS = [
	{
		id: 'default',
		label: 'Shop View',
		heading: '911 GT3',
		description:
			'A real product listing powered by Vectreal. Customers scroll through camera presets to inspect every detail — no plugin required.',
		type: 'shop' as const,
		code: null
	},
	{
		id: 'side-view',
		label: 'Camera Presets',
		heading: 'Guided views,\nzero extra code.',
		description:
			'Define named camera positions in the Vectreal editor. Switch between them at runtime with one SDK call — smooth interpolation included.',
		type: 'feature' as const,
		code: "embed.activateCamera('drivetrain')"
	},
	{
		id: 'light-closeup',
		label: 'React SDK',
		heading: 'Drop in.\nConfigure from JSX.',
		description:
			'The Vectreal React component renders photorealistic 3D in any React or Next.js project. Lighting, materials, and controls — all as props.',
		type: 'feature' as const,
		code: '<VectrealViewer src={modelUrl} />'
	},
	{
		id: 'back-side',
		label: 'Embed',
		heading: 'One iframe.\nAny platform.',
		description:
			'Paste an <iframe> into Shopify, Webflow, or WordPress. Drive cameras and events via the Vectreal JS SDK — no framework needed.',
		type: 'feature' as const,
		code: '<iframe src="vectreal.com/preview/…" />'
	}
] as const

export type ChapterId = (typeof CHAPTERS)[number]['id']
export type Chapter = (typeof CHAPTERS)[number]

export const LAST_INDEX = CHAPTERS.length - 1

// ── The single source of truth ────────────────────────────────────────────
// `chapterPos` is a continuous float in [0, LAST_INDEX]: scroll progress mapped
// linearly so 0 = first chapter centered … LAST_INDEX = last chapter centered at
// the very end of the section (no dead scroll). Every visual (filmstrip glide,
// rail indicator, tab emphasis) is a pure function of this one value, so they
// can never drift apart. The camera — the only consumer that needs a definite
// step — reads Math.round(chapterPos) on settle.
export function chapterPosFromProgress(progress: number): number {
	return Math.max(0, Math.min(1, progress)) * LAST_INDEX
}

// Scroll progress at which a chapter is centered — the inverse of the above,
// used to scroll-to a chapter when its tab is clicked.
export function chapterProgressByIndex(index: number): number {
	return index / LAST_INDEX
}

export function chapterIndexById(id: ChapterId): number {
	return CHAPTERS.findIndex((c) => c.id === id)
}

// Clamp a raw (possibly fractional) position to a valid chapter id.
export function chapterIdByPos(pos: number): ChapterId {
	const i = Math.max(0, Math.min(LAST_INDEX, Math.round(pos)))
	return CHAPTERS[i].id
}

// translateY percentage the filmstrip stack ends at (last panel centered). Fed to
// an array-form scroll transform [0,1] → ['0%', STACK_END] so it stays on the
// compositor path instead of a per-frame JS callback.
export const STACK_END = `-${LAST_INDEX * 25}%`
// translateX percentage the rail indicator ends at (last of LAST_INDEX columns,
// each 100% of the indicator's own one-column width).
export const INDICATOR_END = `${LAST_INDEX * 100}%`

// Half-width (in scroll-progress units) of a chapter's fade-in/out band.
export const FADE_BAND = 0.72 / LAST_INDEX

// Keyframes for a chapter's emphasis (opacity) as a pure function of scroll
// progress, peaking at 1 when the chapter is centered and easing to `dim` on
// either side. Offsets are clamped to [0, 1] and kept monotonically increasing
// so framer-motion can run it as a compositor-accelerated scroll animation:
// the first chapter has no leading keyframe, the last holds lit to the end.
export function chapterFadeRange(
	index: number,
	dim: number
): { input: number[]; output: number[] } {
	const center = index / LAST_INDEX
	const input: number[] = []
	const output: number[] = []
	const lo = center - FADE_BAND
	if (lo > 0) {
		input.push(lo)
		output.push(dim)
	}
	input.push(center)
	output.push(1)
	const isLast = index === LAST_INDEX
	const hi = isLast ? 1 : center + FADE_BAND
	if (hi > center) {
		input.push(hi)
		output.push(isLast ? 1 : dim)
	}
	return { input, output }
}
