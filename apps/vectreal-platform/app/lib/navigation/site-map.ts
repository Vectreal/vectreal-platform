import {
	HOME_PAGE_COPY,
	OPEN_SOURCE_PACKAGES,
	PLATFORM_TAGLINE
} from '../../constants/product-copy'
import { CONVERT_INDEX_PATH } from '../convert/convert-pairs'

/*
  The site's shape, once.

  The desktop nav, the phone drawer and the footer each used to write their own
  list of the site, and they drifted apart the way copies do: five links against
  five different columns, "Docs" in one and "Docs Home" in another, and the
  founding-client pilot, the home page's main action, in none of them. They all
  read this now, so a page is added, renamed or moved here and nowhere else.

  Pure data, with no React, so the specs that hold the three surfaces to it can
  import it without rendering anything.
*/

export interface SiteLink {
	label: string
	to: string
	/** One line under the label in the nav's panels. */
	description?: string
	/** Leaves the site: opened in a new tab. */
	external?: boolean
}

export interface SiteSection {
	label: string
	links: readonly SiteLink[]
}

const { repositoryUrl, discordUrl } = HOME_PAGE_COPY.openSource

const PUBLISHER: SiteLink = {
	label: 'Publisher',
	to: '/publisher',
	description: 'Optimize your own file and publish it. No account needed.'
}
const CONVERTERS: SiteLink = {
	label: 'Converters',
	to: CONVERT_INDEX_PATH,
	description: 'Convert between 3D formats in your browser. No account.'
}
const PILOT: SiteLink = {
	label: 'Founding-client pilot',
	to: '/contact?topic=pilot',
	description: 'We build your product viewer with you, on founding terms.'
}
const GITHUB: SiteLink = {
	label: 'GitHub',
	to: repositoryUrl,
	description: 'The platform and every package, under AGPL-3.0.',
	external: true
}
const DISCORD: SiteLink = {
	label: 'Discord',
	to: discordUrl,
	description: 'Ask the people who build it.',
	external: true
}
const CONTRIBUTING: SiteLink = {
	label: 'Contributing',
	to: '/docs/contributing',
	description: 'How to send your first pull request.'
}
const PRICING: SiteLink = { label: 'Pricing', to: '/pricing' }
const DOCS: SiteLink = { label: 'Docs', to: '/docs' }
const CONTACT: SiteLink = { label: 'Contact', to: '/contact' }

/** A package's docs, as a path on this site: the constant holds the public URL. */
const PACKAGES: SiteLink[] = OPEN_SOURCE_PACKAGES.map((pkg) => ({
	label: pkg.name,
	to: new URL(pkg.docs).pathname,
	description: pkg.description
}))

export const SITE_SECTIONS = {
	product: {
		label: 'Product',
		links: [PUBLISHER, CONVERTERS, PILOT]
	},
	openSource: {
		label: 'Open source',
		links: [...PACKAGES, GITHUB, DISCORD, CONTRIBUTING]
	},
	docs: {
		label: 'Docs',
		links: [
			DOCS,
			{ label: 'Getting started', to: '/docs/getting-started' },
			{ label: 'Guides', to: '/docs/guides/upload' }
		]
	},
	company: {
		label: 'Company',
		links: [
			PRICING,
			{ label: 'About', to: '/about' },
			{ label: 'Newsroom', to: '/news-room' },
			{ label: 'Changelog', to: '/changelog' },
			CONTACT
		]
	},
	legal: {
		label: 'Legal',
		links: [
			{ label: 'Privacy', to: '/privacy-policy' },
			{ label: 'Terms', to: '/terms-of-service' },
			{ label: 'Imprint', to: '/imprint' },
			{ label: 'Code of conduct', to: '/code-of-conduct' }
		]
	}
} as const satisfies Record<string, SiteSection>

/** The marketing nav: two panels, two plain links, and the two ways in. */
export const NAV = {
	panels: [SITE_SECTIONS.product, SITE_SECTIONS.openSource],
	links: [PRICING, DOCS],
	signIn: { label: 'Sign in', to: '/sign-in' },
	getStarted: { label: 'Get started', to: PUBLISHER.to }
} as const

/** A signed-in reader's own places: the account menu on a desktop, the top of the drawer on a phone. */
export const ACCOUNT: readonly SiteLink[] = [
	{ label: 'Dashboard', to: '/dashboard' },
	{ label: 'Projects', to: '/dashboard/projects' },
	{ label: 'Organizations', to: '/dashboard/organizations' },
	{ label: 'Settings', to: '/dashboard/settings' }
]

export const FOOTER = {
	tagline: PLATFORM_TAGLINE,
	sections: [
		SITE_SECTIONS.product,
		SITE_SECTIONS.openSource,
		SITE_SECTIONS.docs,
		SITE_SECTIONS.company,
		SITE_SECTIONS.legal
	]
} as const

/** Where the company is outside this site, for the footer's icon row. */
export const COMMUNITY = {
	github: repositoryUrl,
	discord: discordUrl,
	reddit: 'https://reddit.com/r/vectreal/',
	youtube: 'https://youtube.com/@vectreal/',
	x: 'https://x.com/vectreal'
} as const
