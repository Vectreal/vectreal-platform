// @vitest-environment jsdom
/**
 * What a refused embed says, and what it must not say.
 *
 * The second half is the load-bearing one. This is the only refusal on the
 * embed route that explains itself, and it is allowed to because it is reached
 * only after a live key matched the project - the caller has already proved
 * they hold it. Everything it adds beyond that is a disclosure to whoever
 * happens to be looking at someone else's broken page.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EmbedRefusal } from './embed-refusal'

describe('EmbedRefusal', () => {
	it('says the site is not allowed, not that something went wrong', () => {
		/*
		  The whole point. Before this the viewer booted and showed "Unable to Load
		  Scene Preview" - a message that describes a fault, for a server that made
		  a decision.
		*/
		render(<EmbedRefusal reason="domain_not_allowed" />)

		expect(screen.getByText(/not allowed to show this embed/i)).not.toBeNull()
		expect(screen.queryByText(/unable to load/i)).toBeNull()
	})

	it('names the fix and where to make it', () => {
		render(<EmbedRefusal reason="domain_not_allowed" />)

		expect(screen.getByText(/allowed domains/i)).not.toBeNull()
	})

	it('says the key is valid, so nobody rotates a working key', () => {
		/*
		  Without this the obvious reading of a refused embed is "the key is
		  broken", and the obvious action is to rotate it - which refuses the old
		  secret everywhere else it is deployed and fixes nothing here.
		*/
		render(<EmbedRefusal reason="domain_not_allowed" />)

		expect(screen.getByText(/key is valid/i)).not.toBeNull()
	})

	it('never echoes the allowed domain list back', () => {
		/*
		  The list is the inventory of every site this project embeds on. The owner
		  can already read it where they would go to change it; an unknown visitor
		  looking at someone else's broken page should not be handed it.
		*/
		const { container } = render(<EmbedRefusal reason="domain_not_allowed" />)

		expect(container.textContent).not.toMatch(/https?:\/\//)
		expect(container.textContent).not.toMatch(
			/\b[a-z0-9-]+\.(com|io|dev|co)\b/i
		)
	})

	it('offers no navigation, because there is nowhere to go inside an iframe', () => {
		/*
		  The panel this replaces had Retry and Go Back. Retry re-ran a request the
		  server had already decided, and `history.back()` in an iframe moves the
		  frame, not the page - so both looked like recovery and were not.
		*/
		render(<EmbedRefusal reason="domain_not_allowed" />)

		expect(screen.queryByRole('button')).toBeNull()
		expect(screen.queryByRole('link')).toBeNull()
	})
})

describe('which refusals the embed route explains', () => {
	/*
	  Read from source rather than driven through the loader, which reaches
	  `getDbClient()` on import and cannot be loaded without a database. The
	  invariant is about which branches say what, and that is visible in the text.
	*/
	const layout = readFileSync(
		join(
			dirname(fileURLToPath(import.meta.url)),
			'../../routes/layouts/embed-layout.tsx'
		),
		'utf8'
	)

	it('explains only the domain refusal', () => {
		expect(layout).toContain("reason: 'domain_not_allowed'")
	})

	it('keeps every other refusal a flat, identical 404', () => {
		/*
		  Three branches answer 404: no credential, a token that matched nothing,
		  and a scene that is not published. They must stay indistinguishable -
		  telling them apart tells an unknown visitor whether a scene id exists,
		  which is the id-oracle the architecture rules refuse.

		  So: exactly one `notFound` string in this file, used by all three.
		*/
		const messages = [
			...layout.matchAll(/ApiResponse\.notFound\(([^)]*)\)/g)
		].map((match) => match[1].trim())

		expect(messages.length).toBeGreaterThan(1)
		expect(new Set(messages).size).toBe(1)
	})

	it('does not turn the rate limit into an explanation either', () => {
		// A 429 says how many, never whose key or which project.
		expect(layout).toContain("ApiResponse.error('Too many requests', 429)")
	})
})
