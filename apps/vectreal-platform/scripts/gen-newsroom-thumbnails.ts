/**
 * Bakes news-room card and og images from the shared scene core.
 *
 * Run via: pnpm nx run vectreal-platform:gen-thumbnails
 *
 * FONT WARNING. The 2026-08-02 spec claimed sharp's `fontfile` option loads the
 * @fontsource-variable/dm-sans woff2. It does not: passing `fontfile` produces
 * byte-identical output to omitting it, and pairing it with a nonexistent
 * family falls back exactly as if it were absent. Text therefore resolves by
 * system font name, and `assertFontAvailable` below fails loudly rather than
 * letting anyone silently commit images rendered in a fallback face.
 */
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { PALETTE } from '../app/lib/newsroom-thumbnail/palette'
import { seedFromSlug } from '../app/lib/newsroom-thumbnail/prng'
import { renderSvg } from '../app/lib/newsroom-thumbnail/render-svg'
import {
	BAKED_GRID,
	heightfield
} from '../app/lib/newsroom-thumbnail/scenes/heightfield'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))

const ARTICLES_DIR = path.resolve(
	scriptDir,
	'../app/routes/news-room-page/articles'
)
const PUBLIC_IMAGES_DIR = path.resolve(
	scriptDir,
	'../public/assets/images/newsroom'
)
const PUBLIC_IMAGE_URL_PREFIX = '/assets/images/newsroom'
const BASE_URL = 'https://vectreal.com/news-room'

const FONT_FAMILY = 'DM Sans'
const OG_SIZE = { width: 1200, height: 630 }
const SCENE_SIZE = { width: 1200, height: 630 }

/**
 * Renders a probe under DM Sans and under a family that cannot exist.
 * Identical output means DM Sans did not resolve and every image would bake in
 * a fallback face.
 */
async function assertFontAvailable(): Promise<void> {
	const probe = async (font: string) => {
		const buffer = await sharp({
			text: { text: 'Hamburgefonstiv 123', font, dpi: 200, rgba: true }
		})
			.png()
			.toBuffer()

		return createHash('sha1').update(buffer).digest('hex')
	}

	const [real, bogus] = await Promise.all([
		probe(FONT_FAMILY),
		probe('NoSuchFamilyVectrealProbe')
	])

	if (real === bogus) {
		throw new Error(
			`"${FONT_FAMILY}" is not installed as a system font, so images would be ` +
				'baked in a fallback face. Install DM Sans ' +
				'(https://fonts.google.com/specimen/DM+Sans) and re-run. Note that ' +
				'sharp cannot load the woff2 from @fontsource-variable/dm-sans.'
		)
	}
}

/**
 * Minimal top-level YAML reader. Does not descend into nested keys such as the
 * author object, which nothing here needs.
 */
function parseFrontmatter(content: string): Record<string, string> {
	const match = content.match(/^---\n([\s\S]*?)\n---/)

	if (!match) {
		return {}
	}

	const result: Record<string, string> = {}

	for (const line of match[1].split('\n')) {
		const pair = line.match(/^([a-zA-Z][a-zA-Z0-9_]*):\s*(.+)$/)

		if (!pair) {
			continue
		}

		let value = pair[2].trim()

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1)
		}

		result[pair[1]] = value
	}

	return result
}

async function writeFrontmatterField(
	filePath: string,
	key: string,
	value: string
): Promise<void> {
	const original = await readFile(filePath, 'utf8')
	const quoted = `"${value}"`
	const existing = new RegExp(`^(${key}:\\s*).*$`, 'm')

	if (existing.test(original)) {
		const updated = original.replace(existing, `$1${quoted}`)

		if (updated !== original) {
			await writeFile(filePath, updated, 'utf8')
		}

		return
	}

	const firstFenceEnd = original.indexOf('\n', original.indexOf('---')) + 1
	const closingPos = original.indexOf('---', firstFenceEnd)

	await writeFile(
		filePath,
		`${original.slice(0, closingPos)}${key}: ${quoted}\n${original.slice(closingPos)}`,
		'utf8'
	)
}

function wrapTitle(
	title: string,
	maxChars: number,
	maxLines: number
): string[] {
	const lines: string[] = []
	let current = ''

	for (const word of title.split(/\s+/)) {
		const candidate = current ? `${current} ${word}` : word

		if (candidate.length > maxChars && current) {
			lines.push(current)
			current = word

			if (lines.length === maxLines) {
				return lines
			}
		} else {
			current = candidate
		}
	}

	if (current && lines.length < maxLines) {
		lines.push(current)
	}

	return lines
}

function escapeMarkup(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
}

async function textLayer(
	text: string,
	fontSize: number,
	color: string,
	letterSpacingPt = 0
): Promise<Buffer> {
	const spacing = letterSpacingPt
		? ` letter_spacing="${letterSpacingPt * 1024}"`
		: ''

	return sharp({
		text: {
			text: `<span foreground="${color}"${spacing}>${escapeMarkup(text)}</span>`,
			font: `${FONT_FAMILY} ${fontSize}`,
			rgba: true,
			dpi: 72
		}
	})
		.png()
		.toBuffer()
}

async function renderArticle(fileName: string): Promise<void> {
	const filePath = path.join(ARTICLES_DIR, fileName)
	const source = await readFile(filePath, 'utf8')
	const frontmatter = parseFrontmatter(source)

	const slug =
		frontmatter.slug || fileName.replace(/^\d+_/, '').replace(/\.mdx?$/i, '')
	const seed = frontmatter.heroSeed
		? Number(frontmatter.heroSeed)
		: seedFromSlug(slug)

	// One scene render serves the article hero and the listing's featured block.
	// The og image is the same scene with text composited on top, so both come
	// from a single seed and never drift apart.
	const sceneSvg = renderSvg(
		heightfield(seed, { viewport: SCENE_SIZE, grid: BAKED_GRID }),
		{ viewport: SCENE_SIZE, background: true }
	)

	await sharp(Buffer.from(sceneSvg))
		.webp({ quality: 90 })
		.toFile(path.join(PUBLIC_IMAGES_DIR, `scene-${slug}.webp`))

	const ogSvg = renderSvg(
		heightfield(seed, { viewport: OG_SIZE, grid: BAKED_GRID }),
		{ viewport: OG_SIZE, background: true }
	)

	const scrim = Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${OG_SIZE.width}" height="${OG_SIZE.height}">` +
			'<defs><linearGradient id="s" x1="0" y1="1" x2="0" y2="0">' +
			`<stop offset="0.04" stop-color="${PALETTE.background}" stop-opacity="0.97"/>` +
			`<stop offset="0.45" stop-color="${PALETTE.background}" stop-opacity="0.72"/>` +
			`<stop offset="1" stop-color="${PALETTE.background}" stop-opacity="0"/>` +
			'</linearGradient></defs>' +
			`<rect width="${OG_SIZE.width}" height="${OG_SIZE.height}" fill="url(#s)"/></svg>`
	)

	const titleLines = wrapTitle(frontmatter.title ?? '', 34, 3)
	const titleSize = titleLines.length > 2 ? 50 : 60
	const lineHeight = Math.round(titleSize * 1.18)

	const eyebrow = await textLayer(
		(frontmatter.category ?? 'news').toUpperCase(),
		20,
		'#FC6C18',
		3
	)
	const titleLayers = await Promise.all(
		titleLines.map((line) => textLayer(line, titleSize, '#F2F3F5'))
	)
	const url = await textLayer(`${BASE_URL}/${slug}`, 20, '#8B8F96')

	const left = 64
	const bottom = OG_SIZE.height - 56
	const urlTop = bottom - 24
	const ruleTop = urlTop - 22
	const titleBottom = ruleTop - 26
	const titleTop = titleBottom - titleLines.length * lineHeight
	const eyebrowTop = titleTop - 38

	await sharp(Buffer.from(ogSvg))
		.composite([
			{ input: scrim, top: 0, left: 0 },
			{ input: eyebrow, top: eyebrowTop, left },
			...titleLayers.map((input, index) => ({
				input,
				top: titleTop + index * lineHeight,
				left
			})),
			{
				input: Buffer.from(
					'<svg xmlns="http://www.w3.org/2000/svg" width="72" height="2">' +
						'<rect width="72" height="2" fill="#FC6C18"/></svg>'
				),
				top: ruleTop,
				left
			},
			{ input: url, top: urlTop, left }
		])
		.webp({ quality: 90 })
		.toFile(path.join(PUBLIC_IMAGES_DIR, `og-${slug}.webp`))

	await writeFrontmatterField(
		filePath,
		'sceneImage',
		`${PUBLIC_IMAGE_URL_PREFIX}/scene-${slug}.webp`
	)
	await writeFrontmatterField(
		filePath,
		'coverImage',
		`${PUBLIC_IMAGE_URL_PREFIX}/og-${slug}.webp`
	)

	console.log(`  ${slug} (seed ${seed})`)
}

async function main(): Promise<void> {
	await assertFontAvailable()
	await mkdir(PUBLIC_IMAGES_DIR, { recursive: true })

	const files = (await readdir(ARTICLES_DIR)).filter((name) =>
		/\.mdx?$/i.test(name)
	)

	console.log(`Generating images for ${files.length} article(s)`)

	for (const file of files) {
		await renderArticle(file)
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error)
	process.exit(1)
})
