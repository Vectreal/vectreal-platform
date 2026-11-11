// @vitest-environment jsdom
/**
 * What the `/embed` loader answers when it refuses, and what the frame shows.
 *
 * A refused domain is the one refusal that explains itself: it names the
 * requesting page's own host and points at the fix. A missing token stays the
 * flat 404 every other refusal gives, so a signed-in visitor sees exactly what
 * an anonymous one sees.
 */
import { render, screen } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../app/db/client', () => ({ getDbClient: () => ({}) }))

vi.mock('../app/lib/domain/auth/preview-api-key-auth.server', () => ({
	validatePreviewApiKeyForProject: vi.fn()
}))

import { validatePreviewApiKeyForProject } from '../app/lib/domain/auth/preview-api-key-auth.server'
import { EMBED_ALLOWED_DOMAINS_GUIDE } from '../app/lib/errors/error-state-copy'
import { ErrorBoundary, loader } from '../app/routes/layouts/embed-layout'

import type { Route } from '../app/routes/layouts/+types/embed-layout'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const SCENE_ID = '22222222-2222-4222-8222-222222222222'
const EMBED_URL = `https://vectreal.test/embed/${PROJECT_ID}/${SCENE_ID}`

interface ThrownRefusal {
	data: unknown
	init: { status: number; headers: Record<string, string> }
}

async function refusalFor(query: string, headers?: HeadersInit) {
	try {
		await loader({
			request: new Request(`${EMBED_URL}${query}`, { headers }),
			params: { projectId: PROJECT_ID, sceneId: SCENE_ID }
		} as unknown as Route.LoaderArgs)
	} catch (thrown) {
		return thrown as ThrownRefusal
	}
	throw new Error('the loader did not refuse')
}

/** Renders the layout's real boundary over a loader that throws `thrown`. */
function renderBoundary(thrown: ThrownRefusal) {
	const Stub = createRoutesStub([
		{
			path: '/',
			loader: () => {
				throw new Response(JSON.stringify(thrown.data), {
					status: thrown.init.status,
					headers: { 'Content-Type': 'application/json' }
				})
			},
			Component: () => null,
			ErrorBoundary
		}
	])
	return render(<Stub />)
}

beforeEach(() => {
	vi.mocked(validatePreviewApiKeyForProject).mockReset()
})

describe('a refused domain', () => {
	beforeEach(() => {
		vi.mocked(validatePreviewApiKeyForProject).mockResolvedValue({
			ok: false,
			error: 'domain_not_allowed'
		})
	})

	it('answers 403, no-store, naming the requesting host', async () => {
		const refusal = await refusalFor('?token=vctrl_live', {
			referer: 'https://shop.example.com/products/chair'
		})

		expect(refusal.init.status).toBe(403)
		expect(refusal.init.headers['Cache-Control']).toBe('no-store')
		expect(refusal.data).toEqual({
			reason: 'domain_not_allowed',
			host: 'shop.example.com'
		})
	})

	it('names no host when the page sent none', async () => {
		const refusal = await refusalFor('?token=vctrl_live')
		expect(refusal.data).toEqual({ reason: 'domain_not_allowed', host: null })
	})

	it('shows the host and where the owner adds it', async () => {
		renderBoundary(
			await refusalFor('?token=vctrl_live', {
				referer: 'https://shop.example.com/'
			})
		)

		const message = await screen.findByText(/shop\.example\.com is not on/)
		expect(message.textContent).toMatch(/Allowed embed domains/)
		expect(message.textContent).toContain(EMBED_ALLOWED_DOMAINS_GUIDE)
		expect(
			screen.getByRole('heading', {
				name: 'This site is not allowed to show this embed'
			})
		).toBeTruthy()
	})

	it('renders the host as text, never as markup', async () => {
		const { container } = renderBoundary({
			data: {
				reason: 'domain_not_allowed',
				host: '<img src=x onerror=alert(1)>'
			},
			init: { status: 403, headers: {} }
		})

		await screen.findByText(/<img src=x onerror=alert\(1\)> is not on/)
		expect(container.querySelector('img')).toBeNull()
	})
})

describe('a missing token', () => {
	it('stays the flat 404 that names nothing', async () => {
		const refusal = await refusalFor('', {
			referer: 'https://shop.example.com/'
		})

		expect(refusal.init.status).toBe(404)
		expect(refusal.init.headers['Cache-Control']).toBe('no-store')
		expect(refusal.data).toEqual({ reason: 'not_available' })
		expect(validatePreviewApiKeyForProject).not.toHaveBeenCalled()
	})

	it('shows no host, even when the page sent one', async () => {
		const { container } = renderBoundary(
			await refusalFor('', { referer: 'https://shop.example.com/' })
		)

		await screen.findByText('This embed is not available')
		expect(container.textContent).not.toContain('shop.example.com')
	})
})
