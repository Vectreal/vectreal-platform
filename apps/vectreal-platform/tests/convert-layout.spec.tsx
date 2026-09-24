// @vitest-environment jsdom
/**
 * The converter family has one header and one switcher, and both follow the URL.
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

describe('every pair page reaches every converter', () => {
	/*
	  Across the page, not inside the switcher. The switcher offers only the
	  current source's targets, so the chooser under the converter is what keeps
	  every pair one link from every pair; this is the invariant, wherever on the
	  page it is kept.
	*/
	it.each(CONVERT_PAIRS.map(convertPairPath))(
		'links all of them from %s',
		async (pathname) => {
			const { container } = renderAt(pathname)
			await screen.findByRole('navigation', { name: 'Converters' })

			const hrefs = [...container.querySelectorAll('a')].map((link) =>
				link.getAttribute('href')
			)
			for (const pair of CONVERT_PAIRS) {
				expect(
					hrefs,
					`${pathname} does not link ${convertPairPath(pair)}`
				).toContain(convertPairPath(pair))
			}
		}
	)

	it('marks the open converter as the current page, and only it', async () => {
		const open = CONVERT_PAIRS[0]
		renderAt(convertPairPath(open))

		const switcher = await screen.findByRole('navigation', {
			name: 'Converters'
		})
		const current = [...switcher.querySelectorAll('[aria-current="page"]')]

		expect(current).toHaveLength(1)
		expect(current[0].getAttribute('href')).toBe(convertPairPath(open))
	})

	it('leads back to the index from every pair page', async () => {
		for (const pair of CONVERT_PAIRS) {
			const view = renderAt(convertPairPath(pair))
			const switcher = await screen.findByRole('navigation', {
				name: 'Converters'
			})

			expect(
				[...switcher.querySelectorAll('a')].map((link) =>
					link.getAttribute('href')
				)
			).toContain(CONVERT_INDEX_PATH)

			view.unmount()
		}
	})
})

describe('the index is the chooser, so it carries the links itself', () => {
	/*
	  The switcher is suppressed there on purpose. This is the pair of
	  assertions that keeps that from quietly becoming "the index links
	  nothing": the switcher must be absent AND every conversion must still be
	  one click away.
	*/
	it('renders no switcher', async () => {
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
