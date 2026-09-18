import { lstatSync, readdirSync, readFileSync, statSync } from 'node:fs'
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

  That failure surfaces under `nx typecheck`, not `nx test`: Vitest transpiles
  without type-checking, so a fifth plan leaves this file green while it silently
  covers four of five until the other gate runs.
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

  Every pattern below requires the CONNECTIVE that makes the two plans a set:
  a comma inside brackets, a union pipe, a `||`, or a bare case fallthrough.
  Proximity is deliberately not enough. An earlier version allowed up to 80
  characters between the two comparisons, and that flagged four shapes this
  repo already writes, none of which claim the plans form a set:

    const isPro = plan === 'pro'          // per-tier booleans, the idiom in
    const isBusiness = plan === 'business' // pricing-cards-section.tsx

    plan === 'pro' ? 'Pro' : plan === 'business' ? 'Business' : 'Free'

    case 'pro': return PRO_SEATS
    case 'business': return BUSINESS_SEATS

    if (plan === 'pro') { ... } if (route === 'business') { ... }

  The chained ternary is the clearest case. A restatement says the two plans are
  the SAME in some respect; a ternary says they are different and maps each to
  its own value. The remedy this guard demands, "import isPaidPlan", cannot even
  be applied to it, which is the tell that it was never a restatement.

  WHAT THIS DOES NOT COVER, so nobody reads it as proof it is not:

  - Unquoted keys. `interface X { pro: T; business: T }` states the pair and no
    regex here can tell it from any other object. That shape is held instead by
    typing such maps as `Record<PaidPlan, T>`, which is what
    `BillingCheckoutOptions` and `PLAN_FALLBACK_PRICES` now do.
  - The complement. `Exclude<Plan, 'free' | 'enterprise'>` is the same set with
    neither word in it.
  - Comments and string literals, which are read as if they were code.
  - Double-quoted and backtick literals. Prettier's `singleQuote: true` rewrites
    the first into range on every CI run, so that shape is closed by the
    formatter rather than by this guard. Backticks are never normalized.
  - `Array.of('pro', 'business')`, set construction without brackets. Requiring
    the bracket is what keeps an arbitrary two-argument call out, and that trade
    is worth more than this one shape.
  - The ladder written price-descending, and the enterprise-side subset
    `['pro', 'business', 'enterprise']`. Both are flagged although neither is a
    restatement, and both fail the tell: `isPaidPlan` replaces neither.
  - `.mdx` route modules, `*.spec.ts`, and anything outside `app/`. Spec files
    are excluded deliberately: fixtures legitimately name both plans.

  Mutation gate, verified: add `const X: 'pro' | 'business' = 'pro'` to any
  non-spec .ts or .tsx module under app/ other than plan-config, and this goes
  red naming that file.
*/

const APP_DIR = join(__dirname, '..', 'app')

const OWNER = 'app/constants/plan-config.ts'

/**
 * An operand a plan comparison is written against: `plan`,
 * `subscription.plan`, `resolvePlan(org)`.
 *
 * Unbounded in length, and every use below backreferences it so that BOTH
 * comparisons must be against the same expression. That is what makes this a
 * set test rather than two adjacent tests, and it is a far better filter than
 * limiting the distance between them: a bounded gap let `plan === 'pro' ||
 * isTrial) return route === 'business'` through as a match, and simultaneously
 * broke the ladder exemption for the 22 comparisons in `app/` whose operand is
 * longer than 40 characters.
 *
 * No quote, which is load-bearing: the ladder strip is safe to delete a matched
 * region only because no quoted literal can survive inside one, so a
 * restatement cannot hide in an exempted span. No `=`, so an operand cannot
 * swallow the comparison operator that follows it.
 */
const OPERAND = String.raw`[\w.?[\]()!]+`

/*
  The four-plan ladder is a different fact - every plan, in order - and several
  modules state it legitimately. It is removed before the patterns run.

  Two exact alternatives, never a loose gap. The ladder appears both as a
  literal sequence and as a chain of comparisons that Prettier wraps across
  lines, and `asPlan` in `billing-limit-error.ts` is the live example of the
  second. A first repair allowed 80 arbitrary characters between each pair of
  literals, which anchored on the earliest 'free' in a file and could delete
  around 240 characters of unrelated code along with the ladder, hiding any
  restatement inside it. It was already swallowing a function signature in
  `stripe-subscription-sync.server.ts`.
*/
const FULL_LADDER = new RegExp(
	[
		String.raw`'free'\s*[,|]\s*'pro'\s*[,|]\s*'business'\s*[,|]\s*'enterprise'`,
		String.raw`(?<pos>${OPERAND})\s*===\s*'free'\s*\|\|\s*\k<pos>\s*===\s*'pro'\s*\|\|\s*\k<pos>\s*===\s*'business'\s*\|\|\s*\k<pos>\s*===\s*'enterprise'`,
		String.raw`(?<neg>${OPERAND})\s*!==\s*'free'\s*&&\s*\k<neg>\s*!==\s*'pro'\s*&&\s*\k<neg>\s*!==\s*'business'\s*&&\s*\k<neg>\s*!==\s*'enterprise'`
	].join('|'),
	'g'
)

interface Restatement {
	readonly name: string
	readonly pattern: RegExp
	/** A sample that must match, so the pattern is proved able to fire. */
	readonly example: string
}

const RESTATEMENTS: readonly Restatement[] = [
	/*
	  Bracket context, but not necessarily the first two elements: requiring
	  adjacency to the bracket let `['free', 'pro', 'business']` through. The
	  bracket is what keeps a two-argument call, `f('pro', 'business')`, out.
	*/
	{
		name: "a list literal, ['pro', 'business']",
		pattern: /\[[^\]]{0,60}'pro'\s*,\s*'business'/,
		example: "const ALLOWED = new Set(['free', 'pro', 'business'])"
	},
	{
		name: "a list literal in reverse, ['business', 'pro']",
		pattern: /\[[^\]]{0,60}'business'\s*,\s*'pro'/,
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
	/*
	  The `||` is required, not merely allowed. It is what turns two comparisons
	  into a claim that the plans form one set, and its absence is what makes the
	  per-tier booleans above legitimate. The operand between them lets Prettier
	  wrap the line, which it does at 80 columns.
	*/
	{
		name: "a disjunction, === 'pro' || === 'business'",
		pattern: new RegExp(
			String.raw`(?<p>${OPERAND})\s*===\s*'pro'\s*\|\|\s*\k<p>\s*===\s*'business'`
		),
		example:
			"const ok =\n\tsubscription.plan === 'pro' ||\n\tsubscription.plan === 'business'"
	},
	{
		name: "a disjunction in reverse, === 'business' || === 'pro'",
		pattern: new RegExp(
			String.raw`(?<b>${OPERAND})\s*===\s*'business'\s*\|\|\s*\k<b>\s*===\s*'pro'`
		),
		example: "const ok = plan === 'business' || plan === 'pro'"
	},
	/*
	  Whitespace only between the two cases, so this is true fallthrough. Allowing
	  any short body made `case 'pro': return PRO_SEATS` read as a set.
	*/
	{
		name: 'switch cases falling through pro into business',
		pattern: /case\s*'pro'\s*:\s*(?:\/\/[^\n]*\n\s*)*case\s*'business'\s*:/,
		example:
			"switch (p) {\n\tcase 'pro':\n\tcase 'business':\n\t\treturn true\n}"
	},
	{
		name: 'switch cases falling through business into pro',
		pattern: /case\s*'business'\s*:\s*(?:\/\/[^\n]*\n\s*)*case\s*'pro'\s*:/,
		example:
			"switch (p) {\n\tcase 'business':\n\tcase 'pro':\n\t\treturn true\n}"
	},
	/*
	  The same claim negated. `!isPaidPlan(plan)` is a direct replacement, which
	  is the tell that this is a restatement rather than two separate tests, and
	  the repo already writes `!==` plan guards.
	*/
	{
		name: "a negated pair, !== 'pro' && !== 'business'",
		pattern: new RegExp(
			String.raw`(?<np>${OPERAND})\s*!==\s*'pro'\s*&&\s*\k<np>\s*!==\s*'business'`
		),
		example: "if (plan !== 'pro' && plan !== 'business') return null"
	},
	{
		name: "a negated pair in reverse, !== 'business' && !== 'pro'",
		pattern: new RegExp(
			String.raw`(?<nb>${OPERAND})\s*!==\s*'business'\s*&&\s*\k<nb>\s*!==\s*'pro'`
		),
		example: "if (plan !== 'business' && plan !== 'pro') return null"
	}
]

/**
 * The whole verdict for one file's text, so the walker and the tests below
 * exercise the same code rather than two copies of it.
 */
function restatementsIn(source: string): string[] {
	const stripped = source.replace(FULL_LADDER, '')

	return RESTATEMENTS.filter(({ pattern }) => pattern.test(stripped)).map(
		({ name }) => name
	)
}

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		if (entry === 'node_modules') return []

		const full = join(dir, entry)

		/*
		  lstat, so a symlinked DIRECTORY is not recursed into: statSync follows
		  links, which would loop forever on a cycle. A symlinked file is still
		  read, because nothing about a link makes its contents exempt.
		*/
		const stats = lstatSync(full)
		if (stats.isDirectory()) return sourceFiles(full)

		if (stats.isSymbolicLink()) {
			/*
			  statSync throws ENOENT on a broken link, which would take this spec
			  down with an error rather than a verdict.
			*/
			try {
				if (!statSync(full).isFile()) return []
			} catch {
				return []
			}
		}

		return /\.(tsx?|mts|cts)$/.test(entry) &&
			!/\.spec\.(tsx?|mts|cts)$/.test(entry)
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

			for (const name of restatementsIn(readFileSync(file, 'utf8'))) {
				offenders.push(`${path} restates it as ${name}`)
			}
		}

		expect(
			offenders,
			`Import isPaidPlan or PURCHASABLE_PLANS from ${OWNER} instead:\n${offenders.join('\n')}`
		).toEqual([])
	})

	/*
	  Every pattern carries its own example and is checked through the same
	  strip the guard applies, so a pattern whose example happens to contain the
	  ladder cannot pass here while being unfireable in the walker.

	  The previous version walked a separate samples array and indexed into this
	  one positionally: a pattern that could never match anything would have
	  stayed green, which is the defect this whole file exists to prevent.
	*/
	it.each(RESTATEMENTS.map((r) => [r.name, r] as const))(
		'the pattern for %s fires through the real strip',
		(name, restatement) => {
			expect(restatementsIn(restatement.example)).toContain(name)
		}
	)

	it.each([
		[
			'a list',
			"const PLANS: Plan[] = ['free', 'pro', 'business', 'enterprise']"
		],
		['a union', "type Plan = 'free' | 'pro' | 'business' | 'enterprise'"],
		[
			'a wrapped Set',
			"const VALID = new Set([\n\t'free',\n\t'pro',\n\t'business',\n\t'enterprise'\n])"
		],
		[
			'a comparison chain',
			"if (\n\tvalue === 'free' ||\n\tvalue === 'pro' ||\n\tvalue === 'business' ||\n\tvalue === 'enterprise'\n) {"
		]
	])('exempts the full plan ladder written as %s', (_shape, ladder) => {
		expect(restatementsIn(ladder)).toEqual([])
	})

	/*
	  Each of these fires without the strip, so the exemption above is doing work
	  rather than passing vacuously.
	*/
	it.each([
		[
			'a list',
			"const PLANS: Plan[] = ['free', 'pro', 'business', 'enterprise']"
		],
		['a union', "type Plan = 'free' | 'pro' | 'business' | 'enterprise'"],
		[
			'a wrapped Set',
			"const VALID = new Set([\n\t'free',\n\t'pro',\n\t'business',\n\t'enterprise'\n])"
		],
		[
			'a comparison chain',
			"if (\n\tvalue === 'free' ||\n\tvalue === 'pro' ||\n\tvalue === 'business' ||\n\tvalue === 'enterprise'\n) {"
		]
	])(
		'would flag the ladder written as %s if it were not exempt',
		(_s, ladder) => {
			expect(RESTATEMENTS.some(({ pattern }) => pattern.test(ladder))).toBe(
				true
			)
		}
	)

	/*
	  The four shapes this repo already writes that say nothing about the plans
	  forming a set. Each was flagged by the proximity-based version.
	*/
	it.each([
		[
			'per-tier booleans',
			"const isFree = plan === 'free'\nconst isPro = plan === 'pro'\nconst isBusiness = plan === 'business'"
		],
		[
			'a chained ternary',
			"const label = plan === 'pro' ? 'Pro' : plan === 'business' ? 'Business' : 'Free'"
		],
		[
			'switch cases with distinct bodies',
			"switch (p) {\n\tcase 'pro':\n\t\treturn PRO_SEATS\n\tcase 'business':\n\t\treturn BUSINESS_SEATS\n}"
		],
		[
			'two unrelated comparisons',
			"if (plan === 'pro') {\n\tgo()\n}\nif (route === 'business') {\n\tstop()\n}"
		],
		/*
		  These four reached one comparison from the other across an intervening
		  expression, back when the operand between them was any 40 characters
		  rather than a backreference. Different subjects are not a set claim.
		*/
		[
			'a comparison reached across a return',
			"if (plan === 'pro' || isTrial) return route === 'business'"
		],
		[
			'a comparison reached across a block',
			"if (plan === 'pro' || x) { run() } if (kind === 'business') stop()"
		],
		[
			'a comparison reached across a ternary',
			"return plan === 'pro' || isTrial ? mode === 'business' : false"
		],
		[
			'a negated comparison reached across a statement',
			"assert(plan !== 'pro' && ok); assert(kind !== 'business')"
		],
		/*
		  An array whose members happen to sit next to each other. `'pro'` and
		  `'business'` are adjacent here by alphabetical accident, which is why
		  the bracket budget stays tight rather than spanning a long list.
		*/
		[
			'an unrelated list that happens to place them together',
			"const BADGES = ['alpha', 'beta', 'community', 'edu', 'nonprofit', 'oss', 'partner', 'pro', 'business']"
		]
	])('does not flag %s', (_shape, source) => {
		expect(restatementsIn(source)).toEqual([])
	})

	/*
	  The ladder exemption must not depend on how long the operand is. A bounded
	  gap broke exactly here: the ladder stopped being exempt while the
	  disjunction pattern kept firing, so a correct four-plan check was reported
	  as a restatement. 22 of the 870 string comparisons under app/ already use
	  an operand longer than 40 characters.
	*/
	it('exempts the ladder however long its operand is', () => {
		const ladder = [
			'if (',
			"\tuserWithDefaults.organization.subscription.plan === 'free' ||",
			"\tuserWithDefaults.organization.subscription.plan === 'pro' ||",
			"\tuserWithDefaults.organization.subscription.plan === 'business' ||",
			"\tuserWithDefaults.organization.subscription.plan === 'enterprise'",
			') {'
		].join('\n')

		expect(restatementsIn(ladder)).toEqual([])
	})

	/*
	  And the restatement must still be caught at the same length, which a
	  bounded gap also broke, in the opposite direction.
	*/
	it('still flags a restatement written against a long operand', () => {
		const source = [
			'const paid =',
			"\tuserWithDefaults.organization.subscription.plan === 'pro' ||",
			"\tuserWithDefaults.organization.subscription.plan === 'business'"
		].join('\n')

		expect(restatementsIn(source)).toContain(
			"a disjunction, === 'pro' || === 'business'"
		)
	})

	/*
	  The strip must not swallow unrelated code between a distant 'free' and a
	  distant 'enterprise', which is how a genuine restatement could hide inside
	  an exempted region.
	*/
	it('still sees a restatement sitting between free and enterprise', () => {
		const source = [
			"const fallback: Plan = 'free'",
			"export type Paid = 'pro' | 'business'",
			"const soldBySales = ['enterprise']"
		].join('\n')

		expect(restatementsIn(source)).toContain("a type union, 'pro' | 'business'")
	})
})
