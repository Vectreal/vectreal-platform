/**
 * Tooltip copy has to fit in the tooltip.
 *
 * `TooltipContent` is `max-w-80` at `text-xs`: 320px of 12px DM Sans, minus
 * `px-3` either side. Measured in the browser against that exact box, real
 * English prose wraps to three lines at 140 characters and to four in the
 * 150s. A tooltip is a glance, not a paragraph, so 140 is the ceiling.
 *
 * The rule exists because nothing bounded this. Copy that outgrew a glance
 * kept being written as a tooltip anyway - one entry in the optimization
 * catalog reached 367 characters, which is nine lines hanging over the panel
 * the reader was trying to use. When copy no longer fits, the fix is a visible
 * caption beside the control, the way the embed options panel resolved it, not
 * a taller tooltip.
 *
 * The scan is deliberately literal: it reads source, not a render tree, so it
 * sees only string literals. Copy assembled at runtime is not covered, and a
 * new prop name carrying help text has to be added to ATTRIBUTES below.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '../app')

/**
 * 140 characters is three lines in the real tooltip box. Verified in the
 * browser rather than estimated: the strings in this repo still measured three
 * line boxes at 141 characters, and the fourth appears in the 150s.
 */
const MAX_LENGTH = 140

/** A single- or double-quoted literal, escapes included. */
const LITERAL = String.raw`'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"`

/**
 * Names that carry help text into a tooltip. `content` is not among them: it
 * is far too common a prop name to match on, so InfoTooltip's own is read off
 * the tag instead.
 */
const ATTRIBUTES = String.raw`tooltip|info|hint|\w+Help|\w+Hint|\w+_HINT|\w+_EXPLANATION`

/** `name: 'copy'` and `name="copy"`, across the line break prettier inserts. */
const ASSIGNED = String.raw`\b(?:${ATTRIBUTES})\s*[:=]\s*\{?\s*(?:${LITERAL})`

/** `<InfoTooltip content="copy" />`, the only `content` that counts. */
const INFO_TOOLTIP = String.raw`<InfoTooltip[^>]*?\bcontent=\{?\s*(?:${LITERAL})`

interface TooltipCopy {
	source: string
	text: string
}

function collectSourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const full = join(dir, entry)
		if (statSync(full).isDirectory()) return collectSourceFiles(full)
		return /(?<!\.spec)\.tsx?$/.test(entry) ? [full] : []
	})
}

function collectTooltipCopy(): TooltipCopy[] {
	const found: TooltipCopy[] = []

	for (const file of collectSourceFiles(APP_DIR)) {
		const source = readFileSync(file, 'utf8')
		const where = relative(APP_DIR, file)

		for (const pattern of [ASSIGNED, INFO_TOOLTIP]) {
			for (const match of source.matchAll(new RegExp(pattern, 'g'))) {
				const literal = match[0].match(new RegExp(LITERAL))
				if (!literal) continue

				const text = (literal[1] ?? literal[2] ?? '')
					.replace(/\\(['"])/g, '$1')
					.trim()

				if (text) found.push({ source: where, text })
			}
		}
	}

	return found
}

describe('tooltip copy', () => {
	const copy = collectTooltipCopy()

	it('finds the tooltip strings it is meant to be guarding', () => {
		// A collector that silently matches nothing is a green test that checks
		// nothing, which is the only way this rule can fail quietly.
		expect(copy.length).toBeGreaterThan(40)
	})

	it('stays within three lines of the tooltip box', () => {
		const tooLong = copy
			.filter(({ text }) => text.length > MAX_LENGTH)
			.map(({ source, text }) => `${source}: ${text.length} chars - "${text}"`)
			.sort()

		expect(tooLong).toEqual([])
	})
})
