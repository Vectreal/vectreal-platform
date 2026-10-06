import { describe, expect, it } from 'vitest'

import {
	isRefusedAction,
	shouldRevalidateForRouteParams,
	shouldRevalidateWithinScope
} from './dashboard-route-behavior'

const params = { projectId: 'p', sceneId: 's' }

const afterPost = (actionStatus?: number) =>
	shouldRevalidateForRouteParams({
		currentParams: params,
		nextParams: params,
		paramKeys: ['projectId', 'sceneId'],
		formMethod: 'POST',
		actionResult: {},
		actionStatus,
		defaultShouldRevalidate: true
	})

const afterScopedPost = (actionStatus?: number) =>
	shouldRevalidateWithinScope({
		currentPathname: '/dashboard/projects',
		nextPathname: '/dashboard/projects',
		formMethod: 'POST',
		actionResult: {},
		actionStatus,
		defaultShouldRevalidate: true,
		scopePrefix: '/dashboard'
	})

describe('isRefusedAction', () => {
	it('is a refusal from 400 up', () => {
		expect(isRefusedAction(400)).toBe(true)
		expect(isRefusedAction(503)).toBe(true)
	})

	it('is not a refusal below 400, or with no status at all', () => {
		expect(isRefusedAction(200)).toBe(false)
		expect(isRefusedAction(399)).toBe(false)
		expect(isRefusedAction(undefined)).toBe(false)
	})
})

describe('revalidating after a POST', () => {
	it('reloads after an action that succeeded', () => {
		expect(afterPost(200)).toBe(true)
		expect(afterScopedPost(200)).toBe(true)
	})

	it('reloads after an action that reported no status', () => {
		expect(afterPost(undefined)).toBe(true)
		expect(afterScopedPost(undefined)).toBe(true)
	})

	it('reloads nothing after an action that was refused', () => {
		expect(afterPost(503)).toBe(false)
		expect(afterScopedPost(404)).toBe(false)
	})
})
