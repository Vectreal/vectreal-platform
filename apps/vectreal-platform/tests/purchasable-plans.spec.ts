import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
	isPaidPlan,
	PURCHASABLE_PLANS
} from '../app/constants/plan-config'

import type { Plan } from '../app/constants/plan-config'

/*
  Lives in tests/ rather than beside plan-config, and imports the full path,
  because it guards the validator the checkout route calls. A colocated spec
  reads as unguarded to critical-path.spec.ts.
*/

const EVERY_PLAN: readonly Plan[] = ['free', 'pro', 'business', 'enterprise']

describe('which plans can be bought', () => {
	/*
	  The invariant between the two halves, not each half on its own: the list
	  callers iterate and the predicate callers validate with must answer the
	  same question for every plan that exists.

	  Mutation gate, verified: rewrite isPaidPlan to decide for itself, say
	  `value === 'pro'` instead of reading PURCHASABLE_LOOKUP, and this goes red.

	  Removing a plan from PURCHASABLE does NOT break it, and should not: both
	  halves derive from that record, so they cannot disagree about its contents.
	  What this catches is the two halves coming apart, which is how the fourteen
	  restatements accumulated in the first place. "Sells exactly Pro and
	  Business" below is the one that notices the contents changing.
	*/
	it('the list and the predicate agree on every plan', () => {
		for (const plan of EVERY_PLAN) {
			const listed = PURCHASABLE_PLANS.some((paid) => paid === plan)
			expect(isPaidPlan(plan)).toBe(listed)
		}
	})

	/*
	  Mutation gate, verified: drop `business: true` from PURCHASABLE and this
	  goes red.
	*/
	it('sells exactly Pro and Business', () => {
		expect([...PURCHASABLE_PLANS]).toEqual(['pro', 'business'])
	})

	it('refuses the two plans checkout cannot sell', () => {
		expect(isPaidPlan('free')).toBe(false)
		expect(isPaidPlan('enterprise')).toBe(false)
	})

	/*
	  The regression test for the hole #878 closed on the canceled page.

	  `?plan=toString` used to find a truthy label because every object inherits
	  toString, so a cast plus `?? null` looked like a guard and was not one. The
	  owner must not reintroduce it one layer down, which is why isPaidPlan reads
	  a Set rather than using `in` or a property access.

	  Mutation gate, verified: change PURCHASABLE_LOOKUP.has(value) to `value in
	  PURCHASABLE` and six of these go red.
	*/
	it.each([
		'toString',
		'constructor',
		'hasOwnProperty',
		'valueOf',
		'__proto__',
		'isPrototypeOf'
	])('does not treat %s as a plan', (inherited) => {
		expect(isPaidPlan(inherited)).toBe(false)
	})

	it('refuses values that are not strings at all', () => {
		for (const value of [null, undefined, 0, 1, {}, [], true]) {
			expect(isPaidPlan(value)).toBe(false)
		}
	})
})

/*
  The guard that keeps this a single source of truth.

  Fourteen places restated the pair before this module existed, and three of
  them carried a comment saying they mirrored one of the others. Type-checking
  cannot catch a fifteenth: `plan === 'pro' || plan === 'business'` compiles
  perfectly. Only reading the source does.

  Mutation gate, verified: add `const X: 'pro' | 'business' = 'pro'` to any
  module under app/ and this goes red naming that file.
*/

const APP_DIR = join(__dirname, '..', 'app')

/*
  plan-config declares the pair once, which is the point. Everything else must
  derive from it.
*/
const OWNER = 'app/constants/plan-config.ts'

/*
  'free' | 'pro' | 'business' | 'enterprise' is a different fact - the whole
  ladder, in order - and several modules legitimately state it. Removed before
  looking for the pair, so the ladder does not read as a restatement.
*/
const FULL_LADDER =
	/'free'\s*[,|]\s*'pro'\s*[,|]\s*'business'\s*[,|]\s*'enterprise'/g

const RESTATEMENTS: readonly { name: string; pattern: RegExp }[] = [
	{ name: "a list literal, ['pro', 'business']", pattern: /'pro'\s*,\s*'business'/ },
	{ name: "a type union, 'pro' | 'business'", pattern: /'pro'\s*\|\s*'business'/ },
	{
		name: "a pair of comparisons, === 'pro' || === 'business'",
		pattern: /===\s*'pro'\s*\|\|[^\n]*===\s*'business'/
	}
]

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const full = join(dir, entry)
		if (statSync(full).isDirectory()) return sourceFiles(full)
		return /\.tsx?$/.test(entry) && !/\.spec\.tsx?$/.test(entry) ? [full] : []
	})
}

describe('nothing restates which plans can be bought', () => {
	it('finds the restatement only in the module that owns it', () => {
		const offenders: string[] = []

		for (const file of sourceFiles(APP_DIR)) {
			const path = relative(join(__dirname, '..'), file).replace(/\\/g, '/')
			if (path === OWNER) continue

			const source = readFileSync(file, 'utf8').replace(FULL_LADDER, '')

			for (const { name, pattern } of RESTATEMENTS) {
				if (pattern.test(source)) {
					offenders.push(`${path} restates it as ${name}`)
				}
			}
		}

		expect(
			offenders,
			`Import isPaidPlan or PURCHASABLE_PLANS from ${OWNER} instead:\n${offenders.join('\n')}`
		).toEqual([])
	})

	/*
	  The guard has to be able to fail, or it is decoration. This proves the
	  patterns match what they claim to, without waiting for someone to
	  reintroduce the defect.
	*/
	it('recognises each shape the pair was written in', () => {
		const samples = [
			"const ALLOWED_PLANS = new Set(['pro', 'business'])",
			"function f(): 'pro' | 'business' | null { return null }",
			"const ok = plan === 'pro' || plan === 'business'"
		]

		samples.forEach((sample, index) => {
			expect(RESTATEMENTS[index].pattern.test(sample)).toBe(true)
		})
	})

	it('does not mistake the full plan ladder for the pair', () => {
		const ladder =
			"const PLANS: Plan[] = ['free', 'pro', 'business', 'enterprise']"
		const stripped = ladder.replace(FULL_LADDER, '')

		expect(RESTATEMENTS.some(({ pattern }) => pattern.test(stripped))).toBe(
			false
		)
	})
})
