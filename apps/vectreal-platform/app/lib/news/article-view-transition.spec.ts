/**
 * A view transition pairs by name, and a name with no counterpart fails
 * silently: no error, no warning, the layer just fades on its own while
 * everything around it morphs. Naming one side and forgetting the other is
 * therefore the whole failure mode, and it survives review easily because both
 * pages still look correct standing still.
 *
 * So the interesting assertion is not what the builder returns - it is that
 * both ends of the pairing consume every key it hands out.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { newsroomMorphNames } from './article-view-transition'

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '../..')

/** The listing side of the morph. */
const LISTING_SOURCES = ['components/layout-components/featured-article.tsx']

/** The article side. */
const ARTICLE_SOURCES = ['components/layout-components/article-hero.tsx']

/**
 * Named on the listing only. The hero has no excerpt, so this layer is meant
 * to fade in place rather than pair - see the note on the builder.
 */
const LISTING_ONLY_KEYS = ['excerpt']

function read(paths: string[]): string {
	return paths
		.map((path) => readFileSync(join(APP_DIR, path), 'utf8'))
		.join('\n')
}

const MORPH_KEYS = Object.keys(newsroomMorphNames('x')) as Array<
	keyof ReturnType<typeof newsroomMorphNames>
>

const PAIRED_KEYS = MORPH_KEYS.filter((key) => !LISTING_ONLY_KEYS.includes(key))

describe('newsroomMorphNames', () => {
	it('scopes every name to the slug', () => {
		const names = Object.values(newsroomMorphNames('gltf-vs-glb'))

		expect(names.length).toBeGreaterThan(0)

		for (const name of names) {
			expect(name.endsWith('-gltf-vs-glb')).toBe(true)
		}
	})

	it('never collides between two articles', () => {
		const a = Object.values(newsroomMorphNames('api-keys-101'))
		const b = Object.values(newsroomMorphNames('optimization-presets'))

		expect(new Set([...a, ...b]).size).toBe(a.length + b.length)
	})

	it('emits valid CSS custom-idents', () => {
		// Slugs are `[a-z0-9-]+` via `normalizeSlug`, but a name starting with a
		// digit is not a valid ident - the constant prefix is what guarantees it.
		for (const name of Object.values(newsroomMorphNames('3d-model-basics'))) {
			expect(name).toMatch(/^-?[a-zA-Z_][\w-]*$/)
		}
	})
})

describe('morph pairing', () => {
	it.each(PAIRED_KEYS)('wires `%s` up on both sides', (key) => {
		const reference = new RegExp(`\\bmorph\\.${key}\\b`)

		expect(reference.test(read(LISTING_SOURCES))).toBe(true)
		expect(reference.test(read(ARTICLE_SOURCES))).toBe(true)
	})

	it.each(LISTING_ONLY_KEYS)('keeps `%s` on the listing only', (key) => {
		const reference = new RegExp(`\\bmorph\\.${key}\\b`)

		expect(reference.test(read(LISTING_SOURCES))).toBe(true)
		expect(reference.test(read(ARTICLE_SOURCES))).toBe(false)
	})

	it('gives every named layer a view-transition-class', () => {
		// Without a class the group is unselectable from CSS - the names are
		// per-slug, so there is no static selector to fall back on - and the
		// layer silently runs the browser default instead of the tuned timing.
		for (const source of [...LISTING_SOURCES, ...ARTICLE_SOURCES]) {
			const text = readFileSync(join(APP_DIR, source), 'utf8')
			const named = text.match(/viewTransitionName:/g) ?? []
			const classed = text.match(/vt-news-(plate|image|text)/g) ?? []

			expect(classed.length).toBeGreaterThanOrEqual(named.length)
		}
	})
})
