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

const DEFAULT_SITE_NAME = 'Vectreal'
const DEFAULT_TITLE =
	'Vectreal - Your platform for creating and sharing 3D scenes.'
const DEFAULT_DESCRIPTION =
	'Vectreal is your go-to platform for creating, sharing, and exploring stunning 3D scenes. Join our community of creators and bring your virtual visions to life!'
const DEFAULT_KEYWORDS =
	'3D, scenes, platform, Vectreal, create, share, virtual reality, graphics, design'
const DEFAULT_OG_IMAGE = '/android-chrome-512x512.png'
const DEFAULT_OG_IMAGE_ALT = 'Vectreal platform'
const DEFAULT_LOCALE = 'en_US'
const DEFAULT_TWITTER_CARD = 'summary_large_image'

type JsonLd = Record<string, unknown>

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
	/** Open Graph + Twitter image URL (absolute or root-relative). */
	image?: string
	/** Accessible alt text for social cards. */
	imageAlt?: string
	/** Open Graph content type, defaults to website. */
	type?: 'website' | 'article'
	/** Twitter card type, defaults to summary_large_image. */
	twitterCard?: 'summary' | 'summary_large_image'
	/** Locale for Open Graph tags. */
	locale?: string
	/** Site name in social metadata. */
	siteName?: string
	/** Optional JSON-LD payload(s) rendered as script tags. */
	structuredData?: JsonLd | JsonLd[]
}

export interface SeoPageDefinition {
	title: string
	description: string
	canonical: string
	image?: string
	imageAlt?: string
	type?: 'website' | 'article'
	structuredData?: JsonLd | JsonLd[]
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
	const siteName = options.siteName ?? DEFAULT_SITE_NAME
	const locale = options.locale ?? DEFAULT_LOCALE
	const ogType = options.type ?? 'website'
	const twitterCard = options.twitterCard ?? DEFAULT_TWITTER_CARD
	const socialImage = toAbsoluteUrl(options.image ?? DEFAULT_OG_IMAGE)
	const socialImageAlt = options.imageAlt ?? DEFAULT_OG_IMAGE_ALT

	const baseMeta: MetaDescriptor[] = [
		{
			title: DEFAULT_TITLE
		},
		{
			property: 'og:title',
			content: DEFAULT_TITLE
		},
		{
			name: 'description',
			content: DEFAULT_DESCRIPTION
		},
		{
			property: 'og:description',
			content: DEFAULT_DESCRIPTION
		},
		{
			property: 'og:site_name',
			content: siteName
		},
		{
			property: 'og:type',
			content: ogType
		},
		{
			property: 'og:locale',
			content: locale
		},
		{
			property: 'og:image',
			content: socialImage
		},
		{
			property: 'og:image:alt',
			content: socialImageAlt
		},
		{
			name: 'twitter:card',
			content: twitterCard
		},
		{
			name: 'twitter:title',
			content: DEFAULT_TITLE
		},
		{
			name: 'twitter:description',
			content: DEFAULT_DESCRIPTION
		},
		{
			name: 'twitter:image',
			content: socialImage
		},
		{
			name: 'twitter:image:alt',
			content: socialImageAlt
		},
		{
			name: 'keywords',
			content: DEFAULT_KEYWORDS
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
		if ('script:ld+json' in meta) return 'script:ld+json'
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

	if (options.structuredData) {
		const structuredDataItems = Array.isArray(options.structuredData)
			? options.structuredData
			: [options.structuredData]

		for (const item of structuredDataItems) {
			metaItems.push({
				'script:ld+json': item
			})
		}
	}

	return metaItems.filter(
		(item): item is NonNullable<MetaDescriptor> =>
			item !== null && item !== undefined
	)
}

export function buildRootMeta(): MetaDescriptor[] {
	return buildMeta([], undefined, { canonical: SITE_URL })
}

export function buildPageMeta(
	page: SeoPageDefinition,
	rootMeta?: MetaDescriptor[],
	options: Omit<
		BuildMetaOptions,
		'canonical' | 'image' | 'imageAlt' | 'type'
	> = {}
): NonNullable<MetaDescriptor>[] {
	return buildMeta(
		[
			{ title: page.title },
			{ property: 'og:title', content: page.title },
			{ name: 'description', content: page.description },
			{ property: 'og:description', content: page.description },
			{ name: 'twitter:title', content: page.title },
			{ name: 'twitter:description', content: page.description }
		],
		rootMeta,
		{
			...options,
			canonical: page.canonical,
			image: page.image,
			imageAlt: page.imageAlt,
			type: page.type,
			structuredData: page.structuredData
		}
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
