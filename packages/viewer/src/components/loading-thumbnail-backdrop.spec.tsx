// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import LoadingThumbnailBackdrop from './loading-thumbnail-backdrop'

const imageClasses = (objectFit?: 'contain' | 'cover') => {
	const { container } = render(
		<LoadingThumbnailBackdrop
			thumbnail={{ src: '/thumb.webp', objectFit }}
			isLoaded={false}
		/>
	)
	return (container.querySelector('img')?.getAttribute('class') ?? '').split(
		' '
	)
}

describe('the loading thumbnail backdrop', () => {
	it('fits the whole image into the viewer when asked to contain it', () => {
		const classes = imageClasses('contain')
		expect(classes).toContain('vv:object-contain')
		expect(classes).not.toContain('vv:object-cover')
	})

	it('fills the viewer by default', () => {
		expect(imageClasses()).toContain('vv:object-cover')
	})
})
