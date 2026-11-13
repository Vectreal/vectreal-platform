// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

const classesOf = (element: Element | null) =>
	(element?.getAttribute('class') ?? '').split(' ')

const stubCanvas = () => {
	const context = {
		canvas: { width: 0, height: 0 },
		globalCompositeOperation: 'source-over',
		clearRect: vi.fn(),
		drawImage: vi.fn(),
		save: vi.fn(),
		restore: vi.fn(),
		beginPath: vi.fn(),
		rect: vi.fn(),
		clip: vi.fn()
	}
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
		() => context as unknown as CanvasRenderingContext2D
	)
	// A 1:1 viewer: a 16:9 thumbnail leaves bands above and below.
	vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400)
	vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400)
	return context
}

const renderContained = (src = '/thumb.webp') =>
	render(
		<LoadingThumbnailBackdrop
			thumbnail={{ src, objectFit: 'contain' }}
			isLoaded={false}
		/>
	)

const load = (image: HTMLImageElement) => {
	Object.defineProperty(image, 'complete', {
		value: true,
		configurable: true
	})
	Object.defineProperty(image, 'naturalWidth', {
		value: 1280,
		configurable: true
	})
	Object.defineProperty(image, 'naturalHeight', {
		value: 720,
		configurable: true
	})
	fireEvent.load(image)
}

describe('the bands a contained thumbnail leaves', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('are painted from the image, behind it, once it loads', () => {
		const context = stubCanvas()
		const { container } = renderContained()
		const canvas = container.querySelector('canvas')
		const image = container.querySelector('img') as HTMLImageElement
		// Both positioned, the image later in the DOM: it paints on top.
		expect(canvas?.nextElementSibling).toBe(image)
		expect(classesOf(canvas)).toContain('vv:absolute')
		expect(classesOf(image)).toContain('vv:relative')
		expect(canvas?.getAttribute('aria-hidden')).toBe('true')

		load(image)

		const targets = context.drawImage.mock.calls.map((call) => call.slice(5))
		// 400x400 canvas pixels: the contained image is 400x225 at y 87.5,
		// snapped to 400x224 at y 88. The top band starts at the viewer's top
		// edge and the bottom one ends at its bottom edge, each reaching a pixel
		// under the image: nothing of the page shows above or below.
		expect(targets).toContainEqual([0, 0, 400, 89])
		expect(targets).toContainEqual([0, 311, 400, 89])
	})

	it('are left to a host that styles the image itself', () => {
		const { container } = render(
			<LoadingThumbnailBackdrop
				thumbnail={{
					src: '/thumb.webp',
					objectFit: 'contain',
					className: 'object-top'
				}}
				isLoaded={false}
			/>
		)
		expect(container.querySelector('canvas')).toBeNull()
	})

	it('drop the previous thumbnail while the next one loads', () => {
		const context = stubCanvas()
		const { container, rerender } = renderContained('/first.webp')
		const image = container.querySelector('img') as HTMLImageElement
		load(image)
		expect(context.drawImage).toHaveBeenCalled()

		Object.defineProperty(image, 'complete', {
			value: false,
			configurable: true
		})
		context.drawImage.mockClear()
		context.clearRect.mockClear()
		rerender(
			<LoadingThumbnailBackdrop
				thumbnail={{ src: '/second.webp', objectFit: 'contain' }}
				isLoaded={false}
			/>
		)

		expect(context.clearRect).toHaveBeenCalled()
		expect(context.drawImage).not.toHaveBeenCalled()
	})

	it('are left alone when the thumbnail covers the viewer', () => {
		const { container } = render(
			<LoadingThumbnailBackdrop
				thumbnail={{ src: '/thumb.webp' }}
				isLoaded={false}
			/>
		)
		expect(container.querySelector('canvas')).toBeNull()
	})
})

describe('the loading thumbnail never shows as a broken image', () => {
	const renderBackdrop = (src = '/thumb.webp') =>
		render(
			<LoadingThumbnailBackdrop
				thumbnail={{ src, alt: 'Scene loading thumbnail' }}
				isLoaded={false}
			/>
		)

	it('stays invisible until the image has loaded, then shows', () => {
		const { container } = renderBackdrop()
		const image = container.querySelector('img')
		expect(classesOf(image)).toContain('vv:invisible')

		fireEvent.load(image as HTMLImageElement)
		expect(classesOf(container.querySelector('img'))).not.toContain(
			'vv:invisible'
		)
	})

	it('leaves the image out when it fails to load', () => {
		const { container } = renderBackdrop()
		fireEvent.error(container.querySelector('img') as HTMLImageElement)
		expect(container.querySelector('img')).toBeNull()
	})

	it('hides again while a new thumbnail loads, and tries one that replaced a failure', () => {
		const { container, rerender } = renderBackdrop('/a.webp')
		fireEvent.load(container.querySelector('img') as HTMLImageElement)

		rerender(
			<LoadingThumbnailBackdrop
				thumbnail={{ src: '/b.webp', alt: 'Scene loading thumbnail' }}
				isLoaded={false}
			/>
		)
		expect(classesOf(container.querySelector('img'))).toContain('vv:invisible')
		fireEvent.error(container.querySelector('img') as HTMLImageElement)
		expect(container.querySelector('img')).toBeNull()

		rerender(
			<LoadingThumbnailBackdrop
				thumbnail={{ src: '/c.webp', alt: 'Scene loading thumbnail' }}
				isLoaded={false}
			/>
		)
		expect(container.querySelector('img')?.getAttribute('src')).toBe('/c.webp')
	})
})
