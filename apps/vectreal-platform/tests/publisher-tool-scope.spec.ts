/**
 * A compose tool's active state and its extra UI are scoped to that tool's open
 * sidebar, always.
 *
 * The rule exists because the predicate is easy to write and easy to write
 * wrong. `activeComposeTool` answers "which tool is selected": it is never null,
 * it defaults to a real tool before the author has opened anything, and closing
 * a drawer flips `showSidebar` while leaving it untouched. Read on its own it
 * says a tool is active when its panel is shut - which is how the hotspot gizmo
 * came to outlive its drawer, letting a click select a marker for editing where
 * it should have flown the marker's linked camera.
 *
 * So this is a ratchet rather than a convention: `openComposeToolAtom` is the
 * single answer, and the raw field is readable only where the question is
 * genuinely "which tool's panel is this", not "is a tool active".
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const APP = join(import.meta.dirname, '..', 'app')

/**
 * The two places the raw field is legitimate.
 *
 * The store derives `openComposeToolAtom` from it, and the tool rail needs to
 * know which panel to title and render once one is open - a different question
 * from whether anything is open, which the rail also asks, through the derived
 * atom like everyone else.
 */
const MAY_READ_RAW = [
	'lib/stores/publisher-config-store.ts',
	'components/publisher/sidebars/tool-sidebar.tsx'
]

function sourceFiles(dir: string, found: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name)
		if (entry.isDirectory()) sourceFiles(full, found)
		else if (/\.tsx?$/.test(entry.name) && !/\.spec\.tsx?$/.test(entry.name)) {
			found.push(full)
		}
	}
	return found
}

describe('a compose tool is scoped to its own open sidebar', () => {
	const offenders = sourceFiles(APP)
		.filter((file) => {
			const relative = file.slice(APP.length + 1)
			return !MAY_READ_RAW.includes(relative.split('\\').join('/'))
		})
		.filter((file) => {
			const source = readFileSync(file, 'utf8')
			// Reading the field to compare it against a tool is the mistake. Writing
			// it - which is how a tool is opened - is not.
			return /activeComposeTool\s*===|===\s*activeComposeTool/.test(source)
		})
		.map((file) => file.slice(APP.length + 1))

	it('never decides a tool is active from activeComposeTool alone', () => {
		expect(offenders).toEqual([])
	})

	it('keeps the derived predicate as the single answer', () => {
		const store = readFileSync(
			join(APP, 'lib/stores/publisher-config-store.ts'),
			'utf8'
		)

		// Both halves, or the predicate is not the one the rest of the app trusts.
		expect(store).toContain('openComposeToolAtom')
		expect(store).toContain("state.mode === 'compose' && state.showSidebar")
	})
})
