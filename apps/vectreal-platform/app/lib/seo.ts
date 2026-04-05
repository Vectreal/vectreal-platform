import type { loader } from '../root'
import type { MetaArgs, MetaDescriptor } from 'react-router'

/**
 * Canonical base URL for the Vectreal platform.
 * Used to build absolute canonical links and og:url tags.
 * Falls back to the production URL when no env var is set.
 */
export const SITE_URL =
	(typeof process !== 'undefined' && process.env?.APPLICATION_URL) ||
	'https://vectreal.com'

export interface BuildMetaOptions {
	/**
	 * When true, injects `noindex, nofollow` robots meta — use for all
	 * authenticated / private pages (dashboard, publisher, preview, etc.).
	 */
	private?: boolean
	/**
	 * Absolute or root-relative path for the canonical URL of this page.
	 * Generates both `<link rel="canonical">` and `og:url`.
	 * Example: `/pricing` or `https://vectreal.com/pricing`
	 */
	canonical?: string
}

/** Build an absolute canonical URL from a path or full URL. */
function toAbsoluteUrl(path: string): string {
	if (path.startsWith('http://') || path.startsWith('https://')) {
		return path
	}

	return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Merges base SEO meta with any route-specific overrides.
 *
 * Precedence (lowest → highest): rootMeta → baseMeta → overrides
 *
 * Options:
 *  - `private`: adds `noindex, nofollow` robots meta.
 *  - `canonical`: emits `<link rel="canonical">` + `og:url`.
 */
export function buildMeta(
	overrides: MetaDescriptor[] = [],
	rootMeta?: MetaDescriptor[],
	options: BuildMetaOptions = {}
): NonNullable<MetaDescriptor>[] {
	const baseMeta: MetaDescriptor[] = [
		{
			title: 'Vectreal - Your platform for creating and sharing 3D scenes.'
		},
		{
			property: 'og:title',
			content: 'Vectreal - Your platform for creating and sharing 3D scenes.'
		},
		{
			name: 'description',
			content:
				'Vectreal is your go-to platform for creating, sharing, and exploring stunning 3D scenes. Join our community of creators and bring your virtual visions to life!'
		},
		{
			property: 'og:description',
			content:
				'Vectreal is your go-to platform for creating, sharing, and exploring stunning 3D scenes. Join our community of creators and bring your virtual visions to life!'
		},
		{
			name: 'keywords',
			content:
				'3D, scenes, platform, Vectreal, create, share, virtual reality, graphics, design'
		}
	]

	// Create a map to ensure unique meta entries based on their property/name
	// with correct precedence (later entries override earlier ones)
	const metaMap = new Map<string, MetaDescriptor>()

	// Helper function to generate a consistent key for each meta descriptor
	const getMetaKey = (meta: MetaDescriptor): string => {
		// tagName: 'link' is React Router v7's official MetaDescriptor variant for
		// emitting <link> elements (e.g. canonical) from the meta() export.
		if ('tagName' in meta && meta.tagName === 'link') {
			return `link:${(meta as { rel?: string }).rel ?? 'unknown'}`
		}
		if ('property' in meta) return `property:${meta.property}`
		if ('name' in meta) return `name:${meta.name}`
		if ('title' in meta) return 'title'
		return `raw:${JSON.stringify(meta)}`
	}

	// Process meta arrays in order of increasing precedence
	const metaSources: MetaDescriptor[][] = [rootMeta ?? [], baseMeta, overrides]

	// Add each source's meta tags to the map, allowing overrides
	for (const source of metaSources) {
		source.filter(Boolean).forEach((meta) => {
			metaMap.set(getMetaKey(meta), meta)
		})
	}

	// Convert map values back to array
	const metaItems = Array.from(metaMap.values())

	if (options.canonical) {
		const absoluteCanonical = toAbsoluteUrl(options.canonical)
		// <link rel="canonical"> — the primary crawlability signal
		metaItems.push({
			tagName: 'link',
			rel: 'canonical',
			href: absoluteCanonical
		})
		// og:url — aligns the Open Graph URL with the canonical
		metaItems.push({
			property: 'og:url',
			content: absoluteCanonical
		})
	}

	if (options.private) {
		// Privatize the page: prevent indexing by search engines.
		metaItems.push({
			name: 'robots',
			content: 'noindex, nofollow'
		})
	}

	return metaItems.filter(
		(item): item is NonNullable<MetaDescriptor> =>
			item !== null && item !== undefined
	)
}

type MetaArgsWithLoader = MetaArgs<
	undefined,
	{
		root: typeof loader
	}
>

export function getRootMeta({ matches }: MetaArgsWithLoader) {
	return (
		matches
			.find((match) => match.id === 'root')
			?.meta?.filter(
				(meta) => meta && 'property' in meta && meta.property === 'og:image'
			) ?? []
	)
}
