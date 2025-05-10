import type { MetaArgs, MetaDescriptor } from 'react-router'

import type { loader } from '../root'

export interface BuildMetaOptions {
	private?: boolean
}

/**
 * Merges base SEO meta with any route-specific overrides.
 * If options.private is true the function adds a noindex,nofollow meta.
 */
export function buildMeta(
	overrides: MetaDescriptor[] = [],
	rootMeta?: MetaDescriptor[],
	options: BuildMetaOptions = {}
): NonNullable<MetaDescriptor>[] {
	const baseMeta: MetaDescriptor[] = [
		{
			title:
				'Enhance-Photo.com - AI Image Enhancer | Free Online Photo Upscaling & Restoration'
		},
		{
			property: 'og:title',
			content:
				'Enhance-Photo.com - AI Image Enhancer | Free Online Photo Upscaling & Restoration'
		},
		{
			name: 'description',
			content:
				'Instantly improve photo quality online for free with Enhance-Photo.com. Easily fix blurry WhatsApp images, pixelated screenshots, and restore clarity with powerful AI.'
		},
		{
			property: 'og:description',
			content:
				'Instantly improve photo quality online for free with Enhance-Photo.com. Easily fix blurry WhatsApp images, pixelated screenshots, and restore clarity with powerful AI.'
		},
		{
			name: 'keywords',
			content:
				'unblur image, photo enhancement, fix WhatsApp images, online photo upscaling, screenshot clarity, restore old photos, pixelation fix, enhance blurry photos'
		}
	]

	// Create a map to ensure unique meta entries based on their property/name
	// with correct precedence (later entries override earlier ones)
	const metaMap = new Map<string, MetaDescriptor>()

	// Helper function to generate a consistent key for each meta descriptor
	const getMetaKey = (meta: MetaDescriptor): string => {
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
