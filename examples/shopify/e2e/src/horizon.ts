import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
	Drop,
	type Context,
	type Emitter,
	type Liquid,
	Tag,
	type TagToken,
	type Template,
	type TopLevelToken
} from 'liquidjs'

/**
 * Horizon, the open theme Savor runs on, at a pinned commit of its main
 * branch. The harness renders its product gallery from Horizon's own
 * snippets, CSS and scripts, with the install lines from the gallery slide's
 * comment header added the way a merchant would add them.
 */
export const HORIZON_COMMIT = 'c531fd5bb8904e7f871c308b15c64a7cb0de8e20'
export const HORIZON_DIR = join(
	tmpdir(),
	`shopify-horizon-${HORIZON_COMMIT.slice(0, 12)}`
)
const OVERLAY_DIR = join(HORIZON_DIR, 'harness-overlay')
export const HORIZON_ROOTS = [OVERLAY_DIR, join(HORIZON_DIR, 'snippets')]

/** Downloads Horizon once per commit into the system's temp folder. */
export function ensureHorizon() {
	if (existsSync(join(HORIZON_DIR, 'snippets'))) return
	mkdirSync(HORIZON_DIR, { recursive: true })
	const archive = execFileSync(
		'curl',
		[
			'-fsSL',
			`https://codeload.github.com/Shopify/horizon/tar.gz/${HORIZON_COMMIT}`
		],
		{ maxBuffer: 256 * 1024 * 1024 }
	)
	execFileSync('tar', ['-xz', '--strip-components=1', '-C', HORIZON_DIR], {
		input: archive
	})
}

const readJson = (file: string) => {
	const text = readFileSync(join(HORIZON_DIR, file), 'utf8')
	// Shopify's generated JSON files open with a comment block.
	return JSON.parse(text.replace(/^\s*\/\*[\s\S]*?\*\//, ''))
}

/** Inserts `line` after the first `{% endfor %}` past `from` that `to` follows. */
function insertAfterLoop(
	source: string,
	from: string,
	to: string,
	line: string
) {
	const start = source.indexOf(from)
	const loop = new RegExp(
		`\\{% endfor %\\}(?=\\s*${to.replace(/[{}%]/g, '\\$&')})`,
		'g'
	)
	loop.lastIndex = start
	const match = start < 0 ? null : loop.exec(source)
	if (!match)
		throw new Error(
			`Horizon's gallery no longer has ${from} … {% endfor %} ${to}`
		)
	const at = match.index + match[0].length
	return `${source.slice(0, at)}\n${line}${source.slice(at)}`
}

/**
 * Horizon's gallery with the two lines the slide's comment header tells
 * merchants to add, read from that header, so the documented lines are the
 * tested ones.
 */
export async function patchHorizonGallery(snippetFile: string) {
	const header = await readFile(snippetFile, 'utf8')
	const installLine = (layout: string) => {
		const line = header
			.split('\n')
			.find((text) => text.includes(`layout: '${layout}'`))
		if (!line) throw new Error(`no ${layout} install line in ${snippetFile}`)
		return line.trim()
	}
	let gallery = await readFile(
		join(HORIZON_DIR, 'snippets/product-media-gallery-content.liquid'),
		'utf8'
	)
	gallery = insertAfterLoop(
		gallery,
		'class="media-gallery__grid',
		'</ul>',
		installLine('horizon-grid')
	)
	gallery = insertAfterLoop(
		gallery,
		'{% capture slides %}',
		'{% endcapture %}',
		installLine('horizon-carousel')
	)
	mkdirSync(OVERLAY_DIR, { recursive: true })
	await writeFile(
		join(OVERLAY_DIR, 'product-media-gallery-content.liquid'),
		gallery
	)
}

/** A Shopify color setting: prints as its hex, with the properties Horizon reads. */
class Color extends Drop {
	readonly red: number
	readonly green: number
	readonly blue: number
	readonly alpha: number
	constructor(red: number, green: number, blue: number, alpha: number) {
		super()
		this.red = red
		this.green = green
		this.blue = blue
		this.alpha = alpha
	}

	static parse(value: unknown) {
		if (value instanceof Color) return value
		const text = String(value ?? '').trim()
		const rgba = text.match(/rgba?\(([^)]+)\)/)
		if (rgba) {
			const [r, g, b, a = '1'] = rgba[1].split(/[\s,/]+/)
			return new Color(+r, +g, +b, +a)
		}
		if (text === '' || text === 'transparent') return new Color(0, 0, 0, 0)
		let hex = text.replace('#', '')
		if (hex.length <= 4) hex = [...hex].map((c) => c + c).join('')
		const at = (i: number) => parseInt(hex.slice(i, i + 2), 16)
		return new Color(at(0), at(2), at(4), hex.length === 8 ? at(6) / 255 : 1)
	}

	get rgb() {
		return `${this.red} ${this.green} ${this.blue}`
	}

	get rgba() {
		return `${this.rgb} / ${this.alpha}`
	}

	get brightness() {
		return (this.red * 299 + this.green * 587 + this.blue * 114) / 1000
	}

	withLightness(change: number) {
		const scale = 1 + change / 100
		const channel = (v: number) =>
			Math.round(
				Math.min(
					255,
					Math.max(0, change > 0 ? v + (255 - v) * (change / 100) : v * scale)
				)
			)
		return new Color(
			channel(this.red),
			channel(this.green),
			channel(this.blue),
			this.alpha
		)
	}

	override valueOf() {
		if (this.alpha < 1)
			return `rgba(${this.red}, ${this.green}, ${this.blue}, ${this.alpha})`
		const hex = (v: number) => v.toString(16).padStart(2, '0')
		return `#${hex(this.red)}${hex(this.green)}${hex(this.blue)}`
	}

	toString() {
		return this.valueOf()
	}
}

/** A font_picker setting. The harness ships no font files, so text falls back to the system's. */
class Font extends Drop {
	readonly family: string
	readonly weight: number
	readonly style: string
	readonly fallback_families = 'sans-serif'
	constructor(handle: string) {
		super()
		const [, family = 'sans', variant = 'n4'] =
			handle.match(/^(.*)_([ni]\d)$/) ?? []
		this.family = family
			.replace(/_/g, ' ')
			.replace(/\b\w/g, (c) => c.toUpperCase())
		this.weight = Number(variant[1]) * 100
		this.style = variant[0] === 'i' ? 'italic' : 'normal'
	}
}

/** Horizon's theme settings: the schema's defaults under the shipped settings_data. */
export function horizonSettings() {
	const schema = readJson('config/settings_schema.json') as {
		settings?: { id?: string; type: string; default?: unknown }[]
	}[]
	const types: Record<string, string> = {}
	const settings: Record<string, unknown> = {}
	for (const setting of schema.flatMap((group) => group.settings ?? [])) {
		if (!setting.id) continue
		types[setting.id] = setting.type
		if (setting.default !== undefined) settings[setting.id] = setting.default
	}
	Object.assign(settings, readJson('config/settings_data.json').current)

	const named = Object.entries(settings.color_palette as Record<string, string>)
	const palette = Object.assign(
		named.map(([, value]) => Color.parse(value)),
		Object.fromEntries(named.map(([name, value]) => [name, Color.parse(value)]))
	)
	settings.color_palette = palette
	for (const [id, type] of Object.entries(types)) {
		const value = settings[id]
		if (type === 'color' && value) {
			const reference = String(value).match(/settings\.color_palette\.(\w+)/)
			settings[id] = reference
				? palette[reference[1] as keyof typeof palette]
				: Color.parse(value)
		}
		if (type === 'font_picker') settings[id] = new Font(String(value))
	}
	return settings
}

/** The product template's main section and gallery block, as Horizon ships them. */
export function horizonProductTemplate() {
	const main = readJson('templates/product.json').sections.main
	return {
		sectionSettings: main.settings,
		gallerySettings: main.blocks['media-gallery'].settings
	}
}

const translations = readJsonLazy('locales/de.json')
function readJsonLazy(file: string) {
	let value: Record<string, unknown> | undefined
	return () => (value ??= readJson(file))
}

/** `{% doc %}`: Shopify reads it for the editor, and it renders nothing. */
class DocTag extends Tag {
	constructor(token: TagToken, remaining: TopLevelToken[], liquid: Liquid) {
		super(token, remaining, liquid)
		while (remaining.length > 0) {
			const next = remaining.shift() as TopLevelToken & { name?: string }
			if (next.name === 'enddoc') break
		}
	}
	*render() {}
}

/** `{% style %}`: renders its Liquid into a `<style>` element. */
class StyleTag extends Tag {
	templates: Template[] = []
	constructor(token: TagToken, remaining: TopLevelToken[], liquid: Liquid) {
		super(token, remaining, liquid)
		const stream = liquid.parser
			.parseStream(remaining)
			.on('tag:endstyle', () => stream.stop())
			.on('template', (template: Template) => this.templates.push(template))
		stream.start()
	}
	*render(
		context: Context,
		emitter: Emitter
	): Generator<unknown, void, unknown> {
		emitter.write('<style data-shopify>')
		yield this.liquid.renderer.renderTemplates(this.templates, context, emitter)
		emitter.write('</style>')
	}
}

/** Markup Shopify's `escape` passes through, as it does `image_tag`'s output. */
class SafeHtml extends String {}

const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
}

/** The tags and filters Horizon's snippets use that liquidjs does not have. */
export function registerHorizon(engine: Liquid) {
	const imageTag = engine.filters.image_tag
	engine.registerFilter(
		'image_tag',
		function (this: unknown, ...args: unknown[]) {
			return new SafeHtml(
				(imageTag as (...a: unknown[]) => string).apply(this, args)
			)
		}
	)
	engine.registerFilter('escape', (value: unknown) =>
		value instanceof SafeHtml
			? value
			: String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c])
	)
	engine.registerTag('doc', DocTag)
	engine.registerTag('style', StyleTag)
	engine.registerFilter('t', (key: string, ...options: [string, unknown][]) => {
		let text: unknown = translations()
		for (const part of key.split('.')) {
			text = (text as Record<string, unknown> | undefined)?.[part]
		}
		if (typeof text !== 'string') return key
		return options.reduce(
			(result, [name, value]) =>
				result.replaceAll(`{{ ${name} }}`, String(value)),
			text
		)
	})
	engine.registerFilter(
		'asset_url',
		(name: string) => `/horizon/assets/${name}`
	)
	engine.registerFilter('inline_asset_content', (name: string) =>
		readFile(join(HORIZON_DIR, 'assets', name), 'utf8').catch(() => '')
	)
	engine.registerFilter(
		'stylesheet_tag',
		(href: string) => `<link rel="stylesheet" href="${href}">`
	)
	engine.registerFilter(
		'preload_tag',
		(href: string, ...options: [string, string][]) =>
			`<link rel="preload" href="${href}" as="${options.find(([name]) => name === 'as')?.[1] ?? 'style'}">`
	)
	engine.registerFilter('placeholder_svg_tag', () => '<svg></svg>')
	engine.registerFilter('standard_event_data', () => '{}')
	engine.registerFilter(
		'model_viewer_tag',
		(media: { alt?: string }) =>
			`<model-viewer alt="${media.alt ?? ''}"></model-viewer>`
	)
	engine.registerFilter('font_face', () => '')
	engine.registerFilter('font_url', () => '')
	engine.registerFilter('font_modify', (font: Font) => font)
	engine.registerFilter(
		'color_brightness',
		(color: unknown) => Color.parse(color).brightness
	)
	engine.registerFilter('color_darken', (color: unknown, amount: number) =>
		Color.parse(color).withLightness(-amount)
	)
	engine.registerFilter('color_lighten', (color: unknown, amount: number) =>
		Color.parse(color).withLightness(amount)
	)
	engine.registerFilter(
		'color_modify',
		(color: unknown, channel: string, value: number) => {
			const parsed = Color.parse(color)
			return channel === 'alpha'
				? new Color(parsed.red, parsed.green, parsed.blue, value)
				: parsed
		}
	)
}

export const horizonAssetType = (name: string) =>
	({ js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml' })[
		name.split('.').pop() ?? ''
	] ?? 'application/octet-stream'
