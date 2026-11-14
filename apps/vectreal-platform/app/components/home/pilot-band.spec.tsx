// @vitest-environment jsdom
/**
 * The home page's first offer has one job: take a brand with photos to the
 * free-model intake, and say what happens there in order. Where a tour scene
 * is configured, a wide screen tours it beside the steps; everywhere else the
 * band is exactly what the prerendered page holds.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { PilotBand } from './pilot-band'
import { HOME_PAGE_COPY } from '../../constants/product-copy'

const COPY = HOME_PAGE_COPY.pilot

const SCENE = {
	embedPath: '/embed/p/s?token=t&cameraControls=0',
	posterUrl: null,
	title: 'Camera'
}

let wide = false
const tourResponse = vi.fn(
	async () => new Response(null, { status: 404 }) as Response
)

beforeEach(() => {
	wide = false
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: query.includes('min-width') ? wide : false
	}))
	vi.stubGlobal('fetch', tourResponse)
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			observe() {}
			disconnect() {}
		}
	)
})

afterEach(() => {
	vi.unstubAllGlobals()
	tourResponse.mockClear()
})

const renderBand = () =>
	render(
		<MemoryRouter>
			<PilotBand />
		</MemoryRouter>
	)

it('leads to the free-model intake', () => {
	renderBand()
	expect(
		screen.getByRole('link', { name: COPY.cta }).getAttribute('href')
	).toBe('/free-model')
})

it('marks only that link as the brand action', () => {
	const { container } = renderBand()
	const brand = [...container.querySelectorAll('[data-variant="brand"]')]
	expect(brand.map((action) => action.getAttribute('href'))).toEqual([
		'/free-model'
	])
})

it('lists the steps in order, each named by its heading', () => {
	renderBand()
	const steps = within(
		screen.getByRole('list', { name: COPY.stepsLabel })
	).getAllByRole('listitem')
	expect(
		steps.map((step) => within(step).getByRole('heading').textContent)
	).toEqual(COPY.steps.map((step) => step.title))
})

it('asks for no tour on a phone', () => {
	renderBand()
	expect(tourResponse).not.toHaveBeenCalled()
})

it('keeps its steps where no tour is configured', async () => {
	wide = true
	const { container } = renderBand()
	await waitFor(() => expect(tourResponse).toHaveBeenCalled())
	expect(container.querySelector('iframe')).toBeNull()
	expect(screen.getByRole('list', { name: COPY.stepsLabel })).toBeTruthy()
})

it('tours the configured scene beside the steps on a wide screen', async () => {
	wide = true
	tourResponse.mockResolvedValueOnce(
		new Response(JSON.stringify({ success: true, data: SCENE }))
	)
	const { container, unmount } = renderBand()
	await waitFor(() =>
		expect(container.querySelector('iframe')?.title).toBe(SCENE.title)
	)
	const steps = within(
		screen.getByRole('list', { name: COPY.stepsLabel })
	).getAllByRole('listitem')
	expect(steps[0].getAttribute('aria-current')).toBe('step')
	unmount()
})
