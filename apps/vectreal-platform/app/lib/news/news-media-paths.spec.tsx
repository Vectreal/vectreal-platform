import { describe, expect, it } from 'vitest'

import { articleMediaPaths, collectMediaPaths } from './news-media-paths'

function Figure(props: { image: { src: string } }) {
	return <img src={props.image.src} alt="" />
}

describe('collectMediaPaths', () => {
	it('finds newsroom media in element props, nested values and children', () => {
		const body = (
			<>
				<p>
					<img src="/media/images/newsroom/02/Upload.jpeg?v=2" alt="" />
				</p>
				<video
					src="/media/images/newsroom/02/clip.mp4#t=1"
					poster="/media/images/newsroom/02/poster.webp"
				/>
				<Figure image={{ src: '/media/images/newsroom/03/figure.webp' }} />
			</>
		)

		expect([...collectMediaPaths(body, new Set())].sort()).toEqual([
			'/media/images/newsroom/02/clip.mp4',
			'/media/images/newsroom/02/poster.webp',
			'/media/images/newsroom/02/upload.jpeg',
			'/media/images/newsroom/03/figure.webp'
		])
	})

	it('ignores media outside the newsroom folder and text that only mentions a path', () => {
		const body = (
			<>
				<img src="/media/images/logo-192.png" alt="" />
				<a href="/media/images/author-image.jpeg">photo</a>
				<p>/media/images/newsroom/02/upload.jpeg is in prose</p>
			</>
		)

		expect([...collectMediaPaths(body, new Set())]).toEqual([])
	})
})

describe('articleMediaPaths', () => {
	it('keeps frontmatter images wherever they live, and body media only in the newsroom', () => {
		const body = <img src="/media/images/logo-192.png" alt="" />
		expect(
			[
				...articleMediaPaths(body, [
					'/media/images/og/New-Feature.webp?v=1',
					undefined
				])
			].sort()
		).toEqual(['/media/images/og/new-feature.webp'])
	})
})
