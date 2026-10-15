import { describe, expect, it } from 'vitest'

import {
	isUnreachableAction,
	shouldRevalidateForRouteParams,
	shouldRevalidateWithinScope
} from './dashboard-route-behavior'

const params = { projectId: 'p', sceneId: 's' }

const afterPost = (actionResult: unknown) =>
	shouldRevalidateForRouteParams({
		currentParams: params,
		nextParams: params,
		paramKeys: ['projectId', 'sceneId'],
		formMethod: 'POST',
		actionResult,
		defaultShouldRevalidate: true
	})

const afterScopedPost = (actionResult: unknown) =>
	shouldRevalidateWithinScope({
		currentPathname: '/dashboard/projects',
		nextPathname: '/dashboard/projects',
		formMethod: 'POST',
		actionResult,
		defaultShouldRevalidate: true,
		scopePrefix: '/dashboard'
	})

describe('isUnreachableAction', () => {
	it('is an action that says it never reached the server', () => {
		expect(isUnreachableAction({ success: false, unreachable: true })).toBe(
			true
		)
	})

	it('is not a refusal the server gave, or anything else', () => {
		expect(isUnreachableAction({ success: false, error: 'Unauthorized' })).toBe(
			false
		)
		expect(isUnreachableAction({ unreachable: 'yes' })).toBe(false)
		expect(isUnreachableAction(null)).toBe(false)
		expect(isUnreachableAction(undefined)).toBe(false)
	})
})

describe('revalidating after a POST', () => {
	it('reloads after an action that succeeded', () => {
		expect(afterPost({ success: true })).toBe(true)
		expect(afterScopedPost({ success: true })).toBe(true)
	})

	/*
	  Load-bearing: a 401 reloads the layout into its sign-in redirect, a 403
	  reloads root into a fresh CSRF token, and a confirmation refusal reloads
	  the plan the delete dialog reads.
	*/
	it('still reloads after a refusal the server gave', () => {
		expect(afterPost({ success: false, error: 'Unauthorized' })).toBe(true)
		expect(
			afterScopedPost({ success: false, error: 'Invalid CSRF token' })
		).toBe(true)
	})

	it('reloads nothing after an action that never reached the server', () => {
		expect(afterPost({ success: false, unreachable: true })).toBe(false)
		expect(afterScopedPost({ success: false, unreachable: true })).toBe(false)
	})
})
