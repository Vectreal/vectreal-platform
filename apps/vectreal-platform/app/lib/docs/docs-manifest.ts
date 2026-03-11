/**
 * Vectreal Platform — Docs Manifest
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
 * to include the version prefix (e.g. "v2/getting-started/installation").
 */

export const GITHUB_REPO = 'https://github.com/Vectreal/vectreal-platform'

export const GITHUB_DEFAULT_BRANCH = 'main'

/** Generates the full "Edit on GitHub" URL for a source file. */
export function editOnGithubUrl(sourcePath: string): string {
	return `${GITHUB_REPO}/blob/${GITHUB_DEFAULT_BRANCH}/${sourcePath}`
}

/** Top-level groupings shown in the sidebar. */
export type DocCategory =
	| 'overview'
	| 'getting-started'
	| 'guides'
	| 'packages'
	| 'operations'
	| 'contributing'

export interface DocPage {
	/** URL segment after /docs (e.g. "getting-started/installation") */
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
	overview: 'Overview',
	'getting-started': 'Getting Started',
	guides: 'Guides',
	packages: 'Package Reference',
	operations: 'Operations',
	contributing: 'Contributing'
}

/** Ordered list of categories as they appear in the sidebar. */
export const DOC_CATEGORY_ORDER: DocCategory[] = [
	'overview',
	'getting-started',
	'guides',
	'packages',
	'operations',
	'contributing'
]

export const docsPages: DocPage[] = [
	// ──────────────────────────────────────────────────────────────────────────
	// Overview
	// ──────────────────────────────────────────────────────────────────────────
	{
		slug: '',
		title: 'Documentation',
		description:
			'Everything you need to build with the Vectreal Platform and its open-source packages.',
		sourcePath: 'apps/vectreal-platform/app/routes/docs/index.mdx',
		category: 'overview',
		order: 0,
		version: 'latest'
	},

	// ──────────────────────────────────────────────────────────────────────────
	// Getting Started
	// ──────────────────────────────────────────────────────────────────────────
	{
		slug: 'getting-started',
		title: 'Getting Started',
		description:
			'Overview of the monorepo and how to run the platform locally.',
		sourcePath:
			'apps/vectreal-platform/app/routes/docs/getting-started/index.mdx',
		category: 'getting-started',
		order: 0,
		version: 'latest'
	},
	{
		slug: 'getting-started/installation',
		title: 'Installation',
		description:
			'Clone the repo, install dependencies, configure environment variables, and spin up the local dev stack.',
		sourcePath:
			'apps/vectreal-platform/app/routes/docs/getting-started/installation.mdx',
		category: 'getting-started',
		order: 1,
		version: 'latest'
	},
	{
		slug: 'getting-started/first-model',
		title: 'Your First Model',
		description:
			'Upload, optimize, and publish a 3D model in under two minutes using the Publisher.',
		sourcePath:
			'apps/vectreal-platform/app/routes/docs/getting-started/first-model.mdx',
		category: 'getting-started',
		order: 2,
		version: 'latest'
	},

	// ──────────────────────────────────────────────────────────────────────────
	// Guides
	// ──────────────────────────────────────────────────────────────────────────
	{
		slug: 'guides/upload',
		title: 'Uploading Models',
		description:
			'Supported file formats, drag-and-drop behaviour, and multi-file glTF bundles.',
		sourcePath: 'apps/vectreal-platform/app/routes/docs/guides/upload.mdx',
		category: 'guides',
		order: 0,
		version: 'latest'
	},
	{
		slug: 'guides/optimize',
		title: 'Optimizing & Configuring',
		description:
			'Quality presets, texture compression, mesh simplification, lighting, and camera settings.',
		sourcePath: 'apps/vectreal-platform/app/routes/docs/guides/optimize.mdx',
		category: 'guides',
		order: 1,
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
		order: 2,
		version: 'latest'
	},

	// ──────────────────────────────────────────────────────────────────────────
	// Package Reference
	// ──────────────────────────────────────────────────────────────────────────
	{
		slug: 'packages/viewer',
		title: '@vctrl/viewer',
		description:
			'React component for rendering and interacting with 3D models in the browser.',
		sourcePath: 'apps/vectreal-platform/app/routes/docs/packages/viewer.mdx',
		category: 'packages',
		order: 0,
		version: 'latest'
	},
	{
		slug: 'packages/hooks',
		title: '@vctrl/hooks',
		description:
			'React hooks for loading, optimising, and exporting 3D models in the browser.',
		sourcePath: 'apps/vectreal-platform/app/routes/docs/packages/hooks.mdx',
		category: 'packages',
		order: 1,
		version: 'latest'
	},
	{
		slug: 'packages/core',
		title: '@vctrl/core',
		description:
			'Server-side 3D model processing — loader, optimizer, and exporter for Node.js.',
		sourcePath: 'apps/vectreal-platform/app/routes/docs/packages/core.mdx',
		category: 'packages',
		order: 2,
		version: 'latest'
	},

	// ──────────────────────────────────────────────────────────────────────────
	// Operations
	// ──────────────────────────────────────────────────────────────────────────
	{
		slug: 'operations/deployment',
		title: 'Deployment',
		description:
			'GCP Cloud Run deployment with Terraform and GitHub Actions CI/CD.',
		sourcePath:
			'apps/vectreal-platform/app/routes/docs/operations/deployment.mdx',
		category: 'operations',
		order: 0,
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
