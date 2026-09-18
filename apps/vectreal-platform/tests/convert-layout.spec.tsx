// @vitest-environment jsdom
/**
 * The converter family has one header and one rail, and both follow the URL.
 *
 * The pair pages shipped without either: each rendered a bare heading of its
 * own and linked to no sibling, so `/convert/glb-to-gltf` and
 * `/convert/glb-to-usdz` were two pages that did not know about each other.
 *
 * The real layout module is rendered rather than its derivation function,
 * because the derivation is the layout. Pulling the regex out into a helper and
 * testing that instead would leave the part that can actually break - a layout
 * that reads the wrong thing, or renders a heading nobody sees - uncovered,
 * which is the #755 shape the delivery skill records.
 */
import { render, screen } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { describe, expect, it } from 'vitest'

import {
	CONVERT_INDEX_COPY,
	CONVERT_INDEX_PATH,
	CONVERT_PAIRS,
	convertPairPath
} from '../app/lib/convert/convert-pairs'
import ConvertIndexPage from '../app/routes/convert-page/convert-index'
import ConvertLayout from '../app/routes/layouts/convert-layout'

function renderAt(pathname: string) {
	const Stub = createRoutesStub([
		{
			path: CONVERT_INDEX_PATH,
			Component: ConvertLayout as never,
			children: [
				// The real index, because half of what is asserted below is which of
				// the two surfaces carries the links.
				{ index: true, Component: ConvertIndexPage as never },
				{ path: ':pair', Component: () => <p>pair body</p> }
			]
		}
	])

	return render(<Stub initialEntries={[pathname]} />)
}

describe('the converter layout heads the page from the path', () => {
	it('titles the index with the family copy', async () => {
		renderAt(CONVERT_INDEX_PATH)

		expect(
			await screen.findByRole('heading', {
				level: 1,
				name: CONVERT_INDEX_COPY.title
			})
		).toBeInTheDocument()
	})

	it.each(CONVERT_PAIRS)(
		'titles /convert/$slug with its own copy',
		async (pair) => {
			renderAt(convertPairPath(pair))

			expect(
				await screen.findByRole('heading', { level: 1, name: pair.title })
			).toBeInTheDocument()
			expect(screen.getByText(pair.description)).toBeInTheDocument()
		}
	)

	it('renders exactly one h1, so the pair pages do not add a second', async () => {
		renderAt(convertPairPath(CONVERT_PAIRS[0]))

		expect(await screen.findAllByRole('heading', { level: 1 })).toHaveLength(1)
	})
})

describe('the rail reaches every converter from every pair page', () => {
	it.each(CONVERT_PAIRS.map(convertPairPath))(
		'links all of them from %s',
		async (pathname) => {
			renderAt(pathname)

			const rail = await screen.findByRole('navigation', {
				name: 'Converters'
			})

			for (const pair of CONVERT_PAIRS) {
				const href = convertPairPath(pair)
				expect(
					[...rail.querySelectorAll('a')].map((link) =>
						link.getAttribute('href')
					),
					`${pathname} does not link ${href}`
				).toContain(href)
			}
		}
	)

	it('marks the open converter as the current page, and only it', async () => {
		const open = CONVERT_PAIRS[0]
		renderAt(convertPairPath(open))

		const rail = await screen.findByRole('navigation', { name: 'Converters' })
		const current = [...rail.querySelectorAll('[aria-current="page"]')]

		expect(current).toHaveLength(1)
		expect(current[0].getAttribute('href')).toBe(convertPairPath(open))
	})

	it('leads back to the index from every pair page', async () => {
		for (const pair of CONVERT_PAIRS) {
			const view = renderAt(convertPairPath(pair))
			const rail = await screen.findByRole('navigation', { name: 'Converters' })

			expect(
				[...rail.querySelectorAll('a')].map((link) => link.getAttribute('href'))
			).toContain(CONVERT_INDEX_PATH)

			view.unmount()
		}
	})
})

describe('the index is the chooser, so it carries the links itself', () => {
	/*
	  The rail is suppressed there on purpose. This is the pair of assertions
	  that keeps that from quietly becoming "the index links nothing": the rail
	  must be absent AND every conversion must still be one click away.
	*/
	it('renders no rail', async () => {
		renderAt(CONVERT_INDEX_PATH)

		await screen.findByRole('heading', { level: 1 })
		expect(
			screen.queryByRole('navigation', { name: 'Converters' })
		).not.toBeInTheDocument()
	})

	it('links every conversion from the matrix', async () => {
		const { container } = renderAt(CONVERT_INDEX_PATH)

		await screen.findByRole('heading', { level: 1 })
		const hrefs = [...container.querySelectorAll('a')].map((link) =>
			link.getAttribute('href')
		)

		for (const pair of CONVERT_PAIRS) {
			expect(hrefs, `the index does not link ${pair.slug}`).toContain(
				convertPairPath(pair)
			)
		}
	})

	it('groups the chooser by the format each conversion produces', async () => {
		renderAt(CONVERT_INDEX_PATH)
		await screen.findByRole('heading', { level: 1 })

		/*
		  By region rather than by text. "glTF" is both a source and a target, so a
		  plain text query matches twice and proves neither; the region's name is
		  what a screen reader announces before the chips inside it, and it is the
		  half of the choice a chip reading "from GLB" cannot say on its own.

		  Destination rather than source, which is the page's structure: the reason
		  a conversion exists belongs to the format that comes out, so grouping the
		  other way repeated it once per source that could reach it.
		*/
		for (const label of new Set(CONVERT_PAIRS.map((pair) => pair.toLabel))) {
			const group = screen.getByRole('region', { name: `To ${label}` })

			const expected = CONVERT_PAIRS.filter(
				(pair) => pair.toLabel === label
			).map(convertPairPath)

			expect(
				[...group.querySelectorAll('a')].map((link) =>
					link.getAttribute('href')
				)
			).toEqual(expected)
		}
	})
})
