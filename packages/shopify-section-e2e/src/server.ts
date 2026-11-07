import { watch } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { type ServerResponse, createServer } from 'node:http'
import { join } from 'node:path'

import { Liquid, Tag, type TagToken, type TopLevelToken } from 'liquidjs'

import { HARNESS_PORT, HARNESS_STEPS } from './harness.ts'

const SHOPIFY_DIR = join(import.meta.dirname, '../../embed/shopify')
const SECTION_FILE = join(SHOPIFY_DIR, 'vectreal-scene-tour.liquid')
const SNIPPET_FILE = join(SHOPIFY_DIR, 'vectreal-gallery-slide.liquid')
const PAGE_FILE = join(import.meta.dirname, 'product-page.liquid')
const IMAGES = [
	'poster.jpg',
	'product-detail.jpg',
	'product-hero.jpg',
	'product-context.jpg'
]
const DAWN_ASSETS =
	'https://raw.githubusercontent.com/Shopify/dawn/3e9ee2281dc40e1eda9d5fd3ca64719d0a36b47d/assets'
const DAWN_FILES: Record<string, string> = {
	'base.css': 'text/css',
	'section-main-product.css': 'text/css',
	'component-accordion.css': 'text/css',
	'component-price.css': 'text/css',
	'component-slider.css': 'text/css',
	'component-deferred-media.css': 'text/css',
	'constants.js': 'text/javascript',
	'pubsub.js': 'text/javascript',
	'global.js': 'text/javascript',
	'media-gallery.js': 'text/javascript'
}

/**
 * `SHOPIFY_HARNESS_LIVE=1` reloads open pages when the section or the page
 * template changes, and (with `node --watch`) when the server restarts.
 */
const LIVE_RELOAD = process.env.SHOPIFY_HARNESS_LIVE === '1'
const LIVE_RELOAD_SCRIPT = `<script>
  let connected = false;
  const live = new EventSource('/__live');
  live.onopen = () => (connected ? location.reload() : (connected = true));
  live.onmessage = () => location.reload();
</script>`

const sceneUrl = process.env.SHOPIFY_HARNESS_EMBED_URL
if (!sceneUrl) {
	throw new Error(
		'Set SHOPIFY_HARNESS_EMBED_URL to a published scene embed URL with its ?token=.'
	)
}

/**
 * The blocks Shopify lifts out of a section file: `schema` is read for the
 * defaults, and `stylesheet` and `javascript` are served as the compiled
 * assets Shopify links from `content_for_header`.
 */
function captureRaw(into: string[]) {
	return class extends Tag {
		constructor(token: TagToken, remaining: TopLevelToken[], liquid: Liquid) {
			super(token, remaining, liquid)
			const end = `end${token.name}`
			let text = ''
			while (remaining.length > 0) {
				const next = remaining.shift() as TopLevelToken & { name?: string }
				if (next.name === end) break
				text += next.getText()
			}
			into.push(text)
		}
		*render() {}
	}
}

/** `?stations=a,b` replaces the harness tour with stations headed "Station 1", "Station 2", … */
const stationsFrom = (url: URL) =>
	url.searchParams
		.get('stations')
		?.split(',')
		.map((camera, index) => ({ camera, heading: `Station ${index + 1}` })) ??
	HARNESS_STEPS

async function renderSectionPage(url: URL) {
	const schema: string[] = []
	const styles: string[] = []
	const scripts: string[] = []
	const engine = new Liquid({ root: [SHOPIFY_DIR], extname: '.liquid' })
	engine.registerTag('schema', captureRaw(schema))
	engine.registerTag('stylesheet', captureRaw(styles))
	engine.registerTag('javascript', captureRaw(scripts))
	engine.registerFilter(
		'image_url',
		(image: { src: string }, ...options: [string, number][]) => {
			const width = options.find(([name]) => name === 'width')?.[1]
			return width ? `${image.src}?width=${width}` : image.src
		}
	)
	engine.registerFilter(
		'image_tag',
		(src: string, ...options: [string, string][]) => {
			const attributes = options
				.filter(([name]) => name !== 'widths')
				.map(([name, value]) => ` ${name}="${value}"`)
				.join('')
			return `<img src="${src}"${attributes}>`
		}
	)

	const template = engine.parse(await readFile(SECTION_FILE, 'utf8'))
	const defaults = Object.fromEntries(
		(JSON.parse(schema[0]).settings as { id: string; default?: string }[])
			.filter((setting) => setting.default !== undefined)
			.map((setting) => [setting.id, setting.default])
	)
	const scene = url.searchParams.get('scene_url') ?? sceneUrl
	const product = {
		id: 7302,
		title: 'Messsucherkamera M2',
		featured_media: { preview_image: { src: '/product-hero.jpg' } },
		metafields: { vectreal: { scene_url: { value: scene } } }
	}
	const section = await engine.render(template, {
		product,
		section: {
			id: 'template--1__vectreal_scene_tour',
			settings: {
				...defaults,
				scene_url: scene,
				cameras: url.searchParams.get('cameras') ?? '',
				poster: { src: '/poster.jpg', alt: product.title }
			},
			blocks: url.searchParams.has('cameras')
				? []
				: stationsFrom(url).map((settings) => ({
						type: 'step',
						shopify_attributes: '',
						settings
					}))
		}
	})

	const page = await engine.parseAndRender(await readFile(PAGE_FILE, 'utf8'), {
		product,
		section: { id: 'main' },
		section_html: `<section id="shopify-section-template--1__vectreal_scene_tour" class="shopify-section section">${section}</section>`
	})
	return {
		page: LIVE_RELOAD
			? page.replace('</body>', `${LIVE_RELOAD_SCRIPT}</body>`)
			: page,
		styles: styles.join('\n'),
		scripts: scripts.join('\n')
	}
}

const dawnFiles = new Map<string, Promise<string>>()
const fetchDawnFile = (name: string) => {
	if (!dawnFiles.has(name)) {
		dawnFiles.set(
			name,
			fetch(`${DAWN_ASSETS}/${name}`).then((res) => res.text())
		)
	}
	return dawnFiles.get(name) as Promise<string>
}

const livePages = new Set<ServerResponse>()
if (LIVE_RELOAD) {
	for (const file of [SECTION_FILE, SNIPPET_FILE, PAGE_FILE]) {
		watch(file, () => {
			for (const page of livePages) page.write('data: reload\n\n')
		})
	}
}

createServer(async (request, response) => {
	const url = new URL(request.url ?? '/', `http://${request.headers.host}`)
	if (LIVE_RELOAD && url.pathname === '/__live') {
		response.writeHead(200, { 'content-type': 'text/event-stream' })
		response.write('\n')
		livePages.add(response)
		request.on('close', () => livePages.delete(response))
		return
	}

	const rendered = await renderSectionPage(url)
	const send = (type: string, body: string | Buffer) => {
		response.writeHead(200, { 'content-type': type })
		response.end(body)
	}

	const dawnFile = url.pathname.replace('/dawn/', '')
	if (dawnFile in DAWN_FILES) {
		return send(DAWN_FILES[dawnFile], await fetchDawnFile(dawnFile))
	}
	const image = url.pathname.slice(1)
	if (IMAGES.includes(image)) {
		return send('image/jpeg', await readFile(join(import.meta.dirname, image)))
	}

	switch (url.pathname) {
		case '/compiled_assets/styles.css':
			return send('text/css', rendered.styles)
		case '/compiled_assets/scripts.js':
			return send('text/javascript', rendered.scripts)
		default:
			return send('text/html; charset=utf-8', rendered.page)
	}
}).listen(HARNESS_PORT, '127.0.0.1')
