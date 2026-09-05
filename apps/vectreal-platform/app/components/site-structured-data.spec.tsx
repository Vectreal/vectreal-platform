// @vitest-environment jsdom
import { readFileSync } from 'node:fs'

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { serializeJsonLd, SiteStructuredData } from './site-structured-data'

/**
 * The nodes were never the problem. Root built Organization, WebSite and
 * WebApplication on every render and handed them to `meta`, where a leaf
 * route's own `meta` replaced them - so the prerendered home page carried zero
 * `application/ld+json` blocks while three well-formed ones were being built for
 * it. That is the shape these tests are aimed at: whether anything renders.
 */
/** Reads a source file, relative to this one. */
const appSource = (relativePath: string) =>
	readFileSync(new URL(relativePath, import.meta.url), 'utf8')

describe('SiteStructuredData', () => {
	const scripts = () => {
		const { container } = render(<SiteStructuredData />)
		return Array.from(
			container.querySelectorAll('script[type="application/ld+json"]')
		)
	}

	it('renders one script per site-wide node', () => {
		const types = scripts().map(
			(script) => JSON.parse(script.innerHTML)['@type']
		)

		expect(types).toEqual(['Organization', 'WebSite', 'WebApplication'])
	})

	it('emits parseable JSON-LD, not a string that merely looks like it', () => {
		// Asserted over a mapped array rather than inside a loop: a loop body
		// runs zero times when nothing renders, which is the failure this file
		// is about.
		const nodes = scripts().map((script) => JSON.parse(script.innerHTML))

		expect(nodes.map((node) => node['@context'])).toEqual([
			'https://schema.org',
			'https://schema.org',
			'https://schema.org'
		])
		for (const node of nodes) {
			expect(node['@id']).toMatch(/^https?:\/\/.+#/)
		}
	})

	/*
	  The nodes were never the defect; the delivery was. Every assertion above
	  passes with this component rendered by nothing at all, which is exactly the
	  state the change fixes - three well-formed nodes reaching zero pages.

	  Asserting on source is crude, and it is the only check that fails for the
	  right reason without a build. The build is the real proof and it cannot run
	  here.
	*/
	it('is rendered by the layout that wraps the public site', () => {
		expect(appSource('../routes/layouts/nav-layout.tsx')).toContain(
			'<SiteStructuredData />'
		)
	})

	/*
	  And nowhere that would put it inside a customer's embed iframe. The root
	  layout wraps every document, so rendering it there ships Vectreal's pricing
	  copy into pages the product is embedded in, where it is `noindex` and reaches
	  nobody.
	*/
	it('is not rendered from the root layout, which wraps the embed iframe too', () => {
		expect(appSource('../root.tsx')).not.toContain('SiteStructuredData')
	})
})

/*
  Tested directly, against an input that actually holds a `<`.

  Asserting this through the component proved nothing: every value it
  serializes comes from a constant and none contains a `<`, so deleting the
  escape left all three tests above green. The mutation is what said so.
*/
describe('serializeJsonLd', () => {
	it('escapes < so a value can never close the script tag early', () => {
		expect(serializeJsonLd({ name: '</script><img src=x>' })).not.toContain('<')
	})

	it('escapes it reversibly, so the node a crawler parses is unchanged', () => {
		const name = '</script>'

		expect(JSON.parse(serializeJsonLd({ name })).name).toBe(name)
	})
})
