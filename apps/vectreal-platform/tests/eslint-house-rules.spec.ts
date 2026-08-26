/**
 * The house rules in `eslint.config.mts`, proven to fire and proven to be on.
 *
 * A `no-restricted-syntax` selector is a string. Nothing type-checks it, and a
 * subtly wrong one silently matches nothing while lint stays green - which
 * looks exactly like compliance. These lint real snippets through the repo's
 * own config and assert both directions: the violation is caught, and the
 * correct form is not.
 *
 * That covers a rule being wrong. It does not cover a rule being *absent*,
 * which is a separate failure with the same symptom, and the one that actually
 * shipped: flat config replaces rule options rather than merging them, so a
 * second block re-declaring a rule over a subset of files turns the first
 * block's rules off for that subset. The final describe checks the resolved
 * config for every file in scope, because everything above lints at one
 * hardcoded path and a hardcoded path is what the regression slipped past.
 */

import { globSync } from 'node:fs'
import { resolve } from 'node:path'

import { ESLint } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../..')

/** A path inside the glob the rules are scoped to (`apps/**`, `shared/**`). */
const IN_SCOPE = resolve(ROOT, 'apps/vectreal-platform/app/components/probe.tsx')

/** A server-only module, where console.error is banned outright. */
const SERVER_MODULE = resolve(
	ROOT,
	'apps/vectreal-platform/app/lib/domain/probe/probe.server.ts'
)

/** A route module, where the ban applies to the loader and action only. */
const ROUTE_MODULE = resolve(
	ROOT,
	'apps/vectreal-platform/app/routes/probe-page/probe.tsx'
)

let eslint: ESLint

beforeAll(() => {
	eslint = new ESLint({ cwd: ROOT })
})

/** The house rules, whichever rule id each one is implemented as. */
const HOUSE_RULES = new Set(['no-restricted-syntax', 'no-console'])

async function messagesFor(code: string, filePath = IN_SCOPE) {
	const [result] = await eslint.lintText(code, { filePath })
	return result.messages.filter(
		(message) => message.ruleId && HOUSE_RULES.has(message.ruleId)
	)
}

describe('className must be built with cn()', () => {
	it('rejects a template literal carrying an expression', async () => {
		const messages = await messagesFor(
			'export const A = ({ className }: { className?: string }) => (\n' +
				'\t<div className={`space-y-4 ${className}`} />\n)\n'
		)

		expect(messages).toHaveLength(1)
		expect(messages[0].message).toContain('cn()')
	})

	it('rejects string concatenation', async () => {
		const messages = await messagesFor(
			'export const A = ({ c }: { c: string }) => <div className={"p-2 " + c} />\n'
		)

		expect(messages).toHaveLength(1)
	})

	it('rejects interpolation smuggled inside cn()', async () => {
		/*
		  The bypass the other two selectors leave open. `cn()` is present, so it
		  looks compliant - but a pre-joined string gives clsx nothing to drop and
		  tailwind-merge no distinct arguments to reconcile, which is the whole
		  reason the rule exists.
		*/
		const messages = await messagesFor(
			"import { cn } from '@shared/utils'\n" +
				'export const A = ({ c }: { c?: string }) => (\n' +
				'\t<div className={cn(`space-y-4 ${c}`)} />\n)\n'
		)

		expect(messages).toHaveLength(1)
		expect(messages[0].message).toContain('separate arguments')
	})

	it('accepts cn(), a plain string, and a bare identifier', async () => {
		const messages = await messagesFor(
			"import { cn } from '@shared/utils'\n" +
				'export const A = ({ c }: { c?: string }) => (\n' +
				'\t<div className={cn("space-y-4", c)}>\n' +
				'\t\t<span className="p-2" />\n' +
				'\t\t<span className={c} />\n' +
				'\t</div>\n)\n'
		)

		expect(messages).toEqual([])
	})

	it('leaves template literals alone outside className', async () => {
		const messages = await messagesFor(
			'export const A = ({ id }: { id: string }) => <div data-x={`row-${id}`} />\n'
		)

		expect(messages).toEqual([])
	})
})

describe('z-index must come from the named scale', () => {
	it('rejects a bare value at the chrome tier', async () => {
		const messages = await messagesFor(
			'export const A = () => <div className="fixed top-0 z-50" />\n'
		)

		expect(messages).toHaveLength(1)
		expect(messages[0].message).toContain('z-page-chrome')
	})

	it('rejects an arbitrary value at any height', async () => {
		const messages = await messagesFor(
			'export const A = () => <div className="z-[45]" />\n'
		)

		expect(messages).toHaveLength(1)
	})

	it('rejects the escape hatches Tailwind spells differently', async () => {
		/*
		  Three spellings of the same hole. `z-(--x)` is the one most likely to be
		  reached for here, because the tiers are real custom properties and this
		  codebase already writes `origin-(--radix-...)` everywhere; a leading `!`
		  is the worst, since it makes the resulting conflict harder to unpick.
		*/
		const messages = await messagesFor(
			'export const A = () => (\n' +
				'\t<div className="fixed !z-50">\n' +
				'\t\t<span className="z-(--anything)" />\n' +
				'\t\t<span className="md:!z-60" />\n' +
				'\t</div>\n)\n'
		)

		expect(messages).toHaveLength(3)
	})

	it('rejects a value carried by a variant', async () => {
		/*
		  One message per string, not per class: the selector matches the `Literal`
		  node, so a second offender in the same attribute is already covered by
		  the first report. Separate elements to see both.
		*/
		const messages = await messagesFor(
			'export const A = () => (\n' +
				'\t<div className="md:z-60">\n' +
				'\t\t<span className="group-data-[state=open]:z-70" />\n' +
				'\t</div>\n)\n'
		)

		expect(messages).toHaveLength(2)
	})

	it('rejects one parked in a lookup table', async () => {
		/*
		  The shape `PUBLISHER_LAYER` has. Nothing about it looks like a class
		  until it reaches a `className`, by which point the number is three files
		  away from the element it stacks against.
		*/
		const messages = await messagesFor(
			"export const LAYER = { header: 'z-90' } as const\n"
		)

		expect(messages).toHaveLength(1)
	})

	it('rejects one written as a template literal', async () => {
		/*
		  The `cn()` rules above only reach a template literal used as a className
		  or passed to `cn()`. A backtick string in a `const` evades both, and the
		  `Literal` selector does not match template nodes at all.
		*/
		const messages = await messagesFor('export const LAYER = `z-90`\n')

		expect(messages).toHaveLength(1)
	})

	it('accepts a tier name and local ordering below the chrome', async () => {
		const messages = await messagesFor(
			'export const A = () => (\n' +
				'\t<div className="fixed z-nav">\n' +
				'\t\t<span className="relative z-10" />\n' +
				'\t\t<span className="absolute z-45" />\n' +
				'\t\t<span className="!z-tooltip" />\n' +
				'\t</div>\n)\n'
		)

		expect(messages).toEqual([])
	})

	it('leaves other utilities whose names end in z- alone', async () => {
		/*
		  `translate-z-*` and `rotate-z-*` are unrelated axes. The selector anchors
		  on whitespace, a variant colon, or the start of the string precisely so
		  the hyphen in front of these keeps them out.
		*/
		const messages = await messagesFor(
			'export const A = () => <div className="translate-z-50 md:rotate-z-70" />\n'
		)

		expect(messages).toEqual([])
	})

	it('does not reach a negative value or a concatenated one', async () => {
		/*
		  Both gaps are deliberate and pinned here so they stay decisions. A
		  negative z-index paints behind its stacking context and cannot compete
		  with the chrome the rule protects; a concatenated one would need constant
		  folding to see, which the sibling cn() rules do not do either.
		*/
		const messages = await messagesFor(
			'export const A = "-z-50"\n' + "export const B = 'z-' + '90'\n"
		)

		expect(messages).toEqual([])
	})
})

describe('SVG must live in an icon component', () => {
	const INLINE_SVG =
		'export const A = () => (\n' +
		'\t<svg viewBox="0 0 24 24">\n\t\t<path d="M0 0h24v24H0z" />\n\t</svg>\n)\n'

	it('rejects an SVG pasted into a feature component', async () => {
		const messages = await messagesFor(INLINE_SVG)

		expect(messages).toHaveLength(1)
		expect(messages[0].message).toContain('assets/icons')
	})

	it('allows it inside the icons directory, which is its home', async () => {
		const messages = await messagesFor(
			INLINE_SVG,
			resolve(ROOT, 'shared/components/src/assets/icons/probe-logo.tsx')
		)

		expect(messages).toEqual([])
	})

	it('allows an imported icon component', async () => {
		const messages = await messagesFor(
			"import { XLogo } from '@shared/components/assets/icons/x-logo'\n" +
				'export const A = () => <XLogo className="h-5 w-5" />\n'
		)

		expect(messages).toEqual([])
	})
})


/**
 * `console.error` is not a reporting strategy.
 *
 * Every server-side failure that gets caught and turned into a response, a
 * fallback or an empty list is invisible to `handleError`, which only sees what
 * is thrown past it. Thirty-odd call sites each answered that with a
 * `console.error` into a stream with no grouping or alerting -
 * `stripe-subscription-sync.server.ts` used one to ask an operator to reconcile
 * a subscription still billing a deleted account.
 *
 * Both directions are asserted. A selector that matched nothing would leave
 * lint green, which is indistinguishable from compliance.
 */
describe('server code reports rather than logs', () => {
	it('rejects console.error in a server-only module', async () => {
		const messages = await messagesFor(
			'export function save() {\n' +
				'\ttry {\n\t\treturn 1\n\t} catch (error) {\n' +
				'\t\tconsole.error("failed", error)\n\t\treturn null\n\t}\n}\n',
			SERVER_MODULE
		)

		expect(messages).toHaveLength(1)
		/*
		  `no-console` has a fixed message, so unlike the route rule below this
		  one cannot name `reportServerError` in the lint output. That is the
		  price of using a different rule id, which is what stops this block
		  displacing the design-system selectors. The message still names the
		  call and says which console methods remain allowed.
		*/
		expect(messages[0].message).toContain('console')
	})

	it('accepts reportServerError in a server-only module', async () => {
		const messages = await messagesFor(
			'import { reportServerError } from "../../observability/report-server-error.server"\n' +
				'export function save() {\n\ttry {\n\t\treturn 1\n\t} catch (error) {\n' +
				'\t\treportServerError(error)\n\t\treturn null\n\t}\n}\n',
			SERVER_MODULE
		)

		expect(messages).toEqual([])
	})

	/*
	  A malformed request body or an expired OAuth code answers with a 4xx and is
	  the product working - the same judgement `buildErrorReport` makes at its
	  status floor. Reporting those would bury real failures under client noise,
	  so `console.warn` stays available and this asserts the rule leaves it alone.
	*/
	it('leaves console.warn alone', async () => {
		const messages = await messagesFor(
			'export function parse() {\n\ttry {\n\t\treturn 1\n\t} catch (error) {\n' +
				'\t\tconsole.warn("bad input", error)\n\t\treturn null\n\t}\n}\n',
			SERVER_MODULE
		)

		expect(messages).toEqual([])
	})

	it('rejects console.error inside a route loader', async () => {
		const messages = await messagesFor(
			'export async function loader() {\n\ttry {\n\t\treturn 1\n\t} catch (error) {\n' +
				'\t\tconsole.error("failed", error)\n\t\treturn null\n\t}\n}\n',
			ROUTE_MODULE
		)

		expect(messages).toHaveLength(1)
	})

	it('rejects console.error inside a route action', async () => {
		const messages = await messagesFor(
			'export async function action() {\n\ttry {\n\t\treturn 1\n\t} catch (error) {\n' +
				'\t\tconsole.error("failed", error)\n\t\treturn null\n\t}\n}\n',
			ROUTE_MODULE
		)

		expect(messages).toHaveLength(1)
	})

	/*
	  The arrow form is not what this repo writes today, and that is exactly why
	  it is pinned: a rule that only understands the current spelling stops
	  working on the refactor that changes it, silently.
	*/
	it('rejects console.error in an arrow-function loader', async () => {
		const messages = await messagesFor(
			'export const loader = async () => {\n\ttry {\n\t\treturn 1\n\t} catch (error) {\n' +
				'\t\tconsole.error("failed", error)\n\t\treturn null\n\t}\n}\n',
			ROUTE_MODULE
		)

		expect(messages).toHaveLength(1)
	})

	/*
	  The component half of a route runs in the browser, where the reporting path
	  is `useErrorReport` and `error-boundary-reporting.spec.ts` is the ratchet.
	  Banning it here would push people to disable the rule rather than move the
	  call.
	*/
	it('leaves the component half of a route alone', async () => {
		const messages = await messagesFor(
			'export default function Page() {\n\tconsole.error("client side")\n\treturn null\n}\n',
			ROUTE_MODULE
		)

		expect(messages).toEqual([])
	})
})


/**
 * Every file a house rule is scoped to actually has it.
 *
 * This is a regression test, and the bug it pins shipped in the change that
 * added the `console.error` ban. Flat config does not merge rule options: when
 * two blocks configure the same rule and both match a file, the later one
 * *replaces* the earlier. Scoping a second `no-restricted-syntax` block to
 * `apps/vectreal-platform/app/routes/**` therefore left route files with only
 * that block's two selectors and silently dropped cn(), the z-index scale and
 * the inline-SVG ban across every page and API route.
 *
 * Lint stayed green, because a rule that is switched off reports nothing and so
 * does a codebase that complies. The tests above stayed green too: they lint
 * snippets at one hardcoded path, which proves a rule *exists* but not that it
 * is *active* where it is scoped.
 *
 * So this asks ESLint to resolve the real config for every source file in scope
 * and checks the shape of the answer, rather than guessing which scopes are
 * worth probing. Guessing is what left the hole: the probe path was under
 * `app/components/`, and the block that broke things did not match it.
 */
describe('house rules survive config resolution', () => {
	/*
	  Resolved per file rather than sampled. 701 files take under a second,
	  because ESLint caches resolution per directory - cheap enough that there is
	  no reason to check a subset and hope it was representative.
	*/
	const SOURCES = globSync(['apps/**/*.{ts,tsx}', 'shared/**/*.{ts,tsx}'], {
		cwd: ROOT,
		exclude: (path) =>
			path.includes('node_modules') ||
			path.includes('/build/') ||
			path.includes('/dist/')
	})

	/**
	 * The four exceptions `eslint.config.mts` declares through `ignores`, as
	 * shapes.
	 *
	 * Duplicated from the config on purpose, and the duplication is what makes
	 * the check sound: without it, a block that resolved a subset of files to
	 * *zero* selectors would be indistinguishable from a file the config
	 * deliberately exempts. The assertion below fails if this list goes stale in
	 * either direction.
	 */
	const DECLARED_EXCEPTIONS: [string, RegExp][] = [
		['specs assert on literal class strings', /\.spec\.tsx?$/],
		['stories show raw values beside their tokens', /\.stories\.tsx?$/],
		['mail clients do not resolve custom properties', /\/lib\/email\/templates\//],
		['icons are where inline SVG is supposed to live', /\/assets\/icons\//]
	]

	let resolved: { file: string; selectors: number }[]

	beforeAll(async () => {
		resolved = []
		for (const file of SOURCES) {
			const config = await eslint.calculateConfigForFile(resolve(ROOT, file))
			const rule = config.rules?.['no-restricted-syntax']
			// [severity, ...selectors]
			resolved.push({
				file,
				selectors: Array.isArray(rule) ? rule.length - 1 : 0
			})
		}
	})

	it('finds the files it is supposed to be checking', () => {
		expect(SOURCES.length).toBeGreaterThan(400)
	})

	/*
	  The assertion that would have caught the regression. A clobbered file keeps
	  the overriding block's selectors and loses the rest, so it lands strictly
	  between "fully exempt" and "fully covered" - a state nothing else produces.
	*/
	it('gives every file either the full rule set or none of it', () => {
		const full = Math.max(...resolved.map((entry) => entry.selectors))
		const partial = resolved.filter(
			(entry) => entry.selectors > 0 && entry.selectors < full
		)

		expect(
			partial.map((entry) => `${entry.file} (${entry.selectors}/${full})`),
			'These files resolved to some house rules but not all of them, which means a config block re-declared no-restricted-syntax over a subset and replaced the rest. Flat config does not merge rule options. Add the selectors to the existing array instead of opening a new block, or use a different rule id.'
		).toEqual([])
	})

	/*
	  The other half. Without this, switching a subset off entirely would read as
	  "these files are exempt" and pass the assertion above.
	*/
	it('exempts only what the config says it exempts', () => {
		const unexplained = resolved
			.filter((entry) => entry.selectors === 0)
			.filter(({ file }) =>
				DECLARED_EXCEPTIONS.every(([, pattern]) => !pattern.test(file))
			)
			.map((entry) => entry.file)

		expect(
			unexplained,
			'These files have no house rules and are not one of the exceptions eslint.config.mts declares. Either the ignores grew and this list needs the new reason, or a config block turned the rules off by accident.'
		).toEqual([])
	})

	/*
	  The ratchet turns one way. An exception that no longer exempts anything is a
	  claim about the config that has stopped being true, and leaving it here
	  would let the list above quietly stop meaning anything.
	*/
	it.each(DECLARED_EXCEPTIONS)('%s: still exempts something', (_, pattern) => {
		expect(
			resolved.some(
				(entry) => pattern.test(entry.file) && entry.selectors === 0
			)
		).toBe(true)
	})
})
