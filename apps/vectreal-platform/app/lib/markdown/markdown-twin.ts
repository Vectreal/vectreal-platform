import type { MetaDescriptor } from 'react-router'

/** Where the markdown twin of the HTML page at `htmlPath` is served. */
export const markdownTwinPath = (htmlPath: string) => `${htmlPath}.md`

/**
 * The `<link rel="alternate">` that lets an agent reading the HTML page find
 * its twin, the convention llms.txt-aware crawlers look for.
 */
export const markdownTwinLink = (htmlPath: string): MetaDescriptor => ({
	tagName: 'link',
	rel: 'alternate',
	type: 'text/markdown',
	href: markdownTwinPath(htmlPath)
})
