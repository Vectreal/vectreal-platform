// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { createRoutesStub, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { ArticleCtaPanel } from './article-cta-panel'

import type { ArticleCta } from '../../lib/news/article-cta'

function Destination() {
	const location = useLocation()
	return <p>at {`${location.pathname}${location.search}`}</p>
}

function renderPanel(cta: ArticleCta, onAction = vi.fn()) {
	const Stub = createRoutesStub([
		{
			path: '/',
			Component: () => <ArticleCtaPanel cta={cta} onAction={onAction} />
		},
		{ path: '/publisher', Component: Destination },
		{ path: '/convert', Component: Destination }
	])
	render(<Stub />)
	return onAction
}

describe('ArticleCtaPanel', () => {
	it('asks for one thing: no sign-up and no pricing', () => {
		renderPanel({ kind: 'publisher', to: '/publisher' })
		const hrefs = screen
			.getAllByRole('link')
			.map((link) => link.getAttribute('href'))
		expect(hrefs).toEqual([
			'/publisher',
			'/publisher?sample=rocket',
			'/publisher?sample=camera'
		])
	})

	it('reports the primary action and follows the article cta', () => {
		const onAction = renderPanel({ kind: 'convert', to: '/convert' })
		fireEvent.click(screen.getByRole('link', { name: /open the converters/i }))
		expect(onAction).toHaveBeenCalledWith('primary')
		expect(screen.getByText('at /convert')).toBeTruthy()
	})

	it('opens a sample in the publisher and reports which', () => {
		const onAction = renderPanel({ kind: 'publisher', to: '/publisher' })
		fireEvent.click(screen.getByRole('link', { name: /rocket/i }))
		expect(onAction).toHaveBeenCalledWith('rocket')
		expect(screen.getByText('at /publisher?sample=rocket')).toBeTruthy()
	})
})
