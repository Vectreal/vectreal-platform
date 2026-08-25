/**
 * The house rules in `eslint.config.mts`, proven to fire.
 *
 * A `no-restricted-syntax` selector is a string. Nothing type-checks it, and a
 * subtly wrong one silently matches nothing while lint stays green - which
 * looks exactly like compliance. These lint real snippets through the repo's
 * own config and assert both directions: the violation is caught, and the
 * correct form is not.
 */

import { resolve } from 'node:path'

import { ESLint } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../..')

/** A path inside the glob the rules are scoped to (`apps/**`, `shared/**`). */
const IN_SCOPE = resolve(
	ROOT,
	'apps/vectreal-platform/app/components/probe.tsx'
)

let eslint: ESLint

/*
  The warm-up is the point of the timeout argument.

  `new ESLint()` is cheap; the first `lintText` is not. It resolves the flat
  config, which imports `eslint.config.mts` and every plugin it pulls in, and
  that lands on whichever test happens to run first. Measured on an idle
  machine it is about a second; measured while the rest of the suite runs in
  parallel it has exceeded the 5s per-test budget and failed outright. So the
  first test in this file failed for want of time rather than for anything it
  asserts, and passed when run alone - which reads as a flaky rule instead of
  a misplaced cost.

  Paying it here moves it out of every test's budget and into a hook with a
  budget of its own, so each test times only the assertion it makes.
*/
beforeAll(async () => {
	eslint = new ESLint({ cwd: ROOT })
	await eslint.lintText('export const warmUp = 1\n', { filePath: IN_SCOPE })
}, 120_000)

async function messagesFor(code: string, filePath = IN_SCOPE) {
	const [result] = await eslint.lintText(code, { filePath })
	return result.messages.filter(
		(message) => message.ruleId === 'no-restricted-syntax'
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
