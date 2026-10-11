import { DEFAULT_ARTICLE_CTA, resolveArticleCta } from './article-cta'

describe('resolveArticleCta', () => {
	it('ends an article without cta on the publisher', () => {
		expect(resolveArticleCta(undefined)).toEqual(DEFAULT_ARTICLE_CTA)
	})

	it('reads the absolute vectreal.com URLs authors write', () => {
		expect(resolveArticleCta('https://vectreal.com/publisher')).toEqual({
			kind: 'publisher',
			to: '/publisher'
		})
		expect(resolveArticleCta('https://vectreal.com/convert')).toEqual({
			kind: 'convert',
			to: '/convert'
		})
	})

	it('keeps the path and query, so a link can name a converter or a sample', () => {
		expect(resolveArticleCta('/convert/glb-to-gltf')).toEqual({
			kind: 'convert',
			to: '/convert/glb-to-gltf'
		})
		expect(resolveArticleCta('/publisher?sample=rocket')).toEqual({
			kind: 'publisher',
			to: '/publisher?sample=rocket'
		})
	})

	it('rejects destinations the panel cannot present', () => {
		expect(resolveArticleCta('https://example.com/publisher')).toBeNull()
		expect(resolveArticleCta('https://vectreal.com/pricing')).toBeNull()
		expect(resolveArticleCta('https://vectreal.com/publisher/abc')).toBeNull()
		expect(resolveArticleCta('https://vectreal.com/converter')).toBeNull()
		expect(resolveArticleCta('http://[')).toBeNull()
	})

	it('rejects a sample or a converter pair that does not exist', () => {
		expect(resolveArticleCta('/convert/glb-to-gltff')).toBeNull()
		expect(resolveArticleCta('/convert/glb-to-gltf/extra')).toBeNull()
		expect(resolveArticleCta('/publisher?sample=bike')).toBeNull()
		expect(resolveArticleCta('/publisher?sample=')).toBeNull()
	})

	it('rejects query parameters it cannot vouch for', () => {
		expect(resolveArticleCta('/publisher?sample=rocket&x=1')).toBeNull()
		expect(resolveArticleCta('/publisher?utm_source=newsroom')).toBeNull()
		expect(resolveArticleCta('/convert?utm_source=newsroom')).toBeNull()
	})
})
