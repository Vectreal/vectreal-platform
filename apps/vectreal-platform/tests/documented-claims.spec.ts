import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * Executes the factual claims that documentation makes about this repository.
 *
 * The skills in `.agents/skills/` tell an agent which function to call, which
 * token holds the brand colour, and which invariants hold. Those are assertions
 * about code, written in prose, in a file no compiler reads. They rot silently,
 * and a rotted one is worse than no skill at all: on 2026-08-22 the architecture
 * skill still said "reuse RLS helpers where access checks are required", in a
 * codebase where `db/client.ts` never issues `set local role`, so every policy is
 * bypassed and that advice generates security holes.
 *
 * Public docs fail the same way, and worse, because an agent reads them as
 * ground truth while planning. `docs/guides/publish-embed` listed
 * `*.example.com` as a supported allowed-domain pattern from the day the feature
 * was written, and no wildcard could be saved at all until #737. A plan built on
 * that page was wrong before implementation started.
 *
 * So each file carries a claims block, and this spec runs it. The
 * claim and the prose that depends on it live in the same file, which is the
 * point: they cannot drift apart, because there is only one artifact. Renaming
 * `assertDashboardPermission` fails here and names the skill that has to change.
 *
 * Grammar, one claim per line:
 *
 *     exists   <path>
 *     present  <path>  <literal, rest of line>
 *     absent   <path>  <literal, rest of line>
 *
 * Paths are relative to the repository root. Literals are matched verbatim, not
 * as patterns, so a claim cannot accidentally widen into something that always
 * passes.
 *
 * Markdown carries the block as a ```claims fence. MDX cannot: it is compiled as
 * JSX, raw HTML comments are not valid outside a code fence, and a visible fence
 * would render the block to readers on the public docs site. MDX therefore uses
 * an expression comment, `{/* claims ... *\/}`, which compiles away.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const SKILLS_DIR = join(REPO_ROOT, '.agents/skills')

type Claim = {
	op: 'exists' | 'present' | 'absent'
	path: string
	literal: string
	line: number
}

const BLOCK_START = /^(?:```claims|\{\/\*\s*claims)\s*$/
const BLOCK_END = /^(?:```|\*\/\})\s*$/

function parseClaims(markdown: string): Claim[] {
	const claims: Claim[] = []
	const lines = markdown.split('\n')
	let inBlock = false

	lines.forEach((raw, index) => {
		const line = raw.trim()

		if (!inBlock && BLOCK_START.test(line)) {
			inBlock = true
			return
		}
		if (inBlock && BLOCK_END.test(line)) {
			inBlock = false
			return
		}
		if (!inBlock || line === '' || line.startsWith('#')) return

		const [op, path, ...rest] = line.split(/\s+/)
		if (op !== 'exists' && op !== 'present' && op !== 'absent') {
			throw new Error(`Unknown claim op "${op}" on line ${index + 1}`)
		}
		claims.push({ op, path, literal: rest.join(' '), line: index + 1 })
	})

	return claims
}

const skillFiles = readdirSync(SKILLS_DIR)
	.filter((name) => existsSync(join(SKILLS_DIR, name, 'SKILL.md')))
	.map((name) => `.agents/skills/${name}/SKILL.md`)

/**
 * Docs required to carry at least one claim.
 *
 * A ratchet rather than "every doc": most pages have nothing mechanically
 * checkable, and demanding a block everywhere would produce filler. Adding a
 * page here is a visible diff, and so is removing one.
 */
const CLAIM_CARRYING_DOCS = [
	'apps/vectreal-platform/app/routes/docs/guides/publish-embed.mdx',
	/*
	  The SDK page's Security section makes the load-bearing claims about what a
	  preview key is: that it rides in the iframe `src`, that `Bearer` is the
	  server-side alternative, that the allowed-domain list lives on the project
	  and not on the key, that the app's own host is exempt from it, and that the
	  editor payload is refused to a key. Each of those is a sentence a reader
	  acts on, and each has a line of code that decides it.
	*/
	'apps/vectreal-platform/app/routes/docs/guides/embed-sdk.mdx'
]

const documentFiles = [...skillFiles, ...CLAIM_CARRYING_DOCS]

describe('documented claims', () => {
	it('finds the skills directory and at least one skill', () => {
		expect(skillFiles.length).toBeGreaterThan(0)
	})

	describe.each(documentFiles)('%s', (documentPath) => {
		const markdown = readFileSync(join(REPO_ROOT, documentPath), 'utf8')
		const claims = parseClaims(markdown)
		const documentName = documentPath.split('/').slice(-2).join('/')

		/*
		  Without this, a skill whose claims block was deleted or renamed would
		  pass by asserting nothing at all - which is the exact failure mode the
		  delivery skill calls "the tautological assertion".
		*/
		it('declares at least one checkable claim', () => {
			expect(claims.length).toBeGreaterThan(0)
		})

		it.each(
			claims.map(
				(claim) =>
					[`${claim.op} ${claim.path} ${claim.literal}`.trim(), claim] as const
			)
		)('%s', (_label, claim) => {
			const target = join(REPO_ROOT, claim.path)

			expect(
				existsSync(target),
				`${documentName} line ${claim.line}: ${claim.path} does not exist`
			).toBe(true)

			if (claim.op === 'exists') return

			const contents = readFileSync(target, 'utf8')

			if (claim.op === 'present') {
				expect(
					contents.includes(claim.literal),
					`${documentName} line ${claim.line} claims ${claim.path} contains "${claim.literal}". It does not. Fix the code, or fix the documentation.`
				).toBe(true)
			} else {
				expect(
					contents.includes(claim.literal),
					`${documentName} line ${claim.line} claims ${claim.path} does NOT contain "${claim.literal}". It does. The reasoning behind that page may no longer hold.`
				).toBe(false)
			}
		})
	})
})
