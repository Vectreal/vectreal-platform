import {
	PLATFORM_SOCIAL_DESCRIPTION,
	SUPPORTED_FORMAT_NAMES
} from '../constants/product-copy'

import type { loader } from '../root'
import type { MetaArgs, MetaDescriptor } from 'react-router'

/**
 * Canonical base URL for the Vectreal platform.
 * Used to build absolute canonical links and og:url tags.
 * Falls back to the production URL when no env var is set.
 */
export const SITE_URL =
	import.meta.env.VITE_PUBLIC_SITE_URL ||
	import.meta.env.VITE_APPLICATION_URL ||
	'https://vectreal.com'

const DEFAULT_SITE_NAME = 'Vectreal'
const DEFAULT_TITLE =
	'Vectreal - Your platform for creating and sharing 3D scenes.'
const DEFAULT_DESCRIPTION = PLATFORM_SOCIAL_DESCRIPTION
const DEFAULT_KEYWORDS = `3D, scenes, platform, Vectreal, create, share, ${SUPPORTED_FORMAT_NAMES.join(', ')}, 3D model optimization, embeddable 3D viewer`
// TODO: replace with a 1200x630 PNG at public/assets/images/og-default.png for summary_large_image cards.
// Until then the 512x512 icon is used, which requires DEFAULT_TWITTER_CARD = 'summary'.
const DEFAULT_OG_IMAGE = '/android-chrome-512x512.png'
const DEFAULT_OG_IMAGE_ALT = 'Vectreal platform'
const DEFAULT_LOCALE = 'en_US'
// 'summary' matches the square 512x512 fallback icon. Switch to 'summary_large_image' once DEFAULT_OG_IMAGE is 1200x630.
const DEFAULT_TWITTER_CARD = 'summary'

type JsonLd = Record<string, unknown>

export interface BuildMetaOptions {
	/**
	 * When true, injects `noindex, nofollow` robots meta - use for all
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
	/** ISO 8601 publish date - emits article:published_time when type is article. */
	publishedTime?: string
	/** ISO 8601 modification date - emits article:modified_time when type is article. */
	modifiedTime?: string
	/** Author name - emits article:author when type is article. */
	articleAuthor?: string
	/** Content category - emits article:section when type is article. */
	articleSection?: string
}

export interface SeoPageDefinition {
	title: string
	description: string
	canonical: string
	image?: string
	imageAlt?: string
	type?: 'website' | 'article'
	structuredData?: JsonLd | JsonLd[]
	publishedTime?: string
	modifiedTime?: string
	articleAuthor?: string
	articleSection?: string
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
			name: 'robots',
			content:
				'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'
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
			property: 'og:image:width',
			content: '1200'
		},
		{
			property: 'og:image:height',
			content: '630'
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

	// Private pages override the default index/follow robots directive.
	if (options.private) {
		metaMap.set('name:robots', {
			name: 'robots',
			content: 'noindex, nofollow'
		})
	}

	// Convert map values back to array
	const metaItems = Array.from(metaMap.values())

	if (options.canonical) {
		const absoluteCanonical = toAbsoluteUrl(options.canonical)
		// <link rel="canonical"> - the primary crawlability signal
		metaItems.push({
			tagName: 'link',
			rel: 'canonical',
			href: absoluteCanonical
		})
		// og:url - aligns the Open Graph URL with the canonical
		metaItems.push({
			property: 'og:url',
			content: absoluteCanonical
		})
	}

	if (ogType === 'article') {
		if (options.publishedTime) {
			metaItems.push({
				property: 'article:published_time',
				content: options.publishedTime
			})
		}
		if (options.modifiedTime) {
			metaItems.push({
				property: 'article:modified_time',
				content: options.modifiedTime
			})
		}
		if (options.articleAuthor) {
			metaItems.push({
				property: 'article:author',
				content: options.articleAuthor
			})
		}
		if (options.articleSection) {
			metaItems.push({
				property: 'article:section',
				content: options.articleSection
			})
		}
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
		| 'canonical'
		| 'image'
		| 'imageAlt'
		| 'type'
		| 'publishedTime'
		| 'modifiedTime'
		| 'articleAuthor'
		| 'articleSection'
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
			structuredData: page.structuredData,
			publishedTime: page.publishedTime,
			modifiedTime: page.modifiedTime,
			articleAuthor: page.articleAuthor,
			articleSection: page.articleSection
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
