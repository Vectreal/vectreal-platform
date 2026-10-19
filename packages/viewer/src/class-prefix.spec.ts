/**
 * Every Tailwind class in the viewer's source carries the `vv:` prefix.
 *
 * A class written without it still renders in the platform and Storybook,
 * whose own Tailwind scans the viewer's source, and renders nothing in the
 * published bundle, which generates only `vv:` classes. So a missing prefix is
 * invisible everywhere it would be looked at. This reads every string literal
 * in the source the way Tailwind reads candidates and fails on any that is an
 * unprefixed utility.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

import { __unstable__loadDesignSystem } from 'tailwindcss'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

// How a class starts. A token that starts any other way (a comma, a capital)
// makes the literal prose rather than a class list.
const CLASS_LIKE = /^[a-z0-9!\-[@&*]/

const THEME = join(
	import.meta.dirname,
	'../../../shared/components/src/styles/theme.css'
)

const loadDesignSystem = () =>
	__unstable__loadDesignSystem(
		// With the shared palette, so `text-foreground` counts as a utility.
		`@import 'tailwindcss/theme'; @import 'tailwindcss/utilities'; @import '${THEME}';`,
		{
			base: import.meta.dirname,
			loadStylesheet: async (id: string, base: string) => ({
				path: id,
				base,
				content: readFileSync(
					id === THEME ? id : require.resolve(`${id}.css`),
					'utf8'
				)
			})
		}
	)

const sources = readdirSync(import.meta.dirname, {
	recursive: true,
	encoding: 'utf8'
}).filter(
	(file) => /\.(ts|tsx)$/.test(file) && !/\.(spec|stories)\./.test(file)
)

function stringLiterals(file: string) {
	const text = readFileSync(join(import.meta.dirname, file), 'utf8')
	const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
	const literals: { line: number; text: string }[] = []
	const visit = (node: ts.Node) => {
		if (
			(ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
			!ts.isImportDeclaration(node.parent) &&
			!ts.isExportDeclaration(node.parent) &&
			!ts.isLiteralTypeNode(node.parent)
		) {
			literals.push({
				line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
				text: node.text
			})
		}
		if (ts.isTemplateExpression(node)) {
			for (const part of [
				node.head,
				...node.templateSpans.map((s) => s.literal)
			])
				literals.push({
					line: source.getLineAndCharacterOfPosition(part.getStart()).line + 1,
					text: part.text
				})
		}
		ts.forEachChild(node, visit)
	}
	visit(source)
	return literals
}

describe('the viewer class prefix', () => {
	it('is on every Tailwind class in the source', async () => {
		const design = await loadDesignSystem()
		const isUtility = (token: string) =>
			design.candidatesToCss([token])[0] != null

		expect(sources.length).toBeGreaterThan(20)
		const unprefixed = sources.flatMap((file) =>
			stringLiterals(file).flatMap(({ line, text }) => {
				const tokens = text.split(/\s+/).filter(Boolean)
				// Prose, such as the `, hidden` in a marker's accessible name.
				if (tokens.some((token) => !CLASS_LIKE.test(token))) return []
				return tokens
					.filter(isUtility)
					.map((token) => `${file}:${line} ${token}`)
			})
		)
		expect(unprefixed).toEqual([])
	})

	it('reads an unprefixed class as one', async () => {
		const design = await loadDesignSystem()
		expect(design.candidatesToCss(['hover:bg-black/5'])[0]).not.toBeNull()
		expect(design.candidatesToCss(['text-foreground'])[0]).not.toBeNull()
		expect(design.candidatesToCss(['vv:h-full'])[0]).toBeNull()
	})
})
