import { describe, expect, it } from 'vitest'

import {
	SAFE_NEXT_PATH_PREFIXES,
	getSafeNextPath,
	buildSigninErrorRedirect
} from './auth-redirect.server'

describe('getSafeNextPath', () => {
	it('returns /dashboard for null', () => {
		expect(getSafeNextPath(null)).toBe('/dashboard')
	})

	it('returns /dashboard for empty string', () => {
		expect(getSafeNextPath('')).toBe('/dashboard')
	})

	it('returns /dashboard for relative path without leading slash', () => {
		expect(getSafeNextPath('dashboard')).toBe('/dashboard')
	})

	it('returns /dashboard for disallowed path', () => {
		expect(getSafeNextPath('/evil')).toBe('/dashboard')
	})

	it('allows exact prefix matches', () => {
		for (const prefix of SAFE_NEXT_PATH_PREFIXES) {
			expect(getSafeNextPath(prefix)).toBe(prefix)
		}
	})

	it('allows paths nested under safe prefixes', () => {
		expect(getSafeNextPath('/dashboard/projects/abc')).toBe(
			'/dashboard/projects/abc'
		)
		expect(getSafeNextPath('/publisher/scene-123')).toBe('/publisher/scene-123')
		expect(getSafeNextPath('/reset-password')).toBe('/reset-password')
		expect(getSafeNextPath('/publisher/scene-1?restore_draft=1')).toBe(
			'/publisher/scene-1?restore_draft=1'
		)
	})

	it('rejects /dashboardevil (prefix but not slash-separated)', () => {
		expect(getSafeNextPath('/dashboardevil')).toBe('/dashboard')
	})

	/*
	  The whitelist matched the whole string, so a safe destination carrying
	  parameters was rejected and silently became /dashboard. The publisher
	  builds exactly this URL when an anonymous visitor with no scene open signs
	  in to save, so the draft it just wrote to IndexedDB was unreachable.
	*/
	it('keeps the query string on a safe path', () => {
		expect(getSafeNextPath('/publisher?restore_draft=1&draft_id=abc')).toBe(
			'/publisher?restore_draft=1&draft_id=abc'
		)
	})

	it('keeps the hash on a safe path', () => {
		expect(getSafeNextPath('/dashboard#billing')).toBe('/dashboard#billing')
	})

	/*
	  The three rejections below passed under the old whole-string comparison
	  too. They are here because the pathname split is a new way to get them
	  wrong, not because they demonstrate the fix.
	*/
	it('rejects a disallowed path that carries a query', () => {
		expect(getSafeNextPath('/evil?next=/publisher')).toBe('/dashboard')
	})

	it('rejects /dashboardevil when it carries a query', () => {
		expect(getSafeNextPath('/dashboardevil?x=1')).toBe('/dashboard')
	})

	/*
	  A protocol-relative URL is the reason the pathname is split off by hand
	  rather than parsed with `new URL`: parsing would read `evil.com` as the
	  host and hand back a path that looks safe.
	*/
	it('rejects a protocol-relative URL', () => {
		expect(getSafeNextPath('//evil.com/publisher')).toBe('/dashboard')
		expect(getSafeNextPath('//evil.com/publisher?x=1')).toBe('/dashboard')
	})
})

describe('buildSigninErrorRedirect', () => {
	it('encodes error code and next path into sign-in URL', () => {
		const url = buildSigninErrorRedirect('missing_code', '/dashboard')
		expect(url).toBe('/sign-in?error=missing_code&next=%2Fdashboard')
	})
})
