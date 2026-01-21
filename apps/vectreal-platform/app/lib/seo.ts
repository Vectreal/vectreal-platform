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
