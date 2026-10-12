// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { createRoutesStub, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { ArticleCtaPanel } from './article-cta-panel'
import { DEFAULT_ARTICLE_CTA } from '../../lib/news/article-cta'

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
		{ path: '/convert', Component: Destination },
		{ path: '/view', Component: Destination }
	])
	render(<Stub />)
	return onAction
}

const hrefs = () =>
	screen.getAllByRole('link').map((link) => link.getAttribute('href'))

describe('ArticleCtaPanel', () => {
	it('asks for one thing, with one model beside it: no sign-up and no pricing', () => {
		renderPanel(DEFAULT_ARTICLE_CTA)
		expect(hrefs()).toEqual(['/publisher', '/publisher?sample=rocket'])
	})

	it("offers the article's example scene when its cta names one", () => {
		renderPanel({
			kind: 'publisher',
			shortcut: { type: 'example', id: 'camera-shadows' }
		})
		expect(hrefs()).toEqual(['/publisher', '/publisher?example=camera-shadows'])
	})

	it('reports the primary action and follows the article cta', () => {
		const onAction = renderPanel({ kind: 'convert', to: '/convert' })
		fireEvent.click(screen.getByRole('link', { name: /open the converters/i }))
		expect(onAction).toHaveBeenCalledWith('primary')
		expect(screen.getByText('at /convert')).toBeTruthy()
	})

	it('sends a reader with a file to look at to the viewer', () => {
		const onAction = renderPanel({ kind: 'view' })
		expect(hrefs()).toEqual(['/view'])
		fireEvent.click(screen.getByRole('link', { name: /open the viewer/i }))
		expect(onAction).toHaveBeenCalledWith('primary')
		expect(screen.getByText('at /view')).toBeTruthy()
	})

	it('opens the shortcut model in the publisher and reports which', () => {
		const onAction = renderPanel(DEFAULT_ARTICLE_CTA)
		fireEvent.click(screen.getByRole('link', { name: /rocket sample/i }))
		expect(onAction).toHaveBeenCalledWith('rocket')
		expect(screen.getByText('at /publisher?sample=rocket')).toBeTruthy()
	})
})
