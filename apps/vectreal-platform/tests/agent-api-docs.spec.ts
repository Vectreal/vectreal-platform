import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { API_ERROR_CODES } from '@vctrl/sdk'
import { describe, expect, it } from 'vitest'

import routes from '../app/routes'

import type { RouteConfigEntry } from '@react-router/dev/routes'

/**
 * The API reference is written by hand, so it is held to the two lists it
 * restates: every error code the SDK knows and every v1 route the app serves.
 * A code or route added without a docs row fails here instead of going
 * undocumented.
 */
const page = readFileSync(
	resolve(__dirname, '../app/routes/docs/agents/api.mdx'),
	'utf8'
)

const paths = (entries: RouteConfigEntry[]): string[] =>
	entries.flatMap((entry) => [
		...(entry.path ? [entry.path] : []),
		...paths(entry.children ?? [])
	])

describe('the API reference', () => {
	it('names every error code the SDK knows', () => {
		for (const code of API_ERROR_CODES) {
			expect(page).toContain(`| \`${code}\` |`)
		}
	})

	it('lists every /api/v1 route the app serves', async () => {
		const v1 = paths(await routes).filter((path) => path.startsWith('api/v1/'))
		expect(v1.length).toBeGreaterThan(0)
		for (const path of v1) {
			// As an endpoint table row, not a mention in the prose.
			const documented = `| \`/${path.replace(/:(\w+)/g, '{$1}')}\` |`
			expect(page).toContain(documented)
		}
	})
})
