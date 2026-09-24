/**
 * Vectreal Platform - Docs Manifest
 *
 * Maps every docs page slug to its source file path, metadata, and version.
 * Used by the docs layout to:
 *  - Render the sidebar navigation
 *  - Generate "Edit on GitHub" links pointing to the exact source file
 *  - Resolve canonical URLs for SEO
 *
 * VERSIONING
 * ----------
 * Each entry carries a `version` field.  The current live version is always
 * "latest".  When a new major version ships, create a versioned copy of the
 * relevant entries (e.g. version: "v2") and update the affected pages' slugs
 * to include the version prefix (e.g. "v2/self-hosting/installation").
 */

export const GITHUB_REPO = 'https://github.com/Vectreal/vectreal-platform'

export const GITHUB_DEFAULT_BRANCH = 'main'

/** Generates the full "Edit on GitHub" URL for a source file. */
export function editOnGithubUrl(sourcePath: string): string {
	return `${GITHUB_REPO}/blob/${GITHUB_DEFAULT_BRANCH}/${sourcePath}`
}

/** Top-level groupings shown in the sidebar. */
export type DocCategory =
	'getting-started' | 'guides' | 'packages' | 'self-hosting' | 'contributing'

export interface DocPage {
	/**
	 * URL segment after /docs (e.g. "self-hosting/installation"), never empty.
	 * The /docs landing page is not a manifest entry: it renders outside the docs
	 * layout, so it has no sidebar, no Edit on GitHub link and no prev/next.
	 */
	slug: string
	/** Human-readable title used in the sidebar and <title>. */
	title: string
	/** Short description used in og:description and search previews. */
	description?: string
	/**
	 * Relative path from the repo root to the MDX/MD source file.
	 * Used to construct the Edit on GitHub URL.
	 */
	sourcePath: string
	/** Sidebar grouping. */
	category: DocCategory
	/** Sidebar sort order within the category. */
	order: number
	/**
	 * Docs version.
	 * "latest" = the current production version (default).
	 * Explicit semver string (e.g. "v1") for archived historical versions.
	 */
	version: string
}

export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
	'getting-started': 'Getting Started',
	guides: 'Guides',
	packages: 'Packages and SDK',
	'self-hosting': 'Run It Yourself',
	contributing: 'Contributing'
}

export type DocAudienceId = 'browser' | 'code'

/**
 * The two readers the docs are for, and the categories each one reads.
 *
 * The categories used to be one reading path, and it began with contributor
 * setup: the docs' own "Start here", the sidebar and the footer's "Getting
 * started" all sent someone who only wanted to try the publisher to cloning
 * the repo and starting Supabase. Grouping by what the reader wants to do
 * rather than who they are: a shop owner fitting a viewer is neither an artist
 * nor a developer, but knows whether they are working in the browser or in
 * their own code.
 *
 * Every category sits in exactly one audience; `docs-manifest.spec.ts` holds
 * that, so a new category that no reader would find fails the build.
 */
export const DOC_AUDIENCES: readonly {
	id: DocAudienceId
	label: string
	description: string
	categories: readonly DocCategory[]
}[] = [
	{
		id: 'browser',
		label: 'In the browser',
		description:
			'No install and no account. Start from a sample or your own file.',
		categories: ['getting-started', 'guides']
	},
	{
		id: 'code',
		label: 'In your code',
		description:
			'Packages on npm, the embed SDK, and running Vectreal yourself.',
		categories: ['packages', 'self-hosting', 'contributing']
	}
]

/** Ordered list of categories as they appear in the sidebar: the browser's first, then the code's. */
export const DOC_CATEGORY_ORDER: DocCategory[] = DOC_AUDIENCES.flatMap(
	(audience) => audience.categories
)

export const docsPages: DocPage[] = [
	// ──────────────────────────────────────────────────────────────────────────
	// Getting Started
	// ──────────────────────────────────────────────────────────────────────────
	{
		slug: 'getting-started',
		title: 'Your First Model',
		description:
			'Upload, optimize, and publish a 3D model in under two minutes using the Publisher.',
		sourcePath:
			'apps/vectreal-platform/app/routes/docs/getting-started/index.mdx',
		category: 'getting-started',
		order: 0,
		version: 'latest'
	},

	// ──────────────────────────────────────────────────────────────────────────
	// Guides
	// ──────────────────────────────────────────────────────────────────────────
	{
		slug: 'guides/upload',
		title: 'Uploading Models',
		description:
			'Supported file formats, drag-and-drop behavior, and multi-file glTF bundles.',
		sourcePath: 'apps/vectreal-platform/app/routes/docs/guides/upload.mdx',
		category: 'guides',
		order: 0,
		version: 'latest'
	},
	{
		slug: 'guides/convert',
		title: 'Converting Between Formats',
		description:
			'Which format pairs have a page, why some targets cannot exist, and what a bundle needs.',
		sourcePath: 'apps/vectreal-platform/app/routes/docs/guides/convert.mdx',
		category: 'guides',
		order: 1,
		version: 'latest'
	},
	{
		slug: 'guides/optimize',
		title: 'Optimizing & Configuring',
		description:
			'Quality presets, texture compression, mesh simplification, lighting, and camera settings.',
		sourcePath: 'apps/vectreal-platform/app/routes/docs/guides/optimize.mdx',
		category: 'guides',
		order: 2,
		version: 'latest'
	},
	{
		slug: 'guides/publish-embed',
		title: 'Publishing & Embedding',
		description:
			'Publish a scene, generate an embed snippet, configure preview API keys, and restrict allowed domains.',
		sourcePath:
			'apps/vectreal-platform/app/routes/docs/guides/publish-embed.mdx',
		category: 'guides',
		order: 3,
		version: 'latest'
	},
	{
		slug: 'guides/embed-sdk',
		title: 'Embed SDK',
		description:
			'Control embedded 3D scenes from your page: camera switching, scroll interactions, event callbacks, and the raw postMessage protocol.',
		sourcePath: 'apps/vectreal-platform/app/routes/docs/guides/embed-sdk.mdx',
		// A code page at a guides URL: the URL predates the audiences, and moving it would break links for no reader's gain.
		category: 'packages',
		order: 0,
		version: 'latest'
	},

	// ──────────────────────────────────────────────────────────────────────────
	// Package Reference
	// ──────────────────────────────────────────────────────────────────────────
	{
		slug: 'packages/embed',
		title: '@vctrl/embed',
		description:
			'Framework-agnostic JavaScript SDK for controlling Vectreal embedded previews from any web page.',
		sourcePath: 'apps/vectreal-platform/app/routes/docs/packages/embed.mdx',
		category: 'packages',
		order: 1,
		version: 'latest'
	},
	{
		slug: 'packages/viewer',
		title: '@vctrl/viewer',
		description:
			'React component for rendering and interacting with 3D models in the browser.',
		sourcePath: 'apps/vectreal-platform/app/routes/docs/packages/viewer.mdx',
		category: 'packages',
		order: 2,
		version: 'latest'
	},
	{
		slug: 'packages/hooks',
		title: '@vctrl/hooks',
		description:
			'React hooks for loading, optimizing, and exporting 3D models in the browser.',
		sourcePath: 'apps/vectreal-platform/app/routes/docs/packages/hooks.mdx',
		category: 'packages',
		order: 3,
		version: 'latest'
	},
	{
		slug: 'packages/core',
		title: '@vctrl/core',
		description:
			'Isomorphic 3D model processing: loader, optimizer and exporter, for Node.js and the browser.',
		sourcePath: 'apps/vectreal-platform/app/routes/docs/packages/core.mdx',
		category: 'packages',
		order: 4,
		version: 'latest'
	},

	// ──────────────────────────────────────────────────────────────────────────
	// Run It Yourself
	// ──────────────────────────────────────────────────────────────────────────
	{
		slug: 'self-hosting',
		title: 'Run It Yourself',
		description:
			'Overview of the monorepo and how to run the platform locally.',
		sourcePath: 'apps/vectreal-platform/app/routes/docs/self-hosting/index.mdx',
		category: 'self-hosting',
		order: 0,
		version: 'latest'
	},
	{
		slug: 'self-hosting/installation',
		title: 'Installation',
		description:
			'Clone the repo, install dependencies, configure environment variables, and spin up the local dev stack.',
		sourcePath:
			'apps/vectreal-platform/app/routes/docs/self-hosting/installation.mdx',
		category: 'self-hosting',
		order: 1,
		version: 'latest'
	},
	{
		slug: 'self-hosting/deployment',
		title: 'Deployment',
		description:
			'Fly.io deployment with Cloudflare edge configuration and GitHub Actions CI/CD.',
		sourcePath:
			'apps/vectreal-platform/app/routes/docs/self-hosting/deployment.mdx',
		category: 'self-hosting',
		order: 2,
		version: 'latest'
	},

	// ──────────────────────────────────────────────────────────────────────────
	// Contributing
	// ──────────────────────────────────────────────────────────────────────────
	{
		slug: 'contributing',
		title: 'Contributing',
		description:
			'How to fork, branch, commit, and open a pull request against the Vectreal monorepo.',
		sourcePath: 'apps/vectreal-platform/app/routes/docs/contributing.mdx',
		category: 'contributing',
		order: 0,
		version: 'latest'
	}
]

/** Look up a single page by its slug. */
export function getDocPage(slug: string): DocPage | undefined {
	return docsPages.find((p) => p.slug === slug)
}

/**
 * Where a page sits in the docs, for both of its breadcrumbs: the one in the
 * site bar and the one in the page's structured data.
 *
 * The category comes from the manifest, not from the URL's first segment. The
 * two used to agree, until the embed SDK kept its guides URL and moved to the
 * packages; both breadcrumbs read the URL, and each said "Guides" and linked a
 * `/docs/guides` that does not exist. A category has no page of its own, so
 * its crumb opens the category's first page.
 */
export function getDocTrail(slug: string): {
	page?: DocPage
	categoryLabel?: string
	categoryStart?: DocPage
} {
	const page = getDocPage(slug)
	if (!page) return {}
	const [categoryStart] = docsPages
		.filter((p) => p.category === page.category)
		.sort((a, b) => a.order - b.order)
	return {
		page,
		categoryLabel: DOC_CATEGORY_LABELS[page.category],
		categoryStart
	}
}

/** All pages grouped by category, preserving within-category order. */
export function getDocsByCategory(): Map<DocCategory, DocPage[]> {
	const map = new Map<DocCategory, DocPage[]>()

	for (const category of DOC_CATEGORY_ORDER) {
		map.set(
			category,
			docsPages
				.filter((p) => p.category === category)
				.sort((a, b) => a.order - b.order)
		)
	}

	return map
}

/** Flat, ordered docs list based on category order and per-category page order. */
export function getOrderedDocsPages(): DocPage[] {
	const ordered: DocPage[] = []

	for (const category of DOC_CATEGORY_ORDER) {
		ordered.push(
			...docsPages
				.filter((page) => page.category === category)
				.sort((a, b) => a.order - b.order)
		)
	}

	return ordered
}

/** Previous/next page for linear reading flows. */
export function getAdjacentDocPages(slug: string): {
	previous?: DocPage
	next?: DocPage
} {
	const ordered = getOrderedDocsPages()
	const currentIndex = ordered.findIndex((page) => page.slug === slug)

	if (currentIndex === -1) {
		return {}
	}

	return {
		previous: ordered[currentIndex - 1],
		next: ordered[currentIndex + 1]
	}
}
