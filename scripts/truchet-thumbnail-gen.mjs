// truchet-thumbnail-gen.mjs
// TRUCHET TILE MOSAIC — News-room thumbnail generator
//
// Generates two WebP images per article from the same seeded mosaic:
//
//   thumbnail-<slug>.webp  — pure mosaic, no text overlay
//                            used as the visual card image on the listing page
//                            written to frontmatter as `thumbnailImage`
//
//   og-<slug>.webp         — mosaic + solid panel with title, category & URL
//                            used as the og:image / SEO social card
//                            written to frontmatter as `coverImage`
//
// Both variants share the same seeded RNG so the mosaic pattern is identical.
// Each article's numeric filename prefix (e.g. "01_", "02_") is used as the
// deterministic seed, so output is stable across re-runs.
//
// Frontmatter fields consumed:
//   title     — headline text rendered on the OG panel
//   slug      — appended to BASE_URL to form the article URL in the OG footer
//   category  — displayed in the tag chip (uppercased)
//
// Usage:
//   Batch (all articles):   node scripts/truchet-thumbnail-gen.mjs
//   Single MDX file:        node scripts/truchet-thumbnail-gen.mjs apps/.../01_article.mdx
//   Manual / legacy:        SEED=42 node scripts/truchet-thumbnail-gen.mjs "Title" "Category"
//
// Requires:  npm i sharp  (or pnpm add -w sharp)
// Output:    apps/vectreal-platform/public/assets/images/newsroom/

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

// ---------- config ----------
const W = 1200,
	H = 630

// Canonical base URL for news-room articles — slug is appended per article
const BASE_URL = 'https://vectreal.com/news-room'

// Path to the MDX articles folder, relative to this script
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ARTICLES_DIR = path.resolve(
	__dirname,
	'../apps/vectreal-platform/app/routes/news-room-page/articles'
)

// Public static-assets destination — thumbnails land here so Vite/RR serves
// them at the root-relative path used in coverImage frontmatter.
const PUBLIC_IMAGES_DIR = path.resolve(
	__dirname,
	'../apps/vectreal-platform/public/assets/images/newsroom'
)

// Root-relative public URL prefix used as the coverImage value written back
// into MDX frontmatter.  Must match the directory above.
const PUBLIC_IMAGE_URL_PREFIX = '/assets/images/newsroom'

// ---------- deterministic LCG PRNG ----------
// Returns a stateful rand() function seeded from `seed`.
// Using an LCG so the same seed always produces the same visual output.
function makePrng(seed) {
	let s = seed >>> 0
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0
		return s / 0x100000000
	}
}

const pick = (rand, a) => a[Math.floor(rand() * a.length)]

// ---------- 3 theme variants (solid colors only, no gradients) ----------
const THEMES = [
	// Dark background, orange accent
	{
		a: '#000000',
		b: '#fc6c18',
		panelBg: '#000000',
		panelFg: '#FFFFFF',
		panelAccent: '#fc6c18'
	},
	// Inverted: orange background, dark tiles
	{
		a: '#fc6c18',
		b: '#000000',
		panelBg: '#000000',
		panelFg: '#FFFFFF',
		panelAccent: '#fc6c18'
	},
	// Orange panel variant
	{
		a: '#000000',
		b: '#fc6c18',
		panelBg: '#fc6c18',
		panelFg: '#000000',
		panelAccent: '#000000'
	}
]

// ---------- SVG tile builders ----------
function tileSVG(rand, tileSize, tileKind, t, i, rot) {
	const S = tileSize
	const r = S / 2
	// Randomly flip foreground/background for visual variety within a tile
	const flip = rand() < 0.35
	const bg = flip ? t.b : t.a
	const fg = flip ? t.a : t.b
	const transform = `rotate(${rot} ${r} ${r})`

	if (tileKind === 'arcs') {
		// Classic Truchet: two quarter-circle arcs
		return `<g transform="translate(${i.x * S} ${i.y * S})">
      <rect width="${S}" height="${S}" fill="${bg}"/>
      <g transform="${transform}">
        <path d="M 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 L 0 0 Z" fill="${fg}"/>
        <path d="M ${S} ${r} A ${r} ${r} 0 0 0 ${r} ${S} L ${S} ${S} Z" fill="${fg}"/>
      </g>
    </g>`
	}
	if (tileKind === 'diag') {
		// Right-triangle diagonal split
		return `<g transform="translate(${i.x * S} ${i.y * S})">
      <rect width="${S}" height="${S}" fill="${bg}"/>
      <g transform="${transform}">
        <polygon points="0,0 ${S},0 0,${S}" fill="${fg}"/>
      </g>
    </g>`
	}
	if (tileKind === 'tri') {
		// Centered triangle pointing in a random direction
		return `<g transform="translate(${i.x * S} ${i.y * S})">
      <rect width="${S}" height="${S}" fill="${bg}"/>
      <g transform="${transform}">
        <polygon points="${r},4 ${S - 4},${S - 4} 4,${S - 4}" fill="${fg}"/>
      </g>
    </g>`
	}

	// mixed: each tile independently picks a sub-type
	const sub = pick(rand, ['arcs', 'diag', 'tri', 'dot', 'plus'])
	if (sub === 'dot') {
		return `<g transform="translate(${i.x * S} ${i.y * S})">
      <rect width="${S}" height="${S}" fill="${bg}"/>
      <circle cx="${r}" cy="${r}" r="${r * 0.45}" fill="${fg}"/>
    </g>`
	}
	if (sub === 'plus') {
		const w = S * 0.22
		return `<g transform="translate(${i.x * S} ${i.y * S})">
      <rect width="${S}" height="${S}" fill="${bg}"/>
      <rect x="${r - w / 2}" y="4" width="${w}" height="${S - 8}" fill="${fg}"/>
      <rect x="4" y="${r - w / 2}" width="${S - 8}" height="${w}" fill="${fg}"/>
    </g>`
	}
	// Fallback: arcs
	return `<g transform="translate(${i.x * S} ${i.y * S})">
    <rect width="${S}" height="${S}" fill="${bg}"/>
    <g transform="${transform}">
      <path d="M 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 L 0 0 Z" fill="${fg}"/>
      <path d="M ${S} ${r} A ${r} ${r} 0 0 0 ${r} ${S} L ${S} ${S} Z" fill="${fg}"/>
    </g>
  </g>`
}

// ---------- helpers ----------

// Escape XML special characters for safe SVG text embedding
const esc = (str) =>
	str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Wrap a title string into lines of at most `maxChars` characters
function wrap(text, maxChars) {
	const words = text.split(' ')
	const out = []
	let line = ''
	for (const w of words) {
		if ((line + ' ' + w).trim().length > maxChars && line) {
			out.push(line)
			line = w
		} else {
			line = (line ? line + ' ' : '') + w
		}
	}
	if (line) out.push(line)
	return out
}

// ---------- minimal YAML frontmatter parser ----------
// Handles top-level `key: "quoted value"` and `key: unquoted value` pairs.
// Does not attempt to parse nested keys (e.g. author sub-object).
function parseFrontmatter(content) {
	const match = content.match(/^---\n([\s\S]*?)\n---/)
	if (!match) return {}
	const result = {}
	for (const line of match[1].split('\n')) {
		const m = line.match(/^([a-zA-Z][a-zA-Z0-9_]*):\s*(.+)$/)
		if (!m) continue
		let val = m[2].trim()
		// Strip surrounding single or double quotes
		if (
			(val.startsWith('"') && val.endsWith('"')) ||
			(val.startsWith("'") && val.endsWith("'"))
		) {
			val = val.slice(1, -1)
		}
		result[m[1]] = val
	}
	return result
}

// ---------- frontmatter writer ----------
// Writes (or updates) a single top-level key in the MDX frontmatter block.
// Handles three cases:
//   1. Key already present — replaces the existing line in place.
//   2. Key absent — inserts a new line just before the closing `---`.
//   3. No frontmatter block at all — prepends a minimal block.
async function writeFrontmatterField(filePath, key, value) {
	const original = await fs.readFile(filePath, 'utf8')
	const quoted = `"${value}"`

	// Case 1: key already exists — replace in-place (handles quoted or unquoted)
	const existingKeyRe = new RegExp(`^(${key}:\\s*).*$`, 'm')
	if (existingKeyRe.test(original)) {
		const updated = original.replace(existingKeyRe, `$1${quoted}`)
		if (updated !== original) await fs.writeFile(filePath, updated, 'utf8')
		return
	}

	// Case 2: frontmatter exists but key is missing — insert before closing ---
	const closingFenceRe = /^---\s*$/m
	if (/^---/.test(original) && closingFenceRe.test(original.slice(3))) {
		// Find the second occurrence of `---`
		const firstFenceEnd = original.indexOf('\n', original.indexOf('---')) + 1
		const closingPos = original.indexOf('---', firstFenceEnd)
		const updated =
			original.slice(0, closingPos) +
			`${key}: ${quoted}\n` +
			original.slice(closingPos)
		await fs.writeFile(filePath, updated, 'utf8')
		return
	}

	// Case 3: no frontmatter at all — prepend
	await fs.writeFile(
		filePath,
		`---\n${key}: ${quoted}\n---\n\n${original}`,
		'utf8'
	)
}

// ---------- MDX article loader ----------
// Parses frontmatter from an MDX file and derives the seed from the
// numeric prefix in the filename (e.g. "01_launch-article.mdx" → seed 1).
async function loadArticle(filePath) {
	const content = await fs.readFile(filePath, 'utf8')
	const fm = parseFrontmatter(content)
	const filename = path.basename(filePath)

	// Use the leading article number as the seed for deterministic output
	const numMatch = filename.match(/^(\d+)_/)
	const seed = numMatch
		? parseInt(numMatch[1], 10)
		: Math.floor(Math.random() * 1e9)

	return {
		title: fm.title || filename,
		category: (fm.category || 'news').toUpperCase(),
		// slug is used to construct the full article URL shown in the footer
		slug: fm.slug || filename.replace(/\.mdx$/, ''),
		seed
	}
}

// ---------- mosaic SVG builder ----------
// Builds the base mosaic SVG string (tiles only, no overlay).
// The rand state is advanced in place, so theme/kind/size choices must be
// made before calling this — pass the already-advanced rand.
function buildMosaicSvg(rand, tileSize, tileKind, t, tiles) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <!-- base fill (tile color A covers any gaps) -->
  <rect width="100%" height="100%" fill="${t.a}"/>
  <!-- truchet tile mosaic -->
  ${tiles.join('')}
</svg>`
}

// ---------- OG panel SVG overlay ----------
// Returns an SVG string with the mosaic tiles plus the full text panel.
function buildOgSvg(tiles, t, category, title, slug) {
	// Construct the canonical article URL from the slug
	const articleUrl = `${BASE_URL}/${slug}`

	// Wrap title into lines for the panel (24 chars per line maximum)
	const lines = wrap(title, 24)

	// Panel layout — solid Swiss-style rectangle with a thick 6px accent border
	const panelX = 60,
		panelY = 60
	const panelPadX = 42,
		panelPadY = 36
	const titleSize = lines.length > 2 ? 50 : 60
	const lineH = titleSize * 1.05
	const panelW = W - 120
	const panelH =
		panelPadY * 2 +
		54 /* category tag */ +
		28 +
		lines.length * lineH +
		28 +
		28 /* url */

	const panel = `
  <!-- thick accent border: 6px offset outer rect -->
  <rect x="${panelX - 6}" y="${panelY - 6}" width="${panelW + 12}" height="${panelH + 12}" fill="${t.panelAccent}"/>
  <!-- panel background -->
  <rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" fill="${t.panelBg}"/>

  <!-- category tag — solid filled rect, no rounded corners (Swiss style) -->
  <rect x="${panelX + panelPadX}" y="${panelY + panelPadY}" width="${category.length * 12 + 42}" height="38" fill="${t.panelAccent}"/>
  <text x="${panelX + panelPadX + 16}" y="${panelY + panelPadY + 25}" font-family="Inter, Arial" font-size="16" font-weight="700" fill="${t.panelBg}" letter-spacing="3">${esc(category)}</text>

  <!-- brand name, top-right -->
  <text x="${panelX + panelW - panelPadX}" y="${panelY + panelPadY + 25}" text-anchor="end" font-family="Inter, Arial" font-size="18" font-weight="800" fill="${t.panelFg}" letter-spacing="4">VECTREAL</text>

  <!-- article title (line-wrapped) -->
  ${lines.map((l, i) => `<text x="${panelX + panelPadX}" y="${panelY + panelPadY + 54 + 28 + titleSize * 0.8 + i * lineH}" font-family="Inter, Arial" font-size="${titleSize}" font-weight="800" fill="${t.panelFg}" letter-spacing="-1">${esc(l)}</text>`).join('')}

  <!-- footer: short accent rule + full article URL -->
  <rect x="${panelX + panelPadX}" y="${panelY + panelH - panelPadY - 8}" width="60" height="3" fill="${t.panelAccent}"/>
  <text x="${panelX + panelPadX + 76}" y="${panelY + panelH - panelPadY + 2}" font-family="'JetBrains Mono', monospace" font-size="14" fill="${t.panelFg}" opacity="0.75">${esc(articleUrl)}</text>
`

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <!-- base fill (tile color A covers any gaps) -->
  <rect width="100%" height="100%" fill="${t.a}"/>
  <!-- truchet tile mosaic -->
  ${tiles.join('')}
  <!-- overlay panel -->
  ${panel}
</svg>`
}

// ---------- core render function ----------
// Generates two WebP files per article from the same seeded mosaic:
//   - thumbnail (no panel) → written to `thumbnailImage` frontmatter field
//   - OG image (with panel) → written to `coverImage` frontmatter field
// `sourceMdx` — when provided both frontmatter fields are updated in-place.
async function renderArticleImages({ title, category, slug, seed, sourceMdx }) {
	const rand = makePrng(seed)

	// All visual choices are derived from the seed — both images share these
	const t = pick(rand, THEMES)
	const tileKind = pick(rand, ['arcs', 'diag', 'tri', 'mixed'])
	const tileSize = pick(rand, [30, 40, 50])
	const cols = Math.ceil(W / tileSize)
	const rows = Math.ceil(H / tileSize)

	// Build the tile grid once and reuse it in both SVG variants
	const tiles = []
	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < cols; x++) {
			const rot = pick(rand, [0, 90, 180, 270])
			tiles.push(tileSVG(rand, tileSize, tileKind, t, { x, y }, rot))
		}
	}

	const meta = `seed=${seed} theme=${THEMES.indexOf(t)} kind=${tileKind} size=${tileSize}`

	await fs.mkdir(PUBLIC_IMAGES_DIR, { recursive: true })

	// --- thumbnail: pure mosaic, no overlay — used for listing-page cards ---
	const thumbnailPath = path.join(PUBLIC_IMAGES_DIR, `thumbnail-${slug}.webp`)
	const mosaicSvg = buildMosaicSvg(rand, tileSize, tileKind, t, tiles)
	await sharp(Buffer.from(mosaicSvg))
		.webp({ quality: 90 })
		.toFile(thumbnailPath)
	console.log(`✓ thumbnail  ${thumbnailPath}  ${meta}`)

	// --- OG image: mosaic + text panel — used for og:image / SEO social cards ---
	const ogPath = path.join(PUBLIC_IMAGES_DIR, `og-${slug}.webp`)
	const ogSvg = buildOgSvg(tiles, t, category, title, slug)
	await sharp(Buffer.from(ogSvg)).webp({ quality: 90 }).toFile(ogPath)
	console.log(`✓ og-image   ${ogPath}  ${meta}`)

	// Write both paths back into MDX frontmatter
	if (sourceMdx) {
		const thumbnailUrl = `${PUBLIC_IMAGE_URL_PREFIX}/thumbnail-${slug}.webp`
		const ogUrl = `${PUBLIC_IMAGE_URL_PREFIX}/og-${slug}.webp`
		await writeFrontmatterField(sourceMdx, 'thumbnailImage', thumbnailUrl)
		await writeFrontmatterField(sourceMdx, 'coverImage', ogUrl)
		console.log(
			`  → thumbnailImage + coverImage set in ${path.basename(sourceMdx)}`
		)
	}
}

// ---------- entry point ----------
const [, , firstArg, secondArg] = process.argv

if (!firstArg) {
	// Batch mode — generate both images for every MDX file in the articles folder.
	const files = (await fs.readdir(ARTICLES_DIR))
		.filter((f) => f.endsWith('.mdx'))
		.sort() // process in filename (numeric prefix) order
	console.log(
		`Generating images for ${files.length} article(s) from ${ARTICLES_DIR}`
	)
	for (const file of files) {
		const filePath = path.join(ARTICLES_DIR, file)
		const article = await loadArticle(filePath)
		await renderArticleImages({ ...article, sourceMdx: filePath })
	}
} else if (firstArg.endsWith('.mdx')) {
	// Single MDX file mode — generate both images and update frontmatter.
	const filePath = path.resolve(firstArg)
	const article = await loadArticle(filePath)
	await renderArticleImages({ ...article, sourceMdx: filePath })
} else {
	// Legacy manual mode — title and category passed as CLI args, seed from env.
	// Outputs both variants to the public images dir; no MDX file is updated.
	// Example: SEED=42 node scripts/truchet-thumbnail-gen.mjs "My Title" "Engineering"
	const seed = Number(process.env.SEED) || Math.floor(Math.random() * 1e9)
	const title = firstArg || 'The Problem With 3D on the Web'
	const category = (secondArg || 'Engineering').toUpperCase()
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
	await renderArticleImages({ title, category, slug, seed })
}
