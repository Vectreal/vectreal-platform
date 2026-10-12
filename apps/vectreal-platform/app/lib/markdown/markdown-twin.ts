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

/** The twin's text, from the same origin the page was served from. */
export async function fetchMarkdownTwin(htmlPath: string): Promise<string> {
	const response = await fetch(markdownTwinPath(htmlPath))
	if (!response.ok) {
		throw new Error(`${markdownTwinPath(htmlPath)} answered ${response.status}`)
	}
	return response.text()
}
