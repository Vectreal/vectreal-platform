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
const IN_SCOPE = resolve(ROOT, 'apps/vectreal-platform/app/components/probe.tsx')

let eslint: ESLint

beforeAll(() => {
	eslint = new ESLint({ cwd: ROOT })
})

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
