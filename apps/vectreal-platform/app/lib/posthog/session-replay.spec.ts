import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { isSessionReplayExcludedPath } from './session-replay'

describe('isSessionReplayExcludedPath', () => {
	it('refuses replay on an embed, whose URL carries the API key', () => {
		expect(isSessionReplayExcludedPath('/embed/395a09f0/488bd4a1')).toBe(true)
	})

	it('refuses replay on the bare /embed path', () => {
		expect(isSessionReplayExcludedPath('/embed')).toBe(true)
	})

	it('leaves a path that only starts with the same letters alone', () => {
		expect(isSessionReplayExcludedPath('/embedded')).toBe(false)
	})

	it('leaves every other page to the project setting', () => {
		expect(isSessionReplayExcludedPath('/')).toBe(false)
		expect(isSessionReplayExcludedPath('/preview/p/s')).toBe(false)
		expect(isSessionReplayExcludedPath('/docs/guides/embed-sdk')).toBe(false)
	})
})

/*
  The rule is useless unless `posthog.init` reads it, and `entry.client.tsx`
  runs `posthog.init` at module scope against browser globals, so it cannot be
  imported here.
*/
describe('posthog init uses it', () => {
	const entryClient = readFileSync(
		join(import.meta.dirname, '..', '..', 'entry.client.tsx'),
		'utf8'
	)

	it('disables recording from the page path', () => {
		expect(entryClient).toMatch(
			/disable_session_recording:\s*isSessionReplayExcludedPath\(\s*window\.location\.pathname\s*\)/
		)
	})
})
