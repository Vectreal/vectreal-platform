import { lstatSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

import { isPaidPlan, PURCHASABLE_PLANS } from '../app/constants/plan-config'

import type { Plan } from '../app/constants/plan-config'

/*
  Lives in tests/ rather than beside plan-config, and imports the full path,
  because it guards the validator the checkout route calls. A colocated spec
  reads as unguarded to critical-path.spec.ts.
*/

/*
  Total, so a fifth plan cannot be added to `Plan` without this failing to
  compile. Written as a Record and then read back for the same reason
  `PURCHASABLE` is: a hand-written array would go on compiling while silently
  no longer covering every plan, and then the loops below would quietly test
  less than they claim.
*/
const EVERY_PLAN = Object.keys({
	free: true,
	pro: true,
	business: true,
	enterprise: true
} satisfies Record<Plan, true>) as readonly Plan[]

describe('which plans can be bought', () => {
	/*
	  Mutation gate, verified: rewrite isPaidPlan to decide for itself, say
	  `value === 'pro'` instead of reading PURCHASABLE_LOOKUP, and this goes red.

	  What it does NOT test, despite how it reads: the list and the predicate are
	  not independent halves. PURCHASABLE_LOOKUP is built from PURCHASABLE_PLANS,
	  so this reduces to an identity of the Set constructor and no change to the
	  plan data can redden it. Its value is narrow and real: it catches the two
	  coming apart, which is the wiring mistake that produced fourteen
	  restatements in the first place. "Sells exactly Pro and Business" is the
	  one that notices the contents changing.
	*/
	it('the predicate answers from the list, for every plan that exists', () => {
		for (const plan of EVERY_PLAN) {
			const listed = PURCHASABLE_PLANS.some((paid) => paid === plan)
			expect(isPaidPlan(plan)).toBe(listed)
		}
	})

	/*
	  Mutation gate, verified: drop `business: true` from PURCHASABLE and this
	  goes red.

	  This is also the only thing standing between checkout and an `enterprise`
	  that leaked in through a spread or an intermediate variable, since excess
	  property checking stops applying the moment PURCHASABLE stops being a fresh
	  annotated literal. plan-config says so at the declaration.
	*/
	it('sells exactly Pro and Business', () => {
		expect([...PURCHASABLE_PLANS]).toEqual(['pro', 'business'])
	})

	it('refuses the two plans checkout cannot sell', () => {
		expect(isPaidPlan('free')).toBe(false)
		expect(isPaidPlan('enterprise')).toBe(false)
	})

	/*
	  The list is frozen, because `readonly` is erased at runtime. Without this a
	  caller could push onto it and leave the list and the Set disagreeing.

	  Mutation gate, verified: drop the Object.freeze in plan-config and this
	  goes red.
	*/
	it('cannot be mutated by a caller', () => {
		expect(Object.isFrozen(PURCHASABLE_PLANS)).toBe(true)
	})

	/*
	  The regression test for the hole #878 closed on the canceled page.

	  `?plan=toString` used to find a truthy label because every object inherits
	  toString, so a cast plus `?? null` looked like a guard and was not one. The
	  owner must not reintroduce it one layer down, which is why isPaidPlan reads
	  a Set rather than using `in` or a property access.

	  Mutation gate, verified: change PURCHASABLE_LOOKUP.has(value) to `value in
	  PURCHASABLE` and all six of these go red.
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
})

/*
  The guard that keeps this a single source of truth.

  Fourteen places restated the pair before this module existed, and three of
  them carried a comment saying they mirrored one of the others. Type-checking
  cannot catch a fifteenth: `plan === 'pro' || plan === 'business'` compiles
  perfectly. Only reading the source does.

  WHAT THIS DOES NOT COVER, so nobody reads it as a proof it is not:

  - Unquoted keys. `interface X { pro: T; business: T }` states the pair and no
    regex here can tell it from any other object. That shape is held instead by
    typing such maps as `Record<PaidPlan, T>`, which is what
    `BillingCheckoutOptions` and `PLAN_FALLBACK_PRICES` now do.
  - The complement. `Exclude<Plan, 'free' | 'enterprise'>` is the same set with
    neither word in it.
  - `.mdx` route modules, `*.spec.ts`, and anything outside `app/`. Spec files
    are excluded deliberately: fixtures legitimately name both plans.

  Mutation gate, verified: add `const X: 'pro' | 'business' = 'pro'` to any
  non-spec .ts or .tsx module under app/ other than plan-config, and this goes
  red naming that file.
*/

const APP_DIR = join(__dirname, '..', 'app')

const OWNER = 'app/constants/plan-config.ts'

/*
  The four-plan ladder is a different fact - every plan, in order - and several
  modules state it legitimately.

  The gaps are bounded rather than forbidden, because the ladder is written both
  as a literal sequence and as a chain of comparisons, and Prettier wraps the
  latter across lines at 80 columns. `asPlan` in `billing-limit-error.ts` is the
  live example. An earlier version of this file only stripped the literal form
  while the comparison pattern below hunted comparisons, so a correct ladder
  check sat one rename away from being reported as a restatement.
*/
const FULL_LADDER =
	/'free'[\s\S]{0,80}?'pro'[\s\S]{0,80}?'business'[\s\S]{0,80}?'enterprise'/g

interface Restatement {
	readonly name: string
	readonly pattern: RegExp
	/** A sample that must match, so the pattern is proved able to fire. */
	readonly example: string
}

const RESTATEMENTS: readonly Restatement[] = [
	{
		name: "a list literal, ['pro', 'business']",
		pattern: /\[\s*'pro'\s*,\s*'business'\s*[,\]]/,
		example: "const ALLOWED = new Set(['pro', 'business'])"
	},
	{
		name: "a list literal in reverse, ['business', 'pro']",
		pattern: /\[\s*'business'\s*,\s*'pro'\s*[,\]]/,
		example: "const ALLOWED: Plan[] = ['business', 'pro']"
	},
	{
		name: "a type union, 'pro' | 'business'",
		pattern: /'pro'\s*\|\s*'business'/,
		example: "function f(): 'pro' | 'business' | null { return null }"
	},
	{
		name: "a type union in reverse, 'business' | 'pro'",
		pattern: /'business'\s*\|\s*'pro'/,
		example: "let p: 'business' | 'pro'"
	},
	{
		name: "a pair of comparisons, === 'pro' ... === 'business'",
		pattern: /===\s*'pro'[\s\S]{0,80}?===\s*'business'/,
		example:
			"const ok =\n\tsubscription.plan === 'pro' ||\n\tsubscription.plan === 'business'"
	},
	{
		name: "a pair of comparisons in reverse, === 'business' ... === 'pro'",
		pattern: /===\s*'business'[\s\S]{0,80}?===\s*'pro'/,
		example: "const ok = plan === 'business' || plan === 'pro'"
	},
	{
		name: 'switch cases falling through pro into business',
		pattern: /case\s*'pro'\s*:[\s\S]{0,40}?case\s*'business'\s*:/,
		example: "switch (p) {\n\tcase 'pro':\n\tcase 'business':\n\t\treturn true\n}"
	}
]

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		if (entry === 'node_modules') return []

		const full = join(dir, entry)

		/*
		  lstat, so a symlinked directory is not recursed into. statSync follows
		  links, which would loop forever on a cycle and throw ENOENT on a broken
		  one, taking this spec down with an error instead of a verdict.
		*/
		const stats = lstatSync(full)
		if (stats.isSymbolicLink()) return []
		if (stats.isDirectory()) return sourceFiles(full)

		return /\.(tsx?|mts|cts)$/.test(entry) && !/\.spec\.tsx?$/.test(entry)
			? [full]
			: []
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
	  Every pattern carries its own example and is checked against it, so a
	  pattern added to the list is tested by construction. The previous version
	  walked a separate samples array and indexed into this one positionally: a
	  fourth pattern that could never match anything would have stayed green,
	  which is the defect this whole file exists to prevent.
	*/
	it.each(RESTATEMENTS.map((r) => [r.name, r] as const))(
		'the pattern for %s can actually fire',
		(_name, restatement) => {
			expect(restatement.pattern.test(restatement.example)).toBe(true)
		}
	)

	it('exempts the full plan ladder, written either way', () => {
		const ladders = [
			"const PLANS: Plan[] = ['free', 'pro', 'business', 'enterprise']",
			"type Plan = 'free' | 'pro' | 'business' | 'enterprise'",
			"if (\n\tvalue === 'free' ||\n\tvalue === 'pro' ||\n\tvalue === 'business' ||\n\tvalue === 'enterprise'\n) {"
		]

		for (const ladder of ladders) {
			const stripped = ladder.replace(FULL_LADDER, '')
			const fired = RESTATEMENTS.filter(({ pattern }) => pattern.test(stripped))

			expect(
				fired.map(({ name }) => name),
				`The ladder "${ladder.slice(0, 40)}..." was read as a restatement`
			).toEqual([])
		}
	})
})
