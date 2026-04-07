import { SITE_URL, type SeoPageDefinition } from './seo'

interface NewsArticleStructuredDataInput {
	title: string
	description: string
	canonicalPath: string
	publishedAt: string
	updatedAt?: string
	image?: string
	authorName: string
}

export const PUBLIC_SEO_PAGES = {
	home: {
		title: 'Vectreal - Your platform for creating and sharing 3D scenes.',
		description:
			'Vectreal is your go-to platform for creating, sharing, and exploring stunning 3D scenes. Upload, optimize, and publish 3D content in seconds.',
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
		name: 'Vectreal',
		url: SITE_URL,
		logo: `${SITE_URL}/android-chrome-512x512.png`,
		description: PUBLIC_SEO_PAGES.home.description
	}
}

export function buildNewsArticleJsonLd(
	article: NewsArticleStructuredDataInput
) {
	const canonicalUrl = `${SITE_URL}${article.canonicalPath}`

	return {
		'@context': 'https://schema.org',
		'@type': 'Article',
		headline: article.title,
		description: article.description,
		datePublished: article.publishedAt,
		dateModified: article.updatedAt ?? article.publishedAt,
		author: {
			'@type': 'Person',
			name: article.authorName
		},
		publisher: {
			'@type': 'Organization',
			name: 'Vectreal',
			logo: {
				'@type': 'ImageObject',
				url: `${SITE_URL}/android-chrome-512x512.png`
			}
		},
		mainEntityOfPage: {
			'@type': 'WebPage',
			'@id': canonicalUrl
		},
		...(article.image ? { image: article.image } : {})
	}
}
