// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { docsPages } from '../app/lib/docs/docs-manifest'
import {
	buildEmbedPath,
	buildEmbedUrl,
	buildInternalPreviewPath,
	buildResponsiveEmbedSnippet,
	buildSdkEmbedSnippet,
	EMBED_COPY,
	EMBED_DOCS_PATH,
	escapeHtmlAttributeValue
} from '../app/lib/domain/embed/embed-snippet'

const ORIGIN = 'https://vectreal.com'
const PROJECT_ID = '08db6be1-f87b-4278-abfc-d80ef549e3a7'
const SCENE_ID = '1ee4f724-2ee5-4162-9804-2de08bcb0eca'

/**
 * The iframe a real HTML parser finds in a snippet.
 *
 * Deliberately `DOMParser` rather than a regex over the string: the question
 * these tests exist to answer is what a *browser* reads back out of the
 * generated markup, and the reported bug was precisely that the markup parsed
 * differently than it looked. A regex capturing `[^"]*` cannot contain a quote
 * by construction, so any assertion made through one holds whether or not the
 * escaping works.
 */
function parseIframe(snippet: string): HTMLIFrameElement {
	const doc = new DOMParser().parseFromString(snippet, 'text/html')
	const iframe = doc.querySelector('iframe')
	expect(iframe, 'snippet parses to markup containing an iframe').not.toBeNull()
	return iframe as HTMLIFrameElement
}

/** The `src` a browser resolves, entity references already decoded for us. */
function readParsedSrc(snippet: string): string {
	return parseIframe(snippet).getAttribute('src') ?? ''
}

describe('buildEmbedUrl', () => {
	it('omits the token parameter entirely when there is no token', () => {
		const url = buildEmbedUrl({
			origin: ORIGIN,
			projectId: PROJECT_ID,
			sceneId: SCENE_ID
		})

		expect(url).toBe(
			`${ORIGIN}${buildEmbedPath({ projectId: PROJECT_ID, sceneId: SCENE_ID })}`
		)
		expect(new URL(url).searchParams.has('token')).toBe(false)
	})

	it('treats a whitespace-only token as absent', () => {
		const url = buildEmbedUrl({
			origin: ORIGIN,
			projectId: PROJECT_ID,
			sceneId: SCENE_ID,
			token: '   '
		})

		expect(new URL(url).searchParams.has('token')).toBe(false)
	})

	it('trims a pasted token rather than encoding the whitespace', () => {
		const url = buildEmbedUrl({
			origin: ORIGIN,
			projectId: PROJECT_ID,
			sceneId: SCENE_ID,
			token: '  vctrl_abc123  '
		})

		expect(new URL(url).searchParams.get('token')).toBe('vctrl_abc123')
	})
})

describe('token round trip through a generated snippet', () => {
	/*
	  The reported bug: the panel emitted `?token=YOUR_PREVIEW_API_KEY` inside an
	  HTML attribute and told the user to substitute it. Pasting a quoted key
	  closed the attribute early, the browser requested `?token=`, and an empty
	  token is a 404. Asserting a golden string would not have caught it - the
	  golden string was correct. What has to hold is that the token the panel was
	  given is the token a parser reads back out.
	*/
	const HOSTILE_TOKENS = [
		'vctrl_N3wIdPytooD26cwRCsRqm8zMZrLrjXWG',
		'vctrl_with+plus/and=equals',
		'vctrl_with&ampersand',
		'vctrl_with"double"quotes',
		"vctrl_with'single'quotes",
		'vctrl_with<angle>brackets',
		'vctrl_with spaces'
	]

	for (const builder of [buildResponsiveEmbedSnippet, buildSdkEmbedSnippet]) {
		describe(builder.name, () => {
			for (const token of HOSTILE_TOKENS) {
				it(`survives ${JSON.stringify(token)}`, () => {
					const src = buildEmbedUrl({
						origin: ORIGIN,
						projectId: PROJECT_ID,
						sceneId: SCENE_ID,
						token
					})

					const parsed = new URL(readParsedSrc(builder({ src })))

					expect(parsed.searchParams.get('token')).toBe(token)
					expect(parsed.pathname).toBe(
						buildEmbedPath({ projectId: PROJECT_ID, sceneId: SCENE_ID })
					)
				})
			}
		})
	}

	it('escapes the separator between parameters, not just the values', () => {
		const src = `${ORIGIN}/embed/p/s?token=abc&camera=front&autoRotate=1`
		const snippet = buildResponsiveEmbedSnippet({ src })

		expect(snippet).toContain('&amp;camera=front')

		const parsed = new URL(readParsedSrc(snippet))
		expect(parsed.searchParams.get('camera')).toBe('front')
		expect(parsed.searchParams.get('autoRotate')).toBe('1')
	})

	it('cannot be made to inject an attribute through the src', () => {
		const src = `${ORIGIN}/embed/p/s?token=vctrl_" onload="alert(1)`
		const iframe = parseIframe(buildResponsiveEmbedSnippet({ src }))

		expect(iframe.getAttribute('src')).toBe(src)
		expect(iframe.getAttribute('onload')).toBeNull()
	})
})

describe('the width and height options cannot break the snippet', () => {
	/*
	  Both land in a quoted `style` attribute, so they are the same breakout the
	  token placeholder was - one attribute over. A parser is what settles it: the
	  wrapper keeps exactly one attribute, and no element appears that the builder
	  did not write.

	  The panel no longer renders fields for these - the values are visible and
	  editable in the snippet it hands over - but they are still builder options,
	  and the escaping has to hold for whatever the next caller passes.
	*/
	const HOSTILE = [
		'100%"><script>alert(1)</script><div style="',
		'100%" onmouseover="alert(1)',
		'400px"><img src=x onerror=alert(1)>',
		// Injects the tag the snippet legitimately contains: caught by counting
		// elements, invisible to a `querySelector('iframe')` check.
		'100%"><iframe src="https://evil.example"></iframe><div style="'
	]

	/**
	 * Every element the snippet produces, in tree order.
	 *
	 * The whole document, not `body`: a parser hoists a leading `<script>` into
	 * `<head>`, so scoping this to the body would stop looking exactly where an
	 * injected element could land unseen.
	 */
	const STRUCTURAL = new Set(['html', 'head', 'body'])
	const elementsOf = (snippet: string) =>
		Array.from(
			new DOMParser()
				.parseFromString(snippet, 'text/html')
				.querySelectorAll('*')
		)
			.map((element) => element.tagName.toLowerCase())
			.filter((tag) => !STRUCTURAL.has(tag))

	for (const value of HOSTILE) {
		it(`survives a width of ${JSON.stringify(value)}`, () => {
			const snippet = buildResponsiveEmbedSnippet({
				src: `${ORIGIN}/embed/p/s`,
				width: value
			})
			const doc = new DOMParser().parseFromString(snippet, 'text/html')

			/*
			  The whole element list, not a hunt for specific tags. Payloads break
			  out in ways that move different counters - one opens a sibling
			  `<script>`, one nests an `<img>` inside the wrapper without changing
			  any `div` or `script` count, one adds only an attribute and changes
			  no element at all. Pinning the exact set the builder is supposed to
			  emit catches every shape, including ones nobody thought to list.

			  Deliberately not asserting the absence of the string `alert(1)`:
			  escaping leaves it sitting inertly inside the `style` value, so a
			  correctly escaped snippet still contains those characters. What
			  matters is that the parser reads them as text, not as markup.
			*/
			expect(elementsOf(snippet)).toEqual(['div', 'iframe'])

			const wrapper = doc.querySelector('div') as HTMLElement
			expect(wrapper.getAttributeNames()).toEqual(['style'])
			expect(wrapper.style.width).toBe('')
		})

		it(`survives a height of ${JSON.stringify(value)}`, () => {
			const snippet = buildSdkEmbedSnippet({
				src: `${ORIGIN}/embed/p/s`,
				height: value
			})
			const doc = new DOMParser().parseFromString(snippet, 'text/html')

			/*
			  Counting, not absence. This snippet ships two legitimate `<script>`
			  tags, so `querySelector('script')` is useless here - and asserting
			  only the wrapper's attribute list is worse than useless, because a
			  payload that breaks out opens *sibling* elements rather than adding
			  attributes, leaving that assertion green with `alert(1)` live in the
			  document.
			*/
			expect(elementsOf(snippet)).toEqual(['script', 'div', 'iframe', 'script'])
			expect(
				(doc.querySelector('div') as HTMLElement).getAttributeNames()
			).toEqual(['style'])
		})
	}

	it('still passes an ordinary CSS length through untouched', () => {
		const snippet = buildResponsiveEmbedSnippet({
			src: `${ORIGIN}/embed/p/s`,
			width: 'calc(100% - 20px)',
			height: '640px'
		})
		const wrapper = new DOMParser().parseFromString(snippet, 'text/html').body
			.firstElementChild as HTMLElement

		expect(wrapper.style.width).toBe('calc(100% - 20px)')
		expect(wrapper.style.height).toBe('640px')
	})
})

describe('escapeHtmlAttributeValue', () => {
	it('escapes ampersands once, not twice', () => {
		expect(escapeHtmlAttributeValue('a&b')).toBe('a&amp;b')
		expect(escapeHtmlAttributeValue('a<b')).toBe('a&lt;b')
		expect(escapeHtmlAttributeValue('a"b')).toBe('a&quot;b')
	})

	it('round-trips every escaped character through a real parser', () => {
		const raw = `&<>"'`
		const doc = new DOMParser().parseFromString(
			`<i data-v="${escapeHtmlAttributeValue(raw)}"></i>`,
			'text/html'
		)

		expect(doc.querySelector('i')?.getAttribute('data-v')).toBe(raw)
	})
})

describe('no hand-substituted placeholder survives anywhere', () => {
	/*
	  A placeholder inside an HTML attribute that the user is told to replace by
	  hand *is* the bug, so nothing this module emits may contain one.
	*/
	const PLACEHOLDER = /YOUR_[A-Z_]*KEY|<projectId>|<sceneId>/

	it('is absent from the generated snippets', () => {
		const src = buildEmbedUrl({
			origin: ORIGIN,
			projectId: PROJECT_ID,
			sceneId: SCENE_ID,
			token: 'vctrl_real'
		})

		expect(buildResponsiveEmbedSnippet({ src })).not.toMatch(PLACEHOLDER)
		expect(buildSdkEmbedSnippet({ src })).not.toMatch(PLACEHOLDER)
	})

	it('is absent from every string of panel copy', () => {
		for (const [key, value] of Object.entries(EMBED_COPY)) {
			expect(value, `EMBED_COPY.${key}`).not.toMatch(PLACEHOLDER)
		}
	})
})

describe('help text stays readable at a glance', () => {
	/*
	  Six of these had grown past 130 characters, one to 229, because a tooltip is
	  where an explanation goes when nothing else owns it - and nobody reads a
	  paragraph that appears on hover and vanishes on the way to the control it
	  describes.

	  The cap is on EVERY string, with the long-form exceptions named below. The
	  first version of this test filtered by a `/Help$|Hint$/` name and was worth
	  much less than it looked: it exempted the three longest strings in the
	  module, and renaming a key was enough to slip the ceiling and delete the
	  assertion with it, silently.
	*/
	const LIMIT = 80

	/**
	 * Strings that are prose by design, and why each one earns it.
	 *
	 * An inline notice is read once, in place, when something is already wrong -
	 * a different job from a qualifier sitting beside a control. Adding a key
	 * here is a visible edit; that is the point.
	 */
	const LONG_FORM: Partial<Record<keyof typeof EMBED_COPY, string>> = {
		allowedDomainsEmpty: 'InlineNotice: every third-party site is refused'
	}

	for (const [key, value] of Object.entries(EMBED_COPY)) {
		if (key in LONG_FORM) continue

		it(`${key} fits in ${LIMIT} characters`, () => {
			expect(value.length, `EMBED_COPY.${key}: ${value}`).toBeLessThanOrEqual(
				LIMIT
			)
		})
	}

	it('exempts nothing that has since been shortened', () => {
		/*
		  An exemption outliving its reason is how the list stops meaning
		  anything. Every name here has to still need the room.
		*/
		for (const key of Object.keys(LONG_FORM)) {
			const value = EMBED_COPY[key as keyof typeof EMBED_COPY]

			expect(
				value.length,
				`EMBED_COPY.${key} no longer needs an exemption`
			).toBeGreaterThan(LIMIT)
		}
	})
})

describe('the docs link the panel offers', () => {
	/*
	  The detail cut from those qualifiers moved to this page, so the link is the
	  only place it can be read now.

	  Checked against `routes.tsx`, not only against `docsPages`. The two lists
	  are maintained by hand and nothing keeps them in step: deleting the route
	  while leaving the manifest entry leaves this link landing on the docs
	  catch-all, and the manifest is the weaker of the two - it also feeds
	  `sitemap.xml`, so a manifest-only entry advertises a URL that does not
	  exist. The first version of this test checked only the manifest and stayed
	  green with the route deleted.
	*/
	const ROUTES = readFileSync(
		join(dirname(fileURLToPath(import.meta.url)), '../app/routes.tsx'),
		'utf8'
	)

	it('resolves to a page the docs manifest lists', () => {
		expect(EMBED_DOCS_PATH.startsWith('/docs/')).toBe(true)
		expect(docsPages.map((page) => page.slug)).toContain(
			EMBED_DOCS_PATH.replace(/^\/docs\//, '')
		)
	})

	it('resolves to a page the route table actually serves', () => {
		/*
		  The URL segment and the module together, not the module alone. Renaming
		  the segment - `route('embedding', './routes/docs/guides/publish-embed.mdx')`
		  - leaves the module path untouched while `EMBED_DOCS_PATH` falls through
		  to the docs catch-all, which is the same shape of miss this test was
		  rewritten to close.

		  A pattern rather than a whitespace-collapsed substring. The first attempt
		  collapsed runs of whitespace and claimed in its own comment to survive a
		  Prettier wrap; it does not, because collapsing `route(\n\t'a',\n\t'b'\n)`
		  leaves spaces inside the parens. The sibling `installation` route is
		  already wrapped that way and this line is 75 of Prettier's 80 columns, so
		  the false failure was one slug rename away.
		*/
		const slug = EMBED_DOCS_PATH.replace(/^\/docs\//, '')
		const segment = slug.split('/').pop() as string

		expect(ROUTES).toMatch(
			new RegExp(
				`route\\(\\s*'${segment}',\\s*'\\./routes/docs/${slug}\\.mdx'\\s*\\)`
			)
		)
	})
})

describe('the docs page and the builder agree on the default box', () => {
	/*
	  The guide states the default width and height in prose, above a fence
	  repeating the whole snippet. Nothing tied either to the builder, which is
	  the shape the `*.example.com` drift had: a page that reads as authoritative
	  and describes behavior the code stopped having. The panel now links users
	  straight to it, so the two are pinned.
	*/
	const GUIDE = readFileSync(
		join(
			dirname(fileURLToPath(import.meta.url)),
			'../app/routes/docs/guides/publish-embed.mdx'
		),
		'utf8'
	)

	it('quotes the box the snippet is actually generated with', () => {
		const wrapper = buildResponsiveEmbedSnippet({
			src: `${ORIGIN}/embed/p/s`
		}).split('\n')[0]

		expect(wrapper).toBe(
			'<div style="width: 100%; max-width: 100%; height: 400px;">'
		)
		expect(GUIDE).toContain(wrapper)
		expect(GUIDE).toContain('The box is `100%` wide and `400px` tall')
	})
})

describe('the two link targets stay distinct', () => {
	/*
	  "Open preview" used to open the token-authenticated `/embed` URL with no
	  token, so it 404'd every time. The panel no longer has that button at all -
	  both hosts already offer a Preview of their own - but the two paths are
	  still built from this module and still have to differ: `scene.tsx` and the
	  publisher's camera panel both open the session-authenticated one. The bug
	  returns the moment these two agree.
	*/
	it('preview is session-authenticated and carries no token', () => {
		const preview = buildInternalPreviewPath({
			projectId: PROJECT_ID,
			sceneId: SCENE_ID
		})

		expect(preview).toBe(`/preview/${PROJECT_ID}/${SCENE_ID}`)
		expect(preview).not.toContain('token')
		expect(preview).not.toBe(
			buildEmbedPath({ projectId: PROJECT_ID, sceneId: SCENE_ID })
		)
	})
})
