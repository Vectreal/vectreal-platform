import { describe, expect, it } from 'vitest'

import { AGENT_SCOPES, parseGrantedScopes } from './agent-scopes'
import {
	chooseConsentOrganization,
	consentDocumentHeaders,
	consentsWithoutValidGrant,
	describeRedirectTarget,
	parseConsentForm
} from './oauth-consent'

function form(entries: Array<[string, string]>): FormData {
	const data = new FormData()
	for (const [key, value] of entries) data.append(key, value)
	return data
}

describe('parseGrantedScopes', () => {
	it('always includes the required scope and keeps canonical order', () => {
		expect(parseGrantedScopes(['scenes:publish', 'projects:write'])).toEqual([
			'projects:read',
			'projects:write',
			'scenes:publish'
		])
	})

	it('grants only the required scope when nothing is checked', () => {
		expect(parseGrantedScopes([])).toEqual(['projects:read'])
	})

	it('collapses duplicates', () => {
		expect(parseGrantedScopes(['embed:manage', 'embed:manage'])).toEqual([
			'projects:read',
			'embed:manage'
		])
	})

	it('refuses the whole set when any value is not a scope', () => {
		expect(parseGrantedScopes(['scenes:write', 'scenes:delete'])).toBeNull()
	})

	it('accepts every declared scope', () => {
		expect(parseGrantedScopes([...AGENT_SCOPES])).toEqual([...AGENT_SCOPES])
	})
})

describe('parseConsentForm', () => {
	it('reads a denial without needing anything else', () => {
		expect(parseConsentForm(form([['intent', 'deny']]))).toEqual({
			ok: true,
			decision: { intent: 'deny' }
		})
	})

	it('reads an approval with organization and scopes', () => {
		expect(
			parseConsentForm(
				form([
					['intent', 'approve'],
					['organizationId', ' org-1 '],
					['scope', 'scenes:write']
				])
			)
		).toEqual({
			ok: true,
			decision: {
				intent: 'approve',
				organizationId: 'org-1',
				scopes: ['projects:read', 'scenes:write']
			}
		})
	})

	it('refuses an approval without an organization', () => {
		expect(parseConsentForm(form([['intent', 'approve']]))).toMatchObject({
			ok: false
		})
	})

	it('refuses an approval carrying an unknown scope', () => {
		expect(
			parseConsentForm(
				form([
					['intent', 'approve'],
					['organizationId', 'org-1'],
					['scope', 'projects:delete']
				])
			)
		).toMatchObject({ ok: false })
	})

	it('refuses a form with no intent', () => {
		expect(parseConsentForm(form([['organizationId', 'org-1']]))).toMatchObject(
			{ ok: false }
		)
	})
})

describe('describeRedirectTarget', () => {
	it('names the host and port the browser will be sent to', () => {
		expect(describeRedirectTarget('http://127.0.0.1:53682/callback')).toBe(
			'127.0.0.1:53682'
		)
	})

	it('falls back to the raw value when it is not a URL', () => {
		expect(describeRedirectTarget('not a url')).toBe('not a url')
	})
})

describe('chooseConsentOrganization', () => {
	const members = ['org-a', 'org-b']

	it('keeps the organization the client was granted before', () => {
		expect(chooseConsentOrganization(members, 'org-b', 'org-a')).toBe('org-b')
	})

	it('skips a previous organization the user has left', () => {
		expect(chooseConsentOrganization(members, 'org-gone', 'org-b')).toBe(
			'org-b'
		)
	})

	it('falls back to the first membership when the current one is not a membership either', () => {
		expect(chooseConsentOrganization(members, null, 'org-gone')).toBe('org-a')
	})
})

describe('consentDocumentHeaders', () => {
	it('carries every cookie the action set, beside the loader cookies', () => {
		const loaderHeaders = new Headers()
		loaderHeaders.append('Set-Cookie', 'loader=1')
		const actionHeaders = new Headers()
		actionHeaders.append('Set-Cookie', 'sb-access=a')
		actionHeaders.append('Set-Cookie', 'sb-refresh=b')

		expect(
			consentDocumentHeaders({ loaderHeaders, actionHeaders }).getSetCookie()
		).toEqual(['loader=1', 'sb-access=a', 'sb-refresh=b'])
	})

	it('forbids framing', () => {
		const headers = consentDocumentHeaders({
			loaderHeaders: new Headers(),
			actionHeaders: new Headers()
		})
		expect(headers.get('Content-Security-Policy')).toBe(
			"frame-ancestors 'none'"
		)
		expect(headers.get('X-Frame-Options')).toBe('DENY')
	})
})

describe('consentsWithoutValidGrant', () => {
	const memberOrganizationIds = ['org-a']

	it('keeps a consent backed by a grant in a current organization', () => {
		expect(
			consentsWithoutValidGrant({
				consentedClientIds: ['cli'],
				grants: [{ oauthClientId: 'cli', organizationId: 'org-a' }],
				memberOrganizationIds
			})
		).toEqual([])
	})

	it('withdraws a consent with no grant at all', () => {
		expect(
			consentsWithoutValidGrant({
				consentedClientIds: ['cli'],
				grants: [],
				memberOrganizationIds
			})
		).toEqual(['cli'])
	})

	it('withdraws a consent whose grant points at an organization the user left', () => {
		expect(
			consentsWithoutValidGrant({
				consentedClientIds: ['cli', 'other'],
				grants: [
					{ oauthClientId: 'cli', organizationId: 'org-gone' },
					{ oauthClientId: 'other', organizationId: 'org-a' }
				],
				memberOrganizationIds
			})
		).toEqual(['cli'])
	})

	it('ignores grants for clients Supabase holds no consent for', () => {
		expect(
			consentsWithoutValidGrant({
				consentedClientIds: [],
				grants: [{ oauthClientId: 'cli', organizationId: 'org-gone' }],
				memberOrganizationIds
			})
		).toEqual([])
	})
})
