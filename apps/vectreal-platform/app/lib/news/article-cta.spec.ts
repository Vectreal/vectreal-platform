import {
	AGENT_CTA_PROMPT_MAX_LENGTH,
	DEFAULT_ARTICLE_CTA,
	resolveArticleCta
} from './article-cta'

describe('resolveArticleCta', () => {
	it('ends an article without cta on the publisher, with the rocket beside it', () => {
		expect(resolveArticleCta(undefined)).toEqual(DEFAULT_ARTICLE_CTA)
		expect(DEFAULT_ARTICLE_CTA).toEqual({
			kind: 'publisher',
			shortcut: { type: 'sample', id: 'rocket' }
		})
	})

	it('reads the absolute vectreal.com URLs authors write', () => {
		expect(resolveArticleCta('https://vectreal.com/publisher')).toEqual(
			DEFAULT_ARTICLE_CTA
		)
		expect(resolveArticleCta('https://vectreal.com/convert')).toEqual({
			kind: 'convert',
			to: '/convert'
		})
	})

	it('reads a named sample, example scene or converter pair', () => {
		expect(resolveArticleCta('/publisher?sample=camera')).toEqual({
			kind: 'publisher',
			shortcut: { type: 'sample', id: 'camera' }
		})
		expect(
			resolveArticleCta('https://vectreal.com/publisher?example=camera-shadows')
		).toEqual({
			kind: 'publisher',
			shortcut: { type: 'example', id: 'camera-shadows' }
		})
		expect(resolveArticleCta('/convert/glb-to-gltf')).toEqual({
			kind: 'convert',
			to: '/convert/glb-to-gltf'
		})
	})

	it('reads the free-model form, as a path or on vectreal.com', () => {
		expect(resolveArticleCta('/free-model')).toEqual({ kind: 'free-model' })
		expect(resolveArticleCta('https://vectreal.com/free-model')).toEqual({
			kind: 'free-model'
		})
	})

	it('rejects a free-model URL carrying a letter code, batch or language', () => {
		expect(resolveArticleCta('/free-model?c=AB12CD')).toBeNull()
		expect(resolveArticleCta('/free-model?b=2026-10-30-brands')).toBeNull()
		expect(resolveArticleCta('/free-model?lang=de')).toBeNull()
		expect(resolveArticleCta('/free-model/extra')).toBeNull()
		expect(resolveArticleCta('https://example.com/free-model')).toBeNull()
	})

	it('rejects destinations the panel cannot present', () => {
		expect(resolveArticleCta('https://example.com/publisher')).toBeNull()
		expect(resolveArticleCta('https://vectreal.com/pricing')).toBeNull()
		expect(resolveArticleCta('https://vectreal.com/publisher/abc')).toBeNull()
		expect(resolveArticleCta('https://vectreal.com/converter')).toBeNull()
		expect(resolveArticleCta('http://[')).toBeNull()
	})

	it('rejects a sample, example or converter pair that does not exist', () => {
		expect(resolveArticleCta('/convert/glb-to-gltff')).toBeNull()
		expect(resolveArticleCta('/convert/glb-to-gltf/extra')).toBeNull()
		expect(resolveArticleCta('/publisher?sample=bike')).toBeNull()
		expect(resolveArticleCta('/publisher?sample=')).toBeNull()
		expect(resolveArticleCta('/publisher?example=camera-shadow')).toBeNull()
	})

	it('rejects query parameters it cannot vouch for', () => {
		expect(resolveArticleCta('/publisher?sample=rocket&x=1')).toBeNull()
		expect(
			resolveArticleCta('/publisher?sample=rocket&example=camera-shadows')
		).toBeNull()
		expect(resolveArticleCta('/publisher?utm_source=newsroom')).toBeNull()
		expect(resolveArticleCta('/convert?utm_source=newsroom')).toBeNull()
	})

	it("hands the task in ctaPrompt to the reader's agent, trimmed", () => {
		expect(
			resolveArticleCta('agent', '  Add hotspots to my own model.  ')
		).toEqual({ kind: 'agent', prompt: 'Add hotspots to my own model.' })
		expect(resolveArticleCta('agent', 'Add hotspots\nto my model.\n')).toEqual({
			kind: 'agent',
			prompt: 'Add hotspots to my model.'
		})
		const longest = 'a'.repeat(AGENT_CTA_PROMPT_MAX_LENGTH)
		expect(resolveArticleCta('agent', longest)).toEqual({
			kind: 'agent',
			prompt: longest
		})
	})

	it('rejects an agent cta without a prompt', () => {
		expect(resolveArticleCta('agent')).toBeNull()
		expect(resolveArticleCta('agent', '')).toBeNull()
		expect(resolveArticleCta('agent', '   ')).toBeNull()
	})

	it('rejects a prompt longer than one sentence', () => {
		expect(
			resolveArticleCta('agent', 'a'.repeat(AGENT_CTA_PROMPT_MAX_LENGTH + 1))
		).toBeNull()
	})

	it('reads agent only as the whole value', () => {
		expect(resolveArticleCta('/agent', 'Do it.')).toBeNull()
		expect(resolveArticleCta('Agent', 'Do it.')).toBeNull()
	})
})
