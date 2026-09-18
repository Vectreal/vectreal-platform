/**
 * The accepted-format set is stated once, and this is what keeps it that way.
 *
 * `MODEL_FORMATS` in `@vctrl/core/model-formats` is the owner. Before it there
 * were nine independent statements of the set and nothing held them in
 * agreement - so they were not in agreement: the file input offered `.usda`
 * with no loader behind it, and the dispatch matched extensions case
 * sensitively while the loader lower-cased, which meant `MODEL.GLB` was refused
 * as unsupported by the code standing in front of a loader that reads it fine.
 *
 * Every consumer derives now, so the way that regresses is not a wrong list -
 * it is a *new* list, written next to the code that needs it because reaching
 * the owner was one import further away. That is what this file looks for: a
 * union or an array enumerating the formats, anywhere but the owner.
 *
 * It reads source text rather than types on purpose. A type-level assertion
 * proves the two agree; only the text can say there is one of them.
 *
 * WHAT THIS DOES NOT COVER, SAID OUT LOUD SO IT IS NOT MISTAKEN FOR COVERAGE.
 * It matches lower-case format ids - the machine-readable set. Enumerations
 * written as display names or as prose sidestep it entirely.
 *
 * That used to leave a real hole. `SUPPORTED_FORMAT_NAMES` was hand-maintained
 * and fed the meta keywords, `/llms.txt`, the home page and a schema.org
 * `featureList`; three marketing surfaces stated the set in prose; and one of
 * them claimed `USDA`, which has never loaded. All of them now read
 * `IMPORTABLE_FORMAT_LABELS`, so the prose enumerations this regex cannot see
 * are gone rather than merely unmatched.
 *
 * What is left is genuine prose - docs tables and article sentences, which have
 * to be written by hand. The last case below covers the one that matters most,
 * `docs/guides/upload`, by parsing its table rather than by regex. It is there
 * because a claims block cannot express it: claims match a literal substring,
 * and `id: 'usdz',` stays present whether or not `canImport` is true, so the
 * page's own block would stay green through a format losing import.
 */
import { readFileSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import {
	IMPORTABLE_FORMAT_LABELS,
	MODEL_FORMAT_IDS
} from '@vctrl/core/model-formats'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../..')

const SEARCH_ROOTS = [
	'packages/core/src',
	'packages/hooks/src',
	'packages/viewer/src',
	'shared/components/src',
	'shared/utils/src',
	'apps/vectreal-platform/app'
]

const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', 'build', '.nx'])

/**
 * Files allowed to enumerate the set, each for a reason that is not "it was
 * easier". A new entry here needs one too.
 */
const ALLOWED = new Map<string, string>([
	[
		'packages/core/src/model-formats/model-formats.ts',
		'The owner. This is the statement every other file derives from.'
	],
	[
		/*
		  KNOWN, FILED, NOT FIXED HERE. `ExportFormat` is a fourth statement of
		  the writable set, and it carries `glb-draco` as if Draco were a format -
		  the same mistake the converter had, where a document extension was read
		  as a property of GLB. Rewiring it means touching the publisher's save
		  UI, which this change does not otherwise open, so it is a catalogue row
		  rather than a line in this diff. Listed rather than excluded so the
		  debt is visible from the test that would otherwise hide it.
		*/
		'apps/vectreal-platform/app/components/publisher/sidebars/publish-sidebar/sections/save-options.tsx',
		'Known duplicate of the writable set; filed, see the comment above.'
	]
])

function sourceFiles(): string[] {
	const found: string[] = []

	const walk = (directory: string) => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				if (SKIP_DIRECTORIES.has(entry.name)) continue
				walk(join(directory, entry.name))
				continue
			}
			if (/\.(ts|tsx)$/.test(entry.name) && !/\.spec\.tsx?$/.test(entry.name)) {
				found.push(join(directory, entry.name))
			}
		}
	}

	for (const root of SEARCH_ROOTS) walk(resolve(ROOT, root))

	return found
}

/** `'glb' | 'gltf'`, `'glb' | 'gltf' | 'usdz'`, and so on. */
const UNION = new RegExp(
	`'(?:${MODEL_FORMAT_IDS.join('|')})'(?:\\s*\\|\\s*'[a-z0-9-]+')+`,
	'g'
)

/** `['glb', 'gltf']` and its `as const` form. */
const ARRAY = new RegExp(
	`\\[\\s*'(?:${MODEL_FORMAT_IDS.join('|')})'\\s*,\\s*'[a-z0-9-]+'`,
	'g'
)

describe('only one module enumerates the accepted formats', () => {
	const files = sourceFiles()

	it('finds source to search, so a broken walk cannot pass silently', () => {
		expect(files.length).toBeGreaterThan(500)
	})

	it.each([
		['a union type', UNION],
		['an array literal', ARRAY]
	])('states the set as %s nowhere but the owner', (_shape, pattern) => {
		const offenders: string[] = []

		for (const file of files) {
			const path = relative(ROOT, file)
			if (ALLOWED.has(path)) continue

			const matches = readFileSync(file, 'utf8').match(pattern)
			if (matches) offenders.push(`${path}: ${matches.join(', ')}`)
		}

		expect(
			offenders,
			'A second statement of the accepted-format set. Read it from ' +
				'`@vctrl/core/model-formats` instead, or add it to ALLOWED with a ' +
				'reason that is not "it was easier".'
		).toEqual([])
	})

	it('allows nothing that has moved or been cleaned up', () => {
		/*
		  `ALLOWED` is consulted as `if (ALLOWED.has(path)) continue`, so an entry
		  naming a file that was renamed, deleted, or has since been fixed never
		  fails - it just sits there quietly widening the allowlist for whatever
		  file lands at that path later. This branch is mid-move (the accept
		  pattern hook and `FileSizeComparison` both changed directories), so it
		  is a live hazard rather than a theoretical one.

		  Fresh regexes: both module-level ones carry `g`, whose `lastIndex` is
		  stateful across `.test()` calls.
		*/
		for (const path of ALLOWED.keys()) {
			const text = readFileSync(resolve(ROOT, path), 'utf8')

			expect(
				new RegExp(UNION.source).test(text) ||
					new RegExp(ARRAY.source).test(text),
				`${path} is allowed to enumerate the set but no longer does - drop it`
			).toBe(true)
		}
	})

	/*
	  Every page that prints a "Supported formats" table, and what it is for.

	  ACCEPTANCE, NOT DECLARATION. `upload.mdx` told readers for years to convert
	  OBJ, FBX and STL away before uploading, while the loader read all three. A
	  claims block can pin that the owner *declares* a format; only this can say
	  the table matches what the owner actually accepts, which is the sentence a
	  reader acts on.

	  Three pages rather than one, because the same drift happened to all of them
	  and only `upload.mdx` was gated. The two added here each carried a USDZ row
	  promising "limited support" for an import that threw on every file.

	  Mutation gates, executed: flipping `canImport` on any format reddens all
	  three and leaves every claims block on those pages green, which is the case
	  this exists for; adding a row without adding the format reddens it too.
	*/
	it.each([
		'apps/vectreal-platform/app/routes/docs/guides/upload.mdx',
		'apps/vectreal-platform/app/routes/docs/getting-started/first-model.mdx',
		'apps/vectreal-platform/app/routes/news-room-page/articles/02_the-vectreal-publisher-walkthrough.mdx'
	])('%s lists exactly the formats the loader accepts', (path) => {
		const page = readFileSync(resolve(ROOT, path), 'utf8')

		/*
		  Anchored to the heading, so an unrelated table on the same page cannot
		  be read as a format list, and stopped at the blank line that ends the
		  table. `**glTF**` and `glTF` both occur across these three.
		*/
		const table =
			/(?:#+\s*|\*\*)Supported formats\**:?\**\s*\n+((?:\|.*\n)+)/.exec(page)

		expect(
			table,
			`${path} has no "Supported formats" table to check`
		).not.toBeNull()

		const listed = [
			...table![1].matchAll(/^\|\s\*{0,2}([A-Za-z]+)\*{0,2}\s\|/gm)
		]
			.map((match) => match[1].toLowerCase())
			.filter((name) => name !== 'format')

		/*
		  Compared as sets. The owner's declaration order is dispatch precedence -
		  `gltf` leads so a folder holding a `.gltf` beside a `.glb` reads as the
		  bundle - and a docs table's order is editorial. Asserting the order would
		  redden these pages for a reordering made about folder-drop
		  disambiguation, which is not a claim they make.
		*/
		expect([...listed].sort()).toEqual(
			IMPORTABLE_FORMAT_LABELS.map((label) => label.toLowerCase()).sort()
		)
	})

	it('catches the shape it is looking for', () => {
		// So a regex that matches nothing cannot read as compliance, which is the
		// failure mode `eslint-house-rules.spec.ts` was written for.
		expect("type F = 'glb' | 'gltf' | 'usdz'").toMatch(UNION)
		expect("const F = ['glb', 'gltf'] as const").toMatch(ARRAY)
		expect("const only = ['usdz']").not.toMatch(ARRAY)
		expect("format: 'glb'").not.toMatch(UNION)
	})
})
