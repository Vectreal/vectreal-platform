import { describe, expect, it } from 'vitest'

import {
	buildEmbedPath,
	buildEmbedUrl,
	buildInternalPreviewPath,
	buildResponsiveEmbedSnippet,
	buildSdkEmbedSnippet,
	EMBED_COPY,
	escapeHtmlAttributeValue
} from '../app/lib/domain/embed/embed-snippet'

const ORIGIN = 'https://vectreal.com'
const PROJECT_ID = '08db6be1-f87b-4278-abfc-d80ef549e3a7'
const SCENE_ID = '1ee4f724-2ee5-4162-9804-2de08bcb0eca'

/** The `src` attribute value of the first iframe in a snippet. */
function readSrcAttribute(snippet: string): string {
	const match = snippet.match(/<iframe[\s\S]*?\ssrc="([^"]*)"/)
	expect(match, 'snippet has an iframe src').not.toBeNull()
	return match![1]
}

/** Reverses `escapeHtmlAttributeValue`, the way a browser's parser would. */
function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&')
}

describe('buildEmbedUrl', () => {
	it('omits the token parameter entirely when there is no token', () => {
		const url = buildEmbedUrl({
			origin: ORIGIN,
			projectId: PROJECT_ID,
			sceneId: SCENE_ID
		})

		expect(url).toBe(`${ORIGIN}${buildEmbedPath({ projectId: PROJECT_ID, sceneId: SCENE_ID })}`)
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

					const parsed = new URL(
						decodeHtmlEntities(readSrcAttribute(builder({ src })))
					)

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
		expect(snippet).not.toMatch(/src="[^"]*[^;]&camera/)

		const parsed = new URL(decodeHtmlEntities(readSrcAttribute(snippet)))
		expect(parsed.searchParams.get('camera')).toBe('front')
		expect(parsed.searchParams.get('autoRotate')).toBe('1')
	})

	it('leaves no attribute-closing quote in the emitted src', () => {
		const src = buildEmbedUrl({
			origin: ORIGIN,
			projectId: PROJECT_ID,
			sceneId: SCENE_ID,
			token: 'vctrl_"injected" style="display:none'
		})

		expect(readSrcAttribute(buildResponsiveEmbedSnippet({ src }))).not.toContain(
			'"'
		)
	})
})

describe('escapeHtmlAttributeValue', () => {
	it('escapes ampersands once, not twice', () => {
		expect(escapeHtmlAttributeValue('a&b')).toBe('a&amp;b')
		expect(escapeHtmlAttributeValue('a<b')).toBe('a&lt;b')
		expect(escapeHtmlAttributeValue('a"b')).toBe('a&quot;b')
	})

	it('is reversible for a value carrying every escaped character', () => {
		const raw = `&<>"'`
		expect(decodeHtmlEntities(escapeHtmlAttributeValue(raw))).toBe(raw)
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

describe('the two link targets stay distinct', () => {
	/*
	  "Open preview" used to open the token-authenticated `/embed` URL with no
	  token, so it 404'd every time. The panel now opens `/preview` there, which
	  is session-authenticated, and offers `/embed` separately as the visitor's
	  view. The bug returns the moment these two agree.
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
