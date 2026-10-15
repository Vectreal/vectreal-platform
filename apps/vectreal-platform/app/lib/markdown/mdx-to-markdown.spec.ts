import { describe, expect, it } from 'vitest'

import { markdownTwinModule, mdxToMarkdown } from './mdx-to-markdown'

const twin = (source: string) => mdxToMarkdown(source, 'page.mdx')

describe('mdxToMarkdown', () => {
	it('drops frontmatter, imports and comments', () => {
		const { markdown } = twin(
			[
				'---',
				'title: Hidden',
				'---',
				"import { X } from './x'",
				'',
				'# Title',
				'',
				'{/* claims',
				'present a b',
				'*/}',
				'',
				'Body.'
			].join('\n')
		)
		expect(markdown).toBe('# Title\n\nBody.\n')
	})

	it('leaves code fences verbatim, JSX and exports included', () => {
		const fence = [
			'```tsx',
			"import { VectrealViewer } from '@vctrl/viewer'",
			'export default function App() {',
			'  return <VectrealViewer model={model} />',
			'}',
			'```'
		].join('\n')
		expect(twin(fence).markdown).toBe(`${fence}\n`)
	})

	it('unwraps lowercase elements to their prose', () => {
		const { markdown } = twin(
			'<figure>\n  <figcaption>A caption.</figcaption>\n</figure>'
		)
		expect(markdown).toBe('A caption.\n')
	})

	it('refuses a component it has no markdown form for, naming file and line', () => {
		expect(() => twin('# T\n\n<Mystery />')).toThrow(
			'page.mdx:3: <Mystery> has no markdown form'
		)
	})

	it('refuses an HTML element it has no markdown form for', () => {
		expect(() => twin('<iframe src="/x" />')).toThrow(
			'page.mdx:1: <iframe> has no markdown form'
		)
	})

	it('keeps a video as a link labelled with its description', () => {
		const result = twin(
			'<video src="/media/a.mp4" aria-label="A turntable." />'
		)
		expect(result.markdown).toBe(
			'[Video: A turntable.](VCTRLEXPR0VCTRL/media/a.mp4)\n'
		)
	})

	it('anchors root-relative images to the site', () => {
		expect(twin('![Diagram](/media/d.svg)').markdown).toBe(
			'![Diagram](VCTRLEXPR0VCTRL/media/d.svg)\n'
		)
	})

	it('refuses an expression it cannot evaluate', () => {
		expect(() => twin('Costs {price()} a month.')).toThrow(
			'page.mdx:1: expression {price()} has no markdown form'
		)
	})

	it('defers publishedLimit to the bundle as an expression', () => {
		const result = twin(
			"Up to {publishedLimit('free', 'api_keys_per_org')} keys."
		)
		expect(result.markdown).toBe('Up to VCTRLEXPR0VCTRL keys.\n')
		expect(result.expressions).toEqual([
			'publishedLimit("free", "api_keys_per_org")'
		])
	})

	it('anchors root-relative links to the site and leaves the rest alone', () => {
		const result = twin(
			'[a](/docs/x) [b](https://example.com) [c](//cdn.example.com/y) [d](#h)'
		)
		expect(result.markdown).toBe(
			'[a](VCTRLEXPR0VCTRL/docs/x) [b](https://example.com) [c](//cdn.example.com/y) [d](#h)\n'
		)
		expect(result.expressions).toEqual(['SITE_URL'])
	})

	it('turns an example scene into a captioned publisher link', () => {
		const result = twin('<ExampleScene id="camera-shadows" caption="Look." />')
		expect(result.markdown).toBe(
			'Look. [Open the interactive example](VCTRLEXPR0VCTRLVCTRLEXPR1VCTRL)\n'
		)
		expect(result.expressions).toEqual([
			'SITE_URL',
			'publisherExampleHref("camera-shadows")'
		])
	})
})

describe('markdownTwinModule', () => {
	it('evaluates each token in place and imports only the bindings', () => {
		const source = markdownTwinModule(
			{ markdown: 'a VCTRLEXPR0VCTRL b', expressions: ['SITE_URL'] },
			'/root'
		)
		expect(source).toContain('import { SITE_URL } from "/root/app/lib/seo.ts"')
		expect(source).toContain('export default "a " + String(SITE_URL) + " b"')
	})
})
