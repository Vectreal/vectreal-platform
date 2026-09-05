import { buildSiteStructuredData } from '../lib/seo-registry'

/**
 * Site-wide structured data: the Organization, WebSite and WebApplication nodes.
 *
 * Rendered from `nav-layout` rather than through a route's `meta`, because
 * these describe the site rather than any one page and route meta cannot carry
 * them. A leaf route's `meta` replaces its ancestors', every public route
 * exports one, and the two layouts that do forward root's descriptors go
 * through `getRootMeta`, which keeps `og:image` alone. Root built all three
 * nodes on every render and not one prerendered page carried a single one.
 *
 * JSON-LD is valid anywhere in the document, so being in the body rather than
 * the head costs nothing. What it buys is scope: `nav-layout` wraps the public
 * site and not the embed iframe.
 *
 * A component rather than three lines inside `Layout` so that the delivery has
 * something a test can hold: the defect this fixes was never in the nodes, only
 * in whether anything rendered them.
 */
export function SiteStructuredData() {
	return (
		<>
			{buildSiteStructuredData().map((node) => (
				<script
					key={node['@id']}
					type="application/ld+json"
					dangerouslySetInnerHTML={{ __html: serializeJsonLd(node) }}
				/>
			))}
		</>
	)
}

/**
 * `<` is escaped because a `</script>` inside a JSON string would close the tag
 * early, ending the block in the middle of a node and spilling the rest of it
 * into the page as text. Every value here comes from a constant today, so this
 * guards a future edit rather than a live input.
 */
export function serializeJsonLd(node: unknown): string {
	return JSON.stringify(node).replace(/</g, '\\u003c')
}
