/**
 * Overlay titles have to come from the type scale.
 *
 * This drifted three times. Dialog, alert-dialog, drawer and sheet each shipped
 * with shadcn's `text-lg font-semibold`, which is a pairing the scale does not
 * contain, and `DrawerTitle`/`SheetTitle` declared no size at all - so they fell
 * through to the 28px display heading the base layer gives a bare `<h2>`.
 *
 * A modal, a drawer and a sheet are the same surface with different animations.
 * Their titles should not be three different sizes, and the next primitive
 * copied in from shadcn should fail here rather than in review.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const UI_DIR = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../shared/components/src/ui'
)

/** Rungs defined in `globals.css`. Anything else is hand-rolled. */
const SCALE_CLASSES = [
	'text-display',
	'text-headline',
	'text-h2',
	'text-h3',
	'text-h4',
	'text-stat',
	'text-body-lg',
	'text-label-xs',
	'text-eyebrow'
]

/** Tailwind font-size utilities, which a title must not reach for directly. */
const RAW_SIZE = /\btext-(xs|sm|base|lg|xl|[2-9]xl)\b/

const OVERLAY_TITLES = [
	['dialog.tsx', 'DialogTitle'],
	['alert-dialog.tsx', 'AlertDialogTitle'],
	['drawer.tsx', 'DrawerTitle'],
	['sheet.tsx', 'SheetTitle']
] as const

/** The `cn(...)` class string inside a named component. */
function classesOf(file: string, component: string): string {
	const source = readFileSync(join(UI_DIR, file), 'utf8')
	const start = source.indexOf(`function ${component}(`)
	expect(start, `${component} not found in ${file}`).toBeGreaterThan(-1)

	const body = source.slice(start, start + 1200)
	const match = body.match(/className=\{cn\(\s*'([^']*)'/)
	expect(match, `no cn() class string in ${component}`).not.toBeNull()

	return match![1]
}

describe('type scale adherence', () => {
	describe.each(OVERLAY_TITLES)('%s / %s', (file, component) => {
		it('uses a scale rung', () => {
			const classes = classesOf(file, component)

			expect(
				SCALE_CLASSES.some((rung) =>
					new RegExp(`(^|\\s)${rung}(\\s|$)`).test(classes)
				),
				`${component} has "${classes}" - expected one of ${SCALE_CLASSES.join(', ')}`
			).toBe(true)
		})

		it('does not hand-roll a Tailwind font size', () => {
			const classes = classesOf(file, component)

			expect(
				RAW_SIZE.test(classes),
				`${component} sets a raw Tailwind size in "${classes}"`
			).toBe(false)
		})

		it('does not restate a weight the rung already carries', () => {
			const classes = classesOf(file, component)

			expect(
				/\bfont-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/.test(
					classes
				),
				`${component} overrides the scale weight in "${classes}"`
			).toBe(false)
		})
	})

	it('puts every overlay title on the same rung', () => {
		// The property that matters most: these four are one surface, so a change
		// that moves only some of them should fail.
		const rungs = OVERLAY_TITLES.map(([file, component]) => {
			const classes = classesOf(file, component)
			return SCALE_CLASSES.find((rung) =>
				new RegExp(`(^|\\s)${rung}(\\s|$)`).test(classes)
			)
		})

		expect(new Set(rungs).size, `rungs were ${rungs.join(', ')}`).toBe(1)
	})

	describe('close triggers', () => {
		// Dialog used shadcn's bare 16px glyph on a `rounded-xs` corner, sheet had
		// a 36px round target, and drawer had no built-in close at all - so six
		// consumers hand-rolled a ghost icon button, and the publisher sidebar a
		// seventh. One gesture, four controls.
		const CLOSE_OWNERS = ['dialog.tsx', 'sheet.tsx', 'drawer.tsx'] as const

		it.each(CLOSE_OWNERS)('%s uses the shared close', (file) => {
			const source = readFileSync(join(UI_DIR, file), 'utf8')

			expect(source).toContain('OVERLAY_CLOSE_CLASSNAME')
		})

		it.each(CLOSE_OWNERS)('%s does not restate the appearance', (file) => {
			const source = readFileSync(join(UI_DIR, file), 'utf8')

			// The appearance lives in exactly one file. A primitive that spells it
			// out again is how the four treatments diverged in the first place.
			expect(
				source.includes('ring-offset-background focus'),
				`${file} hard-codes the close classes instead of importing them`
			).toBe(false)
		})

		it('keeps the shared close a single definition', () => {
			const source = readFileSync(join(UI_DIR, 'overlay-close.ts'), 'utf8')

			// The positioned variant is built from the appearance, not restated.
			expect(source).toContain(
				'`absolute top-4 right-4 ${OVERLAY_CLOSE_APPEARANCE}`'
			)
		})
	})

	describe('themed portals', () => {
		/*
		  An overlay that portals to `document.body` leaves any themed subtree
		  behind, so one opened inside `.dark` renders in light tokens. The
		  failure is invisible in the light theme, which is how it survived until
		  somebody opened a dialog from the dark column of a Storybook page.

		  Each of these forwards a `container` to its own portal. `drawer` is
		  absent deliberately: vaul takes the target on the root rather than the
		  content, so it has nothing to forward here.
		*/
		const PORTAL_OWNERS = [
			'dialog.tsx',
			'alert-dialog.tsx',
			'hover-card.tsx'
		] as const

		it.each(PORTAL_OWNERS)('%s accepts a portal container', (file) => {
			const source = readFileSync(join(UI_DIR, file), 'utf8')

			expect(source, `${file} does not declare a container prop`).toMatch(
				/container\?: HTMLElement \| null/
			)
		})

		it.each(PORTAL_OWNERS)('%s forwards it to the portal', (file) => {
			const source = readFileSync(join(UI_DIR, file), 'utf8')

			// Declaring the prop and dropping it on the floor is the regression
			// that would look identical to never having added it.
			expect(
				source,
				`${file} declares a container but never passes it on`
			).toMatch(/container=\{container\}/)
		})
	})

	it('defines every rung it claims to define', () => {
		const css = readFileSync(join(UI_DIR, '../styles/globals.css'), 'utf8')

		for (const rung of SCALE_CLASSES) {
			expect(css, `${rung} is referenced but never defined`).toContain(
				`.${rung} {`
			)
		}
	})

	it('never reaches a rung through a variant', () => {
		/*
		  The failure this exists for is silent, which is what makes it worth a
		  test. `--text-*` are plain custom properties rather than `@theme` keys,
		  so a rung is a hand-written class in `@layer components` and not a
		  utility Tailwind owns - and Tailwind only composes variants with
		  utilities it generates. Prefix one and it emits no CSS whatsoever: no
		  build error, no lint error, just an element quietly inheriting its
		  parent's size.

		  It shipped once, in `command`, where `[&_[cmdk-group-heading]]:` on the
		  label rung took the palette's group heading from 12px to 16px. Reach the
		  token through an arbitrary value instead - `text-[length:var(--text-…)]`
		  - which does compose, and holds for `sm:` and `hover:` just as much as
		  for an arbitrary selector.
		*/
		const offenders: string[] = []

		for (const file of readdirSync(UI_DIR).filter((n) => n.endsWith('.tsx'))) {
			// Comments are stripped first: the explanations of this very rule spell
			// out the broken form, and matching prose would make the guard useless.
			const source = readFileSync(join(UI_DIR, file), 'utf8')
				.replace(/\/\*[\s\S]*?\*\//g, '')
				.replace(/\/\/[^\n]*/g, '')

			for (const rung of SCALE_CLASSES) {
				// Any variant separator: a `:` closing a word (`sm:`), a bracket
				// (`[&_x]:`) or a group (`(…):`) directly before the rung.
				const throughVariant = new RegExp(`[\\w\\]\\)]:${rung}\\b`)
				if (throughVariant.test(source)) {
					offenders.push(`${file} applies ${rung} through a variant`)
				}
			}
		}

		expect(offenders, offenders.join('\n')).toEqual([])
	})
})
