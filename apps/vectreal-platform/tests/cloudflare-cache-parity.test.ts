import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
	CDN_PROTECTED_PREFIXES,
	CDN_PUBLIC_EXACT_DATA_VARIANTS,
	CDN_PUBLIC_EXACT_PATHS,
	CDN_PUBLIC_PREFIXES
} from '../app/lib/http/cdn-cache-policy.server'

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
		const missing = CDN_PUBLIC_EXACT_PATHS.filter(
			(p) => !tf.includes(quoted(p))
		)
		expect(
			missing,
			`paths missing from cloudflare.tf: ${missing.join(', ')}`
		).toEqual([])
	})

	it('references the .data variant of every non-root exact allowlist path', () => {
		const missing = CDN_PUBLIC_EXACT_DATA_VARIANTS.filter(
			(p) => !tf.includes(quoted(p))
		)
		expect(
			missing,
			`.data variants missing from cloudflare.tf: ${missing.join(', ')}`
		).toEqual([])
	})

	it('references every prefix rule in the Terraform config', () => {
		const missing = CDN_PUBLIC_PREFIXES.filter(
			(prefix) =>
				!tf.includes(`starts_with(http.request.uri.path, ${quoted(prefix)})`)
		)
		expect(
			missing,
			`prefixes missing from cloudflare.tf: ${missing.join(', ')}`
		).toEqual([])
	})

	it('does not include protected route-family prefixes in the public rule', () => {
		const publicRuleLine = tf
			.split('\n')
			.find((line) =>
				line.includes(
					'description = "Public allowlist pages (GET only) — respect origin cache headers"'
				)
			)
		expect(publicRuleLine).toBeDefined()

		const protectedInPublicRule = CDN_PROTECTED_PREFIXES.filter((prefix) =>
			tf.includes(`starts_with(http.request.uri.path, ${quoted(prefix)})`)
		)
		expect(
			protectedInPublicRule,
			`protected prefixes should not be public-cache allowlisted: ${protectedInPublicRule.join(', ')}`
		).toEqual([])
	})
})
