import { watch } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { type ServerResponse, createServer } from 'node:http'
import { join } from 'node:path'

import { Liquid, Tag, type TagToken, type TopLevelToken } from 'liquidjs'

import { HARNESS_PORT, HARNESS_STEPS } from './harness.ts'
import {
	HORIZON_DIR,
	HORIZON_ROOTS,
	ensureHorizon,
	horizonAssetType,
	horizonProductTemplate,
	horizonSettings,
	patchHorizonGallery,
	registerHorizon
} from './horizon.ts'

const SHOPIFY_DIR = join(import.meta.dirname, '../..')
const SECTION_FILE = join(SHOPIFY_DIR, 'vectreal-scene-tour.liquid')
const SNIPPET_FILE = join(SHOPIFY_DIR, 'vectreal-gallery-slide.liquid')
const LINK_FILE = join(SHOPIFY_DIR, 'vectreal-free-model-link.liquid')
const PAGE_FILE = join(import.meta.dirname, 'product-page.liquid')
const HORIZON_PAGE_FILE = join(
	import.meta.dirname,
	'horizon-product-page.liquid'
)
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

const sceneUrl: string =
	process.env.SHOPIFY_HARNESS_EMBED_URL ??
	(() => {
		throw new Error(
			'Set SHOPIFY_HARNESS_EMBED_URL to a published scene embed URL with its ?token=.'
		)
	})()

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

/** The product both themes show: two photos and Shopify's own 3D slot, then the scene. */
function harnessProduct(scene: string, mediaCount = 3) {
	const image = (src: string, width: number, height: number) => ({
		src,
		width,
		height,
		aspect_ratio: width / height
	})
	const media = [
		{
			id: 101,
			media_type: 'image',
			alt: 'Ansicht von oben',
			preview_image: image('/product-hero.jpg', 1400, 1400)
		},
		{
			id: 102,
			media_type: 'image',
			alt: 'Ansicht von vorn',
			preview_image: image('/product-detail.jpg', 1400, 1400)
		},
		{
			id: 103,
			media_type: 'model',
			alt: 'Shopify-3D-Modell',
			preview_image: image('/product-context.jpg', 1240, 1240)
		}
	]
		.slice(0, mediaCount)
		.map((item, index) => ({
			...item,
			position: index + 1,
			aspect_ratio: item.preview_image.aspect_ratio
		}))
	return {
		id: 7302,
		title: 'Messsucherkamera M2',
		featured_media: media[0],
		media,
		images: media.map((item) => item.preview_image),
		selected_or_first_available_variant: { featured_media: null },
		metafields: { vectreal: { scene_url: { value: scene } } }
	}
}

function createEngine(roots: string[], globals: object = {}) {
	const captured = {
		schema: [] as string[],
		styles: [] as string[],
		scripts: [] as string[]
	}
	const engine = new Liquid({
		root: [...roots, SHOPIFY_DIR],
		extname: '.liquid',
		globals
	})
	engine.registerTag('schema', captureRaw(captured.schema))
	engine.registerTag('stylesheet', captureRaw(captured.styles))
	engine.registerTag('javascript', captureRaw(captured.scripts))
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
			// A later option of the same name wins, as Horizon's double `ref:` expects.
			const attributes = [...new Map(options).entries()]
				.filter(([name, value]) => name !== 'widths' && value != null)
				.map(([name, value]) => ` ${name.replaceAll('_', '-')}="${value}"`)
				.join('')
			return `<img src="${src}"${attributes}>`
		}
	)
	return { engine, captured }
}

/** Shopify compiles each file's stylesheet and javascript tag once, however often it renders. */
const compiled = (blocks: string[]) => [...new Set(blocks)].join('\n')

async function renderTour(
	engine: Liquid,
	captured: { schema: string[] },
	url: URL,
	product: ReturnType<typeof harnessProduct>
) {
	const template = engine.parse(await readFile(SECTION_FILE, 'utf8'))
	const defaults = Object.fromEntries(
		(
			JSON.parse(captured.schema[0]).settings as {
				id: string
				default?: string
			}[]
		)
			.filter((setting) => setting.default !== undefined)
			.map((setting) => [setting.id, setting.default])
	)
	const scene = product.metafields.vectreal.scene_url.value
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
	return `<section id="shopify-section-template--1__vectreal_scene_tour" class="shopify-section section">${section}</section>`
}

const withLiveReload = (page: string) =>
	LIVE_RELOAD ? page.replace('</body>', `${LIVE_RELOAD_SCRIPT}</body>`) : page

async function renderSectionPage(url: URL) {
	const { engine, captured } = createEngine([])
	const product = harnessProduct(url.searchParams.get('scene_url') ?? sceneUrl)
	const section_html = await renderTour(engine, captured, url, product)
	const page = await engine.parseAndRender(await readFile(PAGE_FILE, 'utf8'), {
		product,
		section: { id: 'main' },
		section_html
	})
	return {
		page: withLiveReload(page),
		styles: compiled(captured.styles),
		scripts: compiled(captured.scripts)
	}
}

/**
 * A Horizon product page: Horizon's product information layout and gallery,
 * then the tour section. The gallery is the product template's own (a grid,
 * with a counter on desktop and dots on phones) unless
 * `?presentation=carousel` or `?controls=thumbnails` (or `dots`, `counter`)
 * says otherwise. `?media=1` gives the product a single photo.
 */
async function renderHorizonPage(url: URL) {
	ensureHorizon()
	await patchHorizonGallery(SNIPPET_FILE)
	const { sectionSettings, gallerySettings } = horizonProductTemplate()
	const product = harnessProduct(
		url.searchParams.get('scene_url') ?? sceneUrl,
		Number(url.searchParams.get('media') ?? 3)
	)
	const { engine, captured } = createEngine(HORIZON_ROOTS, {
		settings: horizonSettings(),
		closest: { product },
		request: { page_type: 'product', locale: { iso_code: 'de' } }
	})
	registerHorizon(engine)
	const section_html = await renderTour(engine, captured, url, product)
	const controls = url.searchParams.get('controls')
	const gallery = {
		...gallerySettings,
		media_presentation:
			url.searchParams.get('presentation') ??
			gallerySettings.media_presentation,
		...(controls && {
			slideshow_controls_style: controls,
			slideshow_mobile_controls_style: controls
		})
	}
	const page = await engine.parseAndRender(
		await readFile(HORIZON_PAGE_FILE, 'utf8'),
		{
			product,
			section: { id: 'template--2__main', settings: sectionSettings },
			block: { id: 'media-gallery', settings: gallery },
			section_settings: sectionSettings,
			gallery_settings: gallery,
			section_html
		}
	)
	return {
		page: withLiveReload(page),
		styles: compiled(captured.styles),
		scripts: compiled(captured.scripts)
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
	for (const file of [
		SECTION_FILE,
		SNIPPET_FILE,
		LINK_FILE,
		PAGE_FILE,
		HORIZON_PAGE_FILE
	]) {
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
	if (url.pathname.startsWith('/horizon/assets/')) {
		const name = url.pathname.replace('/horizon/assets/', '')
		if (name.includes('..')) return send('text/plain', '')
		return send(
			horizonAssetType(name),
			await readFile(join(HORIZON_DIR, 'assets', name))
		)
	}

	const horizon = url.pathname.startsWith('/horizon')
	const rendered = await (
		horizon ? renderHorizonPage(url) : renderSectionPage(url)
	).catch((error: Error) => {
		response.writeHead(500, { 'content-type': 'text/plain' })
		response.end(error.stack)
	})
	if (!rendered) return
	switch (url.pathname.replace(/^\/horizon/, '')) {
		case '/compiled_assets/styles.css':
			return send('text/css', rendered.styles)
		case '/compiled_assets/scripts.js':
			return send('text/javascript', rendered.scripts)
		default:
			return send('text/html; charset=utf-8', rendered.page)
	}
}).listen(HARNESS_PORT, '127.0.0.1')
