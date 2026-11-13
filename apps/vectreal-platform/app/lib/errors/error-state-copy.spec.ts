import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { UNSAFE_ErrorResponseImpl as ErrorResponseImpl } from 'react-router'
import { describe, expect, it } from 'vitest'

import {
	domainNotAllowedDescription,
	EMBED_ALLOWED_DOMAINS_GUIDE,
	EMBED_ERROR_COPY,
	embedErrorKind,
	type EmbedErrorKind,
	embedRefusedHost,
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
		[response(400), 'request_refused'],
		[response(410), 'request_refused'],
		[response(429), 'request_refused'],
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

describe('embedRefusedHost', () => {
	it('reads the host a domain refusal named', () => {
		expect(
			embedRefusedHost(
				response(403, { reason: 'domain_not_allowed', host: 'shop.test' })
			)
		).toBe('shop.test')
	})

	it.each([
		[
			'a domain refusal with no host',
			response(403, { reason: 'domain_not_allowed', host: null })
		],
		[
			'any other refusal',
			response(404, { reason: 'not_available', host: 'shop.test' })
		],
		['a bare 403', response(403, { host: 'shop.test' })],
		['an exception', new Error('boom')]
	])('reads nothing from %s', (_, error) => {
		expect(embedRefusedHost(error)).toBeNull()
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
		  it, or any address but the guide's, which is the same for everyone.
		*/
		const { heading, description } = EMBED_ERROR_COPY[kind]
		const text = `${heading} ${description}`.replace(
			EMBED_ALLOWED_DOMAINS_GUIDE,
			''
		)
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

		it('points the guide out either way', () => {
			expect(description).toContain(EMBED_ALLOWED_DOMAINS_GUIDE)
			expect(domainNotAllowedDescription('shop.test')).toContain(
				EMBED_ALLOWED_DOMAINS_GUIDE
			)
		})

		it('sends a host-less refusal to the referrer policy, not the list', () => {
			/*
			  No list entry can match a request that names no host, so telling
			  the owner to add one would send them to a fix that cannot work.
			*/
			expect(description).not.toMatch(/Allowed embed domains in/)
			expect(description).toMatch(/no-referrer/)
		})

		it('names the refused host when there is one', () => {
			const named = domainNotAllowedDescription('shop.example.com')
			expect(named).toMatch(/^shop\.example\.com is not on/)
			expect(named).toMatch(/add shop\.example\.com to Allowed embed domains/)
		})

		it('points at a guide section that exists', () => {
			/*
			  Written out as text, so nothing else notices when the heading is
			  renamed. rehype-slug derives the anchor from the heading.
			*/
			const [path, anchor] = EMBED_ALLOWED_DOMAINS_GUIDE.replace(
				/^vectreal\.com/,
				''
			).split('#')
			expect(path).toBe('/docs/guides/publish-embed')
			const guide = readFileSync(
				join(
					dirname(fileURLToPath(import.meta.url)),
					'../../routes/docs/guides/publish-embed.mdx'
				),
				'utf8'
			)
			const headings = guide
				.split('\n')
				.filter((line) => line.startsWith('## '))
				.map((line) => line.slice(3).trim().toLowerCase().replace(/\s+/g, '-'))
			expect(headings).toContain(anchor)
		})
	})
})
