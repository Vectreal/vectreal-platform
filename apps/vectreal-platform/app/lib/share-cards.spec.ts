import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { buildMeta } from './seo'
import { SHARE_CARD_SIZE, shareCardImagePath } from './share-card-paths'
import { SHARE_CARDS, shareCardMeta } from './share-cards'
import baked from './share-cards.baked.json'

const PUBLIC_DIR = new URL('../../public', import.meta.url)

/** A PNG's size, from its IHDR chunk. */
function pngSize(path: string) {
	const bytes = readFileSync(
		fileURLToPath(new URL(`.${path}`, `${PUBLIC_DIR}/`))
	)
	return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

const metaContent = (meta: ReturnType<typeof buildMeta>, key: string) => {
	const found = meta.find(
		(one) =>
			('property' in one && one.property === key) ||
			('name' in one && one.name === key)
	)
	return found && 'content' in found ? found.content : undefined
}

describe('share cards', () => {
	/*
	  A card's text is read from its page's copy, but the image is baked, so the
	  copy can change under it. This is what notices: rerun
	  `pnpm nx run vectreal-platform:bake-share-cards` when it fails.
	*/
	it('says what its page says now', () => {
		expect(baked).toEqual(
			Object.fromEntries(SHARE_CARDS.map(({ slug, ...text }) => [slug, text]))
		)
	})

	it.each(SHARE_CARDS.map((card) => card.slug))(
		'%s is baked at 1200x630',
		(slug) => {
			expect(pngSize(shareCardImagePath(slug))).toEqual(SHARE_CARD_SIZE)
		}
	)

	it('gives a page its own card at its size, described by its caption', () => {
		expect(shareCardMeta('pricing')).toEqual({
			image: '/media/images/share/pricing.png',
			imageAlt: 'Start free. Pay when your scenes go live.',
			imageWidth: 1200,
			imageHeight: 630
		})
		expect(() => shareCardMeta('nope')).toThrow()
	})
})

describe('the default link preview', () => {
	it('is the default card, with its size and the large card type', () => {
		const meta = buildMeta()

		expect(metaContent(meta, 'og:image')).toBe(
			'https://vectreal.com/media/images/share/default.png'
		)
		expect(metaContent(meta, 'og:image:width')).toBe('1200')
		expect(metaContent(meta, 'og:image:height')).toBe('630')
		expect(metaContent(meta, 'twitter:card')).toBe('summary_large_image')
	})

	it("reports no size for a page's own image unless the page knows it", () => {
		const meta = buildMeta([], undefined, { image: '/cover.webp' })

		expect(metaContent(meta, 'og:image')).toBe(
			'https://vectreal.com/cover.webp'
		)
		expect(metaContent(meta, 'og:image:width')).toBeUndefined()
		expect(metaContent(meta, 'og:image:height')).toBeUndefined()
	})
})
