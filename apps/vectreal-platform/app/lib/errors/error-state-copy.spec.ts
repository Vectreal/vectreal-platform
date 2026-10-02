import { UNSAFE_ErrorResponseImpl as ErrorResponseImpl } from 'react-router'
import { describe, expect, it } from 'vitest'

import {
	EMBED_ERROR_COPY,
	embedErrorKind,
	type EmbedErrorKind,
	publicErrorKind,
	routeErrorDetail
} from './error-state-copy'

function response(status: number, data: unknown = null) {
	return new ErrorResponseImpl(status, '', data)
}

describe('publicErrorKind', () => {
	it.each([
		[response(404), 'not_found'],
		[response(403), 'forbidden'],
		[response(500), 'server_error'],
		[response(400), 'server_error'],
		[new Error('boom'), 'server_error'],
		['a string', 'server_error']
	])('maps %o to %s', (error, kind) => {
		expect(publicErrorKind(error)).toBe(kind)
	})
})

describe('routeErrorDetail', () => {
	it('shows copy a loader wrote on purpose', () => {
		expect(routeErrorDetail(response(403, '  Ask the owner.  '))).toBe(
			'Ask the owner.'
		)
	})

	it.each([
		['an exception message', new Error('at db/client.ts:12 token=abc')],
		['a JSON body', response(500, { secret: 'payload' })],
		['a blank body', response(500, '   ')]
	])('never shows %s', (_, error) => {
		expect(routeErrorDetail(error)).toBeUndefined()
	})
})

describe('embedErrorKind', () => {
	it.each([
		[response(403, { reason: 'domain_not_allowed' }), 'domain_not_allowed'],
		[response(429, { reason: 'busy' }), 'busy'],
		[response(404, { reason: 'not_available' }), 'not_available'],
		[response(400, { reason: 'not_available' }), 'not_available'],
		[response(404), 'not_available'],
		[response(500), 'load_failed'],
		[new Error('boom'), 'load_failed']
	])('maps %o to %s', (error, kind) => {
		expect(embedErrorKind(error)).toBe(kind)
	})

	it('only explains a refused domain when the loader said so', () => {
		// A 403 is not by itself a domain refusal.
		expect(embedErrorKind(response(403))).toBe('not_available')
	})
})

describe('embed copy', () => {
	const kinds = Object.keys(EMBED_ERROR_COPY) as EmbedErrorKind[]

	it('offers a retry only where trying again could change the answer', () => {
		expect(kinds.filter((kind) => EMBED_ERROR_COPY[kind].retryable)).toEqual([
			'busy',
			'load_failed'
		])
	})

	it.each(kinds)('%s names no URL and no domain', (kind) => {
		/*
		  The allowed list is the inventory of every site a project embeds on;
		  whoever is looking at someone else's broken embed should not be handed
		  it, or any address at all.
		*/
		const { heading, description } = EMBED_ERROR_COPY[kind]
		const text = `${heading} ${description}`
		expect(text).not.toMatch(/https?:\/\//)
		expect(text).not.toMatch(/\b[a-z0-9-]+\.(com|io|dev|co)\b/i)
	})

	describe('domain_not_allowed', () => {
		const { heading, description } = EMBED_ERROR_COPY.domain_not_allowed

		it('says a decision was made, not that something broke', () => {
			expect(heading).toMatch(/not allowed to show this embed/i)
		})

		it('says the key is valid, so nobody rotates a working key', () => {
			expect(description).toMatch(/key is valid/i)
		})

		it('names the fix and where to make it', () => {
			expect(description).toMatch(/allowed domains/i)
		})
	})
})
