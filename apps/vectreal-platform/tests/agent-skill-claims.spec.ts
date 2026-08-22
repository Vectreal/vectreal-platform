import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * Executes the factual claims the agent skills make about this repository.
 *
 * The skills in `.agents/skills/` tell an agent which function to call, which
 * token holds the brand colour, and which invariants hold. Those are assertions
 * about code, written in prose, in a file no compiler reads. They rot silently,
 * and a rotted one is worse than no skill at all: on 2026-08-22 the architecture
 * skill still said "reuse RLS helpers where access checks are required", in a
 * codebase where `db/client.ts` never issues `set local role`, so every policy is
 * bypassed and that advice generates security holes.
 *
 * So each SKILL.md carries a fenced ```claims block, and this spec runs it. The
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
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const SKILLS_DIR = join(REPO_ROOT, '.agents/skills')

type Claim = {
	op: 'exists' | 'present' | 'absent'
	path: string
	literal: string
	line: number
}

function parseClaims(markdown: string): Claim[] {
	const claims: Claim[] = []
	const lines = markdown.split('\n')
	let inBlock = false

	lines.forEach((raw, index) => {
		const line = raw.trim()

		if (line.startsWith('```claims')) {
			inBlock = true
			return
		}
		if (inBlock && line.startsWith('```')) {
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

const skillNames = readdirSync(SKILLS_DIR).filter((name) =>
	existsSync(join(SKILLS_DIR, name, 'SKILL.md'))
)

describe('agent skill claims', () => {
	it('finds the skills directory and at least one skill', () => {
		expect(skillNames.length).toBeGreaterThan(0)
	})

	describe.each(skillNames)('%s', (skillName) => {
		const skillPath = join(SKILLS_DIR, skillName, 'SKILL.md')
		const markdown = readFileSync(skillPath, 'utf8')
		const claims = parseClaims(markdown)

		/*
		  Without this, a skill whose claims block was deleted or renamed would
		  pass by asserting nothing at all - which is the exact failure mode the
		  delivery skill calls "the tautological assertion".
		*/
		it('declares at least one checkable claim', () => {
			expect(claims.length).toBeGreaterThan(0)
		})

		it.each(claims.map((claim) => [`${claim.op} ${claim.path} ${claim.literal}`.trim(), claim] as const))(
			'%s',
			(_label, claim) => {
				const target = join(REPO_ROOT, claim.path)

				expect(
					existsSync(target),
					`${skillName}/SKILL.md line ${claim.line}: ${claim.path} does not exist`
				).toBe(true)

				if (claim.op === 'exists') return

				const contents = readFileSync(target, 'utf8')

				if (claim.op === 'present') {
					expect(
						contents.includes(claim.literal),
						`${skillName}/SKILL.md line ${claim.line} claims ${claim.path} contains "${claim.literal}". It does not. Fix the code or fix the skill.`
					).toBe(true)
				} else {
					expect(
						contents.includes(claim.literal),
						`${skillName}/SKILL.md line ${claim.line} claims ${claim.path} does NOT contain "${claim.literal}". It does. The skill's reasoning may no longer hold.`
					).toBe(false)
				}
			}
		)
	})
})
