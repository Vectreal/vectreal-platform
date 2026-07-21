// perspective-thumbnail-gen.mjs
// PERSPECTIVE ILLUSION - News-room thumbnail generator (3D "hollow box" variant)
//
// Same pipeline as truchet-thumbnail-gen.mjs, but instead of a flat truchet
// tile mosaic, the background is a one-point-perspective "room" - concentric
// trapezoidal wall bands receding toward a centered vanishing point, like a
// forced-perspective box punched into the canvas - with a handful of twisting
// ribbon strokes woven through the depth. The ribbons are split into depth
// bands and each band's stacking order is shuffled (seeded), so ribbons swap
// in front of / behind one another as they cross, similar to the anamorphic
// illusion billboards where a flat 2D plane reads as a hollow 3D volume.
//
// Generates two WebP images per article from the same seeded scene:
//
//   thumbnail-<slug>.webp  - pure illusion scene, no text overlay
//                            used as the visual card image on the listing page
//                            written to frontmatter as `thumbnailImage`
//
//   og-<slug>.webp         - scene + solid panel with title, category & URL
//                            used as the og:image / SEO social card
//                            written to frontmatter as `coverImage`
//
// This is a standalone alternative to truchet-thumbnail-gen.mjs - run it for
// whichever article(s) should use the 3D illusion look instead of the flat
// mosaic. Output filenames match the truchet script, so running this against
// an article will overwrite that article's existing thumbnail/og images.
//
// Both variants share the same seeded RNG so the scene is identical. Each
// article's numeric filename prefix (e.g. "01_", "02_") is used as the
// deterministic seed, so output is stable across re-runs.
//
// Frontmatter fields consumed:
//   title     - headline text rendered on the OG panel
//   slug      - appended to BASE_URL to form the article URL in the OG footer
//   category  - displayed in the tag chip (uppercased)
//
// Usage:
//   Batch (all articles):   node scripts/perspective-thumbnail-gen.mjs
//   Single MDX file:        node scripts/perspective-thumbnail-gen.mjs apps/.../01_article.mdx
//   Manual / legacy:        SEED=42 node scripts/perspective-thumbnail-gen.mjs "Title" "Category"
//
// Requires:  npm i sharp  (or pnpm add -w sharp)
// Output:    apps/vectreal-platform/public/assets/images/newsroom/<article-number>/

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

// ---------- config ----------
const W = 1200,
	H = 630

// Canonical base URL for news-room articles - slug is appended per article
const BASE_URL = 'https://vectreal.com/news-room'

// Path to the MDX articles folder, relative to this script
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ARTICLES_DIR = path.resolve(
	__dirname,
	'../app/routes/news-room-page/articles'
)

// Public static-assets destination - thumbnails land here so Vite/RR serves
// them at the root-relative path used in coverImage frontmatter.
const PUBLIC_IMAGES_DIR = path.resolve(
	__dirname,
	'../public/assets/images/newsroom'
)

// Root-relative public URL prefix used as the coverImage value written back
// into MDX frontmatter. Must match the directory above.
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

// ---------- muted anthracite palette ----------
// Pulled from shared/components/src/styles/globals.css dark-theme tokens
// (oklch converted to sRGB hex) so the walls read as the same desaturated
// grey used for `--muted` / `--muted-foreground` elsewhere in the app,
// rather than an invented color:
//   --muted            oklch(0.269 0 0)  ≈ #262626
//   --muted-foreground oklch(0.708 0 0)  ≈ #a1a1a1
const MUTED = '#262626'
const MUTED_FG = '#a1a1a1'

// Brand orange - used for the floating cube wireframe so it reads as a single
// accented focal object against the neutral grey room.
const ORANGE = '#fc6c18'

// Lightens (positive) or darkens (negative) a hex color by an amount in
// [-1, 1], used to derive the gradient stops and per-wall lighting from the
// single muted base tone instead of stepped alternating bands.
function shade(hex, amount) {
	const num = parseInt(hex.slice(1), 16)
	const clamp = (v) => Math.min(255, Math.max(0, Math.round(v)))
	const delta = amount * 255
	const r = clamp((num >> 16) + delta)
	const g = clamp(((num >> 8) & 0xff) + delta)
	const b = clamp((num & 0xff) + delta)
	return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

// ---------- perspective projection ----------
// A single pinhole projection shared by the room walls, the wall grid, and
// the floating cube, so everything sits in one consistent 3D space.
// Room space: X and Y run in [-1, 1] across the near opening; Z is camera
// depth, with the near opening (the outer frame) at Z = 1 and the back wall
// at Z = 1 / (1 - f). Screen position is vp + (X or Y) * scale / Z, i.e.
// things shrink toward the vanishing point as Z grows.
function makeProjector(margin, f) {
	const vp = { x: W / 2, y: H / 2 }
	const sx = W / 2 - margin
	const sy = H / 2 - margin
	const zBack = 1 / (1 - f)
	const project = (X, Y, Z) => ({
		x: vp.x + (X * sx) / Z,
		y: vp.y + (Y * sy) / Z
	})
	return { vp, zBack, project }
}

// ---------- perspective box + wall grid ----------
// Draws the hollow room (four receding walls + a lit back wall) with soft,
// low-contrast gradients so the depth reads calm rather than dramatic, then
// lays a fine grid over every wall. The grid is drawn at low opacity and
// further faded toward the vanishing point via a radial mask, so it melts
// away into the back of the room instead of hard-edging at the back wall.
function buildBox(proj) {
	const { project, zBack } = proj

	// Corner helpers in room space: (X, Y) at a given depth Z.
	const at = (X, Y, Z) => project(X, Y, Z)
	const frontZ = 1

	const poly = (pts, fill) =>
		`<polygon points="${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="${fill}"/>`

	// Front-opening and back-wall corners.
	const F = {
		TL: at(-1, -1, frontZ),
		TR: at(1, -1, frontZ),
		BR: at(1, 1, frontZ),
		BL: at(-1, 1, frontZ)
	}
	const B = {
		TL: at(-1, -1, zBack),
		TR: at(1, -1, zBack),
		BR: at(1, 1, zBack),
		BL: at(-1, 1, zBack)
	}

	// Soft per-wall lighting bias off the muted base - gentle so the room
	// looks evenly lit, not spotlit. Ceiling a touch lighter, floor a touch
	// darker.
	const lighting = { top: 0.03, right: -0.01, bottom: -0.04, left: -0.02 }
	const walls = [
		{ name: 'top', dir: [0, 0, 0, 1], pts: [F.TL, F.TR, B.TR, B.TL] },
		{ name: 'right', dir: [1, 0, 0, 0], pts: [F.TR, F.BR, B.BR, B.TR] },
		{ name: 'bottom', dir: [0, 1, 0, 0], pts: [F.BR, F.BL, B.BL, B.BR] },
		{ name: 'left', dir: [0, 0, 1, 0], pts: [F.BL, F.TL, B.TL, B.BL] }
	]

	let defs = ''
	let shapes = ''
	for (const w of walls) {
		const bias = lighting[w.name]
		// Narrower stop range than before = flatter, less dramatic gradient.
		const outerColor = shade(MUTED, 0.06 + bias)
		const innerColor = shade(MUTED, -0.03 + bias)
		const id = `wall-${w.name}`
		const [x1, y1, x2, y2] = w.dir
		defs += `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
      <stop offset="0%" stop-color="${outerColor}"/>
      <stop offset="100%" stop-color="${innerColor}"/>
    </linearGradient>`
		shapes += poly(w.pts, `url(#${id})`)
	}

	// Back wall - a gently lit solid surface (soft, low-contrast glow) plus a
	// faint rim so its edge stays legible against the black backdrop.
	const backCx = (B.TL.x + B.TR.x) / 2
	const backCy = (B.TL.y + B.BL.y) / 2
	const backR = Math.max(B.TR.x - B.TL.x, B.BL.y - B.TL.y) * 0.8
	defs += `<radialGradient id="wall-back" cx="${backCx}" cy="${backCy}" r="${backR}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${shade(MUTED, 0.12)}"/>
      <stop offset="100%" stop-color="${shade(MUTED, 0.02)}"/>
    </radialGradient>`
	shapes += poly([B.TL, B.TR, B.BR, B.BL], 'url(#wall-back)')
	shapes += `<polygon points="${[B.TL, B.TR, B.BR, B.BL].map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="none" stroke="${shade(MUTED, 0.22)}" stroke-width="1.5" opacity="0.4"/>`

	// --- fine wall grid ---
	// Longitudinal lines run front-to-back at fixed cross-positions; depth
	// lines are cross-sections at evenly spaced Z (they compress toward the
	// back on their own, via the projection). Each wall is parameterized by
	// the two axes that vary across it.
	const NCROSS = 12 // divisions across each wall
	const NDEPTH = 7 // cross-section lines from front to back
	const seg = (a, b) =>
		`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"/>`

	// For each wall, `pt(u, z)` maps a cross-position u in [-1,1] and depth z
	// onto that wall's surface.
	const wallPt = {
		top: (u, z) => at(u, -1, z),
		bottom: (u, z) => at(u, 1, z),
		left: (u, z) => at(-1, u, z),
		right: (u, z) => at(1, u, z)
	}

	let grid = ''
	for (const name of ['top', 'bottom', 'left', 'right']) {
		const pt = wallPt[name]
		// Longitudinal lines (constant u, from front to back).
		for (let i = 0; i <= NCROSS; i++) {
			const u = -1 + (2 * i) / NCROSS
			grid += seg(pt(u, frontZ), pt(u, zBack))
		}
		// Depth lines (constant Z, spanning the wall's cross-axis).
		for (let j = 1; j <= NDEPTH; j++) {
			const z = frontZ + ((zBack - frontZ) * j) / (NDEPTH + 1)
			grid += seg(pt(-1, z), pt(1, z))
		}
	}

	// Radial mask centered on the vanishing point: opaque (grid visible) at
	// the outer frame, fading to transparent toward the center/back - so the
	// grid gently dissolves into the depth of the room.
	const maskR = Math.hypot(W / 2, H / 2)
	defs += `<radialGradient id="grid-fade" cx="${W / 2}" cy="${H / 2}" r="${maskR}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#000000"/>
      <stop offset="55%" stop-color="#3a3a3a"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </radialGradient>
    <mask id="grid-mask"><rect width="${W}" height="${H}" fill="url(#grid-fade)"/></mask>`
	shapes += `<g mask="url(#grid-mask)" stroke="${MUTED_FG}" stroke-width="0.75" opacity="0.5">${grid}</g>`

	return { defs: `<defs>${defs}</defs>`, shapes, proj }
}

// ---------- floating cube wireframe ----------
// Rotates a unit cube by random angles, drops it at a random position inside
// the room (auto-placed so no vertex crosses the near plane or pokes through
// the back wall), then projects and draws its 12 edges in brand orange with
// depth cues: nearer edges are brighter and thicker, farther edges dimmer and
// thinner, and edges are drawn back-to-front so the wireframe reads as a
// solid 3D object rather than a flat overlap of lines.
function buildCube(rand, proj) {
	const { project, zBack } = proj

	// Random orientation.
	const ax = rand() * Math.PI * 2
	const ay = rand() * Math.PI * 2
	const az = rand() * Math.PI * 2
	const rot = (x, y, z) => {
		// X axis
		let cy1 = Math.cos(ax),
			sy1 = Math.sin(ax)
		;[y, z] = [y * cy1 - z * sy1, y * sy1 + z * cy1]
		// Y axis
		let c2 = Math.cos(ay),
			s2 = Math.sin(ay)
		;[x, z] = [x * c2 + z * s2, -x * s2 + z * c2]
		// Z axis
		let c3 = Math.cos(az),
			s3 = Math.sin(az)
		;[x, y] = [x * c3 - y * s3, x * s3 + y * c3]
		return { x, y, z }
	}

	// Half-size of the cube in room units. Shrink until it can fit between the
	// near plane and the back wall for the chosen orientation.
	let s = pick(rand, [0.32, 0.38, 0.44])
	let offsets
	for (;;) {
		offsets = []
		for (let bx = -1; bx <= 1; bx += 2)
			for (let by = -1; by <= 1; by += 2)
				for (let bz = -1; bz <= 1; bz += 2)
					offsets.push(rot(bx * s, by * s, bz * s))
		const ozMin = Math.min(...offsets.map((o) => o.z))
		const ozMax = Math.max(...offsets.map((o) => o.z))
		// Valid center-Z window: min vertex >= 1.14, max vertex <= zBack - 0.12.
		const loZ = 1.14 - ozMin
		const hiZ = zBack - 0.12 - ozMax
		if (loZ <= hiZ || s <= 0.16) {
			var Zc = loZ <= hiZ ? loZ + (hiZ - loZ) * rand() : (loZ + hiZ) / 2
			break
		}
		s -= 0.04
	}

	// Random lateral placement, kept modest so the cube stays framed. Y is
	// biased slightly downward so the cube sits in the lower half - it stays
	// comfortably framed in the panel-less thumbnail while remaining visible
	// below the OG text panel (which fills the upper canvas).
	const Xc = (rand() - 0.5) * 0.5
	const Yc = 0.12 + (rand() - 0.5) * 0.3

	// World vertices + their projected screen points.
	const verts = offsets.map((o) => ({
		z: Zc + o.z,
		p: project(Xc + o.x, Yc + o.y, Zc + o.z)
	}))

	// 12 cube edges: vertex pairs differing in exactly one axis bit.
	const edges = []
	for (let i = 0; i < 8; i++)
		for (let j = i + 1; j < 8; j++) {
			const diff = i ^ j
			if (diff === 1 || diff === 2 || diff === 4) edges.push([i, j])
		}

	// Depth range for mapping near/far to width + brightness.
	const zs = verts.map((v) => v.z)
	const zMin = Math.min(...zs)
	const zMax = Math.max(...zs)
	const span = Math.max(0.001, zMax - zMin)

	// Draw farthest edges first so nearer ones sit on top.
	const drawn = edges
		.map(([i, j]) => ({ i, j, z: (verts[i].z + verts[j].z) / 2 }))
		.sort((a, b) => b.z - a.z)

	let out = ''
	// Soft outer glow pass (all edges, faint, behind the crisp lines).
	for (const e of drawn) {
		const a = verts[e.i].p,
			b = verts[e.j].p
		out += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${ORANGE}" stroke-width="8" stroke-linecap="round" opacity="0.12"/>`
	}
	// Crisp edge pass with depth-based width + opacity.
	for (const e of drawn) {
		const a = verts[e.i].p,
			b = verts[e.j].p
		const near = 1 - (e.z - zMin) / span // 1 = nearest, 0 = farthest
		const width = 1.6 + near * 2.2
		const opacity = (0.55 + near * 0.45).toFixed(2)
		out += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${ORANGE}" stroke-width="${width.toFixed(1)}" stroke-linecap="round" opacity="${opacity}"/>`
	}
	// Vertex dots, sized by depth, for a light "geometry node" accent.
	for (const v of verts) {
		const near = 1 - (v.z - zMin) / span
		const r = 2 + near * 2.5
		out += `<circle cx="${v.p.x.toFixed(1)}" cy="${v.p.y.toFixed(1)}" r="${r.toFixed(1)}" fill="${ORANGE}" opacity="${(0.6 + near * 0.4).toFixed(2)}"/>`
	}
	return out
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
//   1. Key already present - replaces the existing line in place.
//   2. Key absent - inserts a new line just before the closing `---`.
//   3. No frontmatter block at all - prepends a minimal block.
async function writeFrontmatterField(filePath, key, value) {
	const original = await fs.readFile(filePath, 'utf8')
	const quoted = `"${value}"`

	// Case 1: key already exists - replace in-place (handles quoted or unquoted)
	const existingKeyRe = new RegExp(`^(${key}:\\s*).*$`, 'm')
	if (existingKeyRe.test(original)) {
		const updated = original.replace(existingKeyRe, `$1${quoted}`)
		if (updated !== original) await fs.writeFile(filePath, updated, 'utf8')
		return
	}

	// Case 2: frontmatter exists but key is missing - insert before closing ---
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

	// Case 3: no frontmatter at all - prepend
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
	const articleFolder = numMatch ? numMatch[1] : null

	return {
		title: fm.title || filename,
		category: (fm.category || 'news').toUpperCase(),
		// slug is used to construct the full article URL shown in the footer
		slug: fm.slug || filename.replace(/\.mdx$/, ''),
		seed,
		articleFolder
	}
}

// ---------- illusion scene builder ----------
// Wraps the pre-built scene content (gridded room + cube, no overlay) in the
// outer SVG element.
function buildSceneSvg(content) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${content}
</svg>`
}

// ---------- OG panel SVG overlay ----------
// Returns an SVG string with the illusion scene plus the full text panel.
function buildOgSvg(content, t, category, title, slug) {
	// Construct the canonical article URL from the slug
	const articleUrl = `${BASE_URL}/${slug}`

	// Wrap title into lines for the panel (24 chars per line maximum)
	const lines = wrap(title, 24)

	// Panel layout - solid Swiss-style rectangle with a thick 6px accent border
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

  <!-- category tag - solid filled rect, no rounded corners (Swiss style) -->
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
  ${content}
  <!-- overlay panel -->
  ${panel}
</svg>`
}

// ---------- core render function ----------
// Generates two WebP files per article from the same seeded scene:
//   - thumbnail (no panel) → written to `thumbnailImage` frontmatter field
//   - OG image (with panel) → written to `coverImage` frontmatter field
// `sourceMdx` - when provided both frontmatter fields are updated in-place.
async function renderArticleImages({
	title,
	category,
	slug,
	seed,
	sourceMdx,
	articleFolder = null
}) {
	const rand = makePrng(seed)

	// All visual choices are derived from the seed - both images share these
	const t = pick(rand, THEMES)
	// Room depth: how far the back wall recedes (larger f = deeper room).
	const f = pick(rand, [0.55, 0.6, 0.65])
	const proj = makeProjector(40, f)

	// Build the scene once and reuse it in both SVG variants: the gridded
	// room, then the floating cube wireframe on top.
	const box = buildBox(proj)
	const cubeSvg = buildCube(rand, proj)
	const content = `${box.defs}<rect width="100%" height="100%" fill="${t.a}"/>\n  ${box.shapes}\n  ${cubeSvg}`

	const meta = `seed=${seed} theme=${THEMES.indexOf(t)} depth=${f}`

	const outputDir = articleFolder
		? path.join(PUBLIC_IMAGES_DIR, articleFolder)
		: PUBLIC_IMAGES_DIR
	await fs.mkdir(outputDir, { recursive: true })

	// --- thumbnail: pure scene, no overlay - used for listing-page cards ---
	const thumbnailPath = path.join(outputDir, `thumbnail-${slug}.webp`)
	const sceneSvg = buildSceneSvg(content)
	await sharp(Buffer.from(sceneSvg))
		.webp({ quality: 90 })
		.toFile(thumbnailPath)
	console.log(`✓ thumbnail  ${thumbnailPath}  ${meta}`)

	// --- OG image: scene + text panel - used for og:image / SEO social cards ---
	const ogPath = path.join(outputDir, `og-${slug}.webp`)
	const ogSvg = buildOgSvg(content, t, category, title, slug)
	await sharp(Buffer.from(ogSvg)).webp({ quality: 90 }).toFile(ogPath)
	console.log(`✓ og-image   ${ogPath}  ${meta}`)

	// Write both paths back into MDX frontmatter
	if (sourceMdx) {
		const articlePublicFolder = articleFolder ? `/${articleFolder}` : ''
		const thumbnailUrl = `${PUBLIC_IMAGE_URL_PREFIX}${articlePublicFolder}/thumbnail-${slug}.webp`
		const ogUrl = `${PUBLIC_IMAGE_URL_PREFIX}${articlePublicFolder}/og-${slug}.webp`
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
	// Batch mode - generate both images for every MDX file in the articles folder.
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
	// Single MDX file mode - generate both images and update frontmatter.
	const filePath = path.resolve(firstArg)
	const article = await loadArticle(filePath)
	await renderArticleImages({ ...article, sourceMdx: filePath })
} else {
	// Legacy manual mode - title and category passed as CLI args, seed from env.
	// Outputs both variants to the public images dir; no MDX file is updated.
	// Example: SEED=42 node scripts/perspective-thumbnail-gen.mjs "My Title" "Engineering"
	const seed = Number(process.env.SEED) || Math.floor(Math.random() * 1e9)
	const title = firstArg
	const category = (secondArg || 'Engineering').toUpperCase()
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
	await renderArticleImages({ title, category, slug, seed })
}
