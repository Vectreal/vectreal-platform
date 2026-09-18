/**
 * A caller-supplied `next` is resolved by the whitelist, always.
 *
 * `getSafeNextPath` is the only answer to "may this request send the visitor
 * here". The rule is a ratchet rather than a convention because the wrong
 * version is the obvious one: `next.startsWith('/')` reads as a same-origin
 * check and is not one. `//evil.com/x` passes it, and a `Location` header or an
 * `<a href>` carrying that value sends the browser to `https://evil.com/x`.
 *
 * Both auth pages shipped that check. The sign-in loader applied it to an
 * already-signed-in visitor, so a link to
 * `vectreal.com/sign-in?next=//evil.com/x` bounced off-site with no interaction
 * at all, and the sign-in and sign-up pages rendered the same raw value inside a
 * button labelled "Open Publisher to restore draft".
 *
 * Route modules are hard to reach from a test, so the guarantee is asserted over
 * the source: read the parameter and you must also resolve it.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

const APP = join(import.meta.dirname, '..', 'app')

/** Reads a `next` request parameter, in any of the spellings used here. */
const READS_NEXT =
	/(?:searchParams|URLSearchParams\([^)]*\))\s*(?:\)\s*)?\.get\(\s*['"]next['"]\s*\)/

const RESOLVER = 'getSafeNextPath'

/**
 * The one file that reads `next` without resolving it, and why.
 *
 * `signin-layout` is a client component, so it cannot import a `.server.ts`
 * module at all. Its value is never rendered as an href and never becomes a
 * `Location`: it is appended to a form body as `backURL` and posted to
 * `/api/auth/social-signin`, which rebuilds it through `new URL(value, origin)`
 * and keeps only the path, so a host in the input is discarded there. The
 * destination is then resolved by `getSafeNextPath` in `api/auth/callback.ts`
 * before any redirect happens.
 */
const MAY_READ_RAW = ['routes/layouts/signin-layout.tsx']

function sourceFiles(dir: string, found: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name)
		if (entry.isDirectory()) sourceFiles(full, found)
		else if (/\.tsx?$/.test(entry.name) && !/\.spec\.tsx?$/.test(entry.name))
			found.push(full)
	}
	return found
}

/**
 * Every read site, not every file.
 *
 * A file-level check would pass a module that resolves `next` once and reads it
 * raw somewhere else - which is exactly the shape both auth pages had, where the
 * action resolved it and the loader did not.
 */
function rawReadsIn(source: string): string[] {
	const raw: string[] = []

	for (const line of source.split('\n')) {
		if (!READS_NEXT.test(line)) continue
		if (line.includes(`${RESOLVER}(`)) continue

		const assigned = /(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/.exec(line)?.[1]
		if (assigned && source.includes(`${RESOLVER}(${assigned})`)) continue

		raw.push(line.trim())
	}

	return raw
}

describe('safe-next redirect ratchet', () => {
	const offenders = sourceFiles(APP)
		.map((file) => ({
			file: relative(APP, file),
			raw: rawReadsIn(readFileSync(file, 'utf8'))
		}))
		.filter(({ file, raw }) => raw.length > 0 && !MAY_READ_RAW.includes(file))

	it('resolves every caller-supplied next through the whitelist', () => {
		expect(offenders).toEqual([])
	})

	it('still finds the files it is meant to be watching', () => {
		const readers = sourceFiles(APP)
			.filter((file) => READS_NEXT.test(readFileSync(file, 'utf8')))
			.map((file) => relative(APP, file))

		// A regex that matched nothing would make the assertion above vacuous.
		expect(readers).toContain('routes/signin-page/signin-page.tsx')
		expect(readers).toContain('routes/signup-page/signup-page.tsx')
		expect(readers).toContain('routes/api/auth/callback.ts')
	})
})
