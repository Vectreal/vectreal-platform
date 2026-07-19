import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
	CACHEABLE_PUBLIC_PATH_LIST,
	CACHEABLE_PUBLIC_PATH_PREFIXES
} from '../app/lib/http/cacheable-public-paths.server'

// apps/vectreal-platform/tests/ -> repo root is three levels up.
// The relative path is kept in a variable (not inlined) so Vite's static
// `new URL('literal', import.meta.url)` asset-URL transform does not rewrite
// it into a dev-server asset URL instead of a real file:// URL.
const relativeTfPath = '../../../terraform/cloudflare.tf'
const tfPath = fileURLToPath(new URL(relativeTfPath, import.meta.url))
const tf = readFileSync(tfPath, 'utf8')

// The cache-rule expression is itself a single HCL double-quoted string, so
// every literal `"` inside it (path literals, the starts_with prefix arg)
// is backslash-escaped in the file on disk (`\"/\"`, not `"/"`). Matchers
// below search for the escaped form to reflect what's actually written.
const quoted = (value: string) => `\\"${value}\\"`

describe('Cloudflare cache ruleset parity with the TS allowlist', () => {
	it('references every exact allowlist path in the Terraform config', () => {
		const missing = CACHEABLE_PUBLIC_PATH_LIST.filter(
			(p) => !tf.includes(quoted(p))
		)
		expect(missing, `paths missing from cloudflare.tf: ${missing.join(', ')}`).toEqual(
			[]
		)
	})

	it('references the .data variant of every non-root exact allowlist path', () => {
		// Root "/" is requested as "/.data"; others as "<path>.data".
		const dataVariants = CACHEABLE_PUBLIC_PATH_LIST
			// Prefix-covered and crawl files are matched by starts_with / need no .data literal.
			.filter((p) => !['/robots.txt', '/sitemap.xml', '/llms.txt'].includes(p))
			.map((p) => (p === '/' ? '/.data' : `${p}.data`))
		const missing = dataVariants.filter((p) => !tf.includes(quoted(p)))
		expect(
			missing,
			`.data variants missing from cloudflare.tf: ${missing.join(', ')}`
		).toEqual([])
	})

	it('references every prefix rule in the Terraform config', () => {
		const missing = CACHEABLE_PUBLIC_PATH_PREFIXES.filter(
			(prefix) =>
				!tf.includes(`starts_with(http.request.uri.path, ${quoted(prefix)})`)
		)
		expect(
			missing,
			`prefixes missing from cloudflare.tf: ${missing.join(', ')}`
		).toEqual([])
	})
})
