/**
 * Which modules can load a package at runtime, read from the syntax tree.
 *
 * Inverted on purpose: every string naming the package counts, and only a
 * declaration that is provably type-only is excused. Listing the ways to load
 * a module instead - value imports, re-exports, `import()`, `require`,
 * `createRequire` - always missed one, and every regex version was fooled by
 * a comment. Comments are not nodes here.
 *
 * Shared by the PostHog specs: `posthog-node` must load only in the server
 * client, `posthog-js` only through the browser loader's `import()`.
 */

import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import ts from 'typescript'

/** Every source file under `dir`, specs excluded. */
export function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const full = join(dir, entry)
		if (statSync(full).isDirectory()) return sourceFiles(full)
		return /\.(m?[jt]sx?)$/.test(entry) && !/\.spec\./.test(entry) ? [full] : []
	})
}

/**
 * The string literals in `source` that name `pkg` (or a subpath of it) and
 * are not part of a type-only import or export.
 */
export function valueReferences(
	file: string,
	source: string,
	pkg: string
): ts.StringLiteralLike[] {
	const allTypes = (elements: readonly { isTypeOnly: boolean }[]) =>
		elements.length > 0 && elements.every((element) => element.isTypeOnly)

	const typeOnlyDeclaration = (node: ts.Node): boolean => {
		if (ts.isImportDeclaration(node)) {
			const clause = node.importClause
			if (!clause) return false
			if (clause.isTypeOnly) return true
			return (
				clause.name === undefined &&
				clause.namedBindings !== undefined &&
				ts.isNamedImports(clause.namedBindings) &&
				allTypes(clause.namedBindings.elements)
			)
		}
		if (ts.isExportDeclaration(node)) {
			if (node.isTypeOnly) return true
			return (
				node.exportClause !== undefined &&
				ts.isNamedExports(node.exportClause) &&
				allTypes(node.exportClause.elements)
			)
		}
		return false
	}

	const found: ts.StringLiteralLike[] = []
	const visit = (node: ts.Node) => {
		if (
			ts.isStringLiteralLike(node) &&
			(node.text === pkg || node.text.startsWith(`${pkg}/`)) &&
			!typeOnlyDeclaration(node.parent)
		) {
			found.push(node)
		}
		ts.forEachChild(node, visit)
	}

	visit(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true))
	return found
}

/** Whether a reference is the argument of a dynamic `import()`. */
export function isDynamicImport(reference: ts.StringLiteralLike): boolean {
	const call = reference.parent
	return (
		ts.isCallExpression(call) &&
		call.expression.kind === ts.SyntaxKind.ImportKeyword
	)
}
