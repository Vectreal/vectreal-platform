import { describe, expect, it } from 'vitest'

import {
	isSameUrlRevalidation,
	shouldRevalidateForRouteParams
} from './dashboard-route-behavior'

const url = (path: string) => new URL(`https://vectreal.test${path}`)

describe('isSameUrlRevalidation', () => {
	it('is a revalidation of the page on screen', () => {
		expect(
			isSameUrlRevalidation({
				currentUrl: url('/dashboard/projects/p/s'),
				nextUrl: url('/dashboard/projects/p/s'),
				defaultShouldRevalidate: true
			})
		).toBe(true)
	})

	it('is not a navigation to a different URL', () => {
		expect(
			isSameUrlRevalidation({
				currentUrl: url('/dashboard/projects/p/s'),
				nextUrl: url('/dashboard/projects/p/s?tab=assets'),
				defaultShouldRevalidate: true
			})
		).toBe(false)
	})

	it('defers to the router when it is not asking', () => {
		expect(
			isSameUrlRevalidation({
				currentUrl: url('/dashboard/projects/p/s'),
				nextUrl: url('/dashboard/projects/p/s'),
				defaultShouldRevalidate: false
			})
		).toBe(false)
	})

	it('covers the case the params rule turns down', () => {
		expect(
			shouldRevalidateForRouteParams({
				currentParams: { projectId: 'p', sceneId: 's' },
				nextParams: { projectId: 'p', sceneId: 's' },
				paramKeys: ['projectId', 'sceneId'],
				defaultShouldRevalidate: true
			})
		).toBe(false)
	})
})
