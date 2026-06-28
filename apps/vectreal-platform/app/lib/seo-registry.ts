import { SITE_URL, type SeoPageDefinition } from './seo'
import {
	PLAN_OFFER_DESCRIPTIONS,
	PLATFORM_FEATURE_LIST,
	PLATFORM_SOCIAL_DESCRIPTION,
	PLATFORM_TAGLINE
} from '../constants/product-copy'

interface NewsArticleStructuredDataInput {
	title: string
	description: string
	canonicalPath: string
	publishedAt: string
	updatedAt?: string
	image?: string
	authorName: string
	authorRole?: string
	authorXUrl?: string
	authorLinkedinUrl?: string
}

export interface BreadcrumbItem {
	name: string
	item?: string
}

export const PUBLIC_SEO_PAGES = {
	home: {
		title: 'Vectreal - Your platform for creating and sharing 3D scenes.',
		description: PLATFORM_SOCIAL_DESCRIPTION,
		canonical: '/'
	},
	pricing: {
		title: 'Pricing - Vectreal',
		description:
			'Simple, transparent pricing for every team. From hobbyists to enterprise studios - find the plan that fits your 3D publishing workflow.',
		canonical: '/pricing'
	},
	newsroom: {
		title: 'News Room - Vectreal',
		description: 'News and product notes from the Vectreal team.',
		canonical: '/news-room'
	},
	docs: {
		title: 'Docs - Vectreal Platform',
		description:
			'Everything you need to build with the Vectreal Platform and its open-source packages.',
		canonical: '/docs'
	}
} satisfies Record<string, SeoPageDefinition>

export const LEGAL_PAGE_SEO_BY_PATH: Record<string, SeoPageDefinition> = {
	'/about': {
		title: 'About - Vectreal',
		description:
			'Learn about Vectreal, our mission, and how we are building open 3D publishing infrastructure for the web.',
		canonical: '/about'
	},
	'/changelog': {
		title: 'Changelog - Vectreal',
		description:
			'Product updates, shipped improvements, and release notes from the Vectreal team.',
		canonical: '/changelog'
	},
	'/contact': {
		title: 'Contact - Vectreal',
		description:
			'Contact the Vectreal team for support, enterprise inquiries, or partnerships.',
		canonical: '/contact'
	},
	'/code-of-conduct': {
		title: 'Code of Conduct - Vectreal',
		description:
			'Community standards and participation guidelines for contributors and members of the Vectreal ecosystem.',
		canonical: '/code-of-conduct'
	},
	'/privacy-policy': {
		title: 'Privacy Policy - Vectreal',
		description:
			'How Vectreal collects, uses, protects, and manages your data and privacy preferences.',
		canonical: '/privacy-policy'
	},
	'/terms-of-service': {
		title: 'Terms of Service - Vectreal',
		description:
			'Terms governing access to and use of the Vectreal platform, products, and services.',
		canonical: '/terms-of-service'
	},
	'/imprint': {
		title: 'Imprint - Vectreal',
		description: 'Legal publishing and company information for Vectreal.',
		canonical: '/imprint'
	}
}

export function getLegalPageSeo(
	pathname: string
): SeoPageDefinition | undefined {
	return LEGAL_PAGE_SEO_BY_PATH[pathname]
}

export function buildDocsPageSeo(args: {
	pathname: string
	title: string
	description?: string
}): SeoPageDefinition {
	return {
		title: `${args.title} - Vectreal Docs`,
		description: args.description ?? PUBLIC_SEO_PAGES.docs.description,
		canonical: args.pathname
	}
}

export function buildOrganizationJsonLd() {
	return {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		'@id': `${SITE_URL}/#organization`,
		name: 'Vectreal',
		url: SITE_URL,
		logo: {
			'@type': 'ImageObject',
			url: `${SITE_URL}/android-chrome-512x512.png`,
			width: 512,
			height: 512
		},
		description: PLATFORM_TAGLINE,
		sameAs: ['https://github.com/vectreal', 'https://x.com/vectreal'],
		contactPoint: {
			'@type': 'ContactPoint',
			email: 'info@vectreal.com',
			contactType: 'customer support'
		}
	}
}

export function buildWebSiteJsonLd() {
	return {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		'@id': `${SITE_URL}/#website`,
		url: SITE_URL,
		name: 'Vectreal',
		description: PLATFORM_TAGLINE,
		inLanguage: 'en-US',
		publisher: { '@id': `${SITE_URL}/#organization` }
	}
}

export function buildWebApplicationJsonLd() {
	return {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		'@id': `${SITE_URL}/#webapp`,
		name: 'Vectreal Platform',
		url: SITE_URL,
		applicationCategory: 'BusinessApplication',
		operatingSystem: 'Web',
		featureList: [...PLATFORM_FEATURE_LIST],
		offers: Object.entries(PLAN_OFFER_DESCRIPTIONS).map(
			([name, description]) => ({
				'@type': 'Offer',
				name: name.charAt(0).toUpperCase() + name.slice(1),
				description,
				...(name === 'free' ? { price: '0', priceCurrency: 'USD' } : {})
			})
		),
		publisher: { '@id': `${SITE_URL}/#organization` }
	}
}

function nameToSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
}

export function buildAuthorPersonJsonLd(author: {
	name: string
	role?: string
	xUrl?: string
	linkedinUrl?: string
}) {
	const sameAs = [author.xUrl, author.linkedinUrl].filter(Boolean) as string[]
	return {
		'@context': 'https://schema.org',
		'@type': 'Person',
		'@id': `${SITE_URL}/#author-${nameToSlug(author.name)}`,
		name: author.name,
		...(author.role ? { jobTitle: author.role } : {}),
		affiliation: { '@id': `${SITE_URL}/#organization` },
		...(sameAs.length > 0 ? { sameAs } : {})
	}
}

export function buildBreadcrumbListJsonLd(items: BreadcrumbItem[]) {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((crumb, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: crumb.name,
			...(crumb.item ? { item: crumb.item } : {})
		}))
	}
}

export function buildCollectionPageJsonLd(args: {
	name: string
	url: string
	description: string
}) {
	return {
		'@context': 'https://schema.org',
		'@type': 'CollectionPage',
		'@id': `${args.url}#collectionpage`,
		name: args.name,
		url: args.url,
		description: args.description,
		publisher: { '@id': `${SITE_URL}/#organization` }
	}
}

export function buildNewsArticleJsonLd(
	article: NewsArticleStructuredDataInput
) {
	const canonicalUrl = `${SITE_URL}${article.canonicalPath}`
	const authorId = `${SITE_URL}/#author-${nameToSlug(article.authorName)}`

	return {
		'@context': 'https://schema.org',
		'@type': 'Article',
		'@id': `${canonicalUrl}#article`,
		headline: article.title,
		description: article.description,
		datePublished: article.publishedAt,
		dateModified: article.updatedAt ?? article.publishedAt,
		author: { '@id': authorId },
		publisher: { '@id': `${SITE_URL}/#organization` },
		mainEntityOfPage: {
			'@type': 'WebPage',
			'@id': canonicalUrl
		},
		...(article.image ? { image: article.image } : {})
	}
}
