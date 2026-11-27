// @vitest-environment jsdom
import { readFileSync } from 'fs'
import path from 'path'

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ViewerPoster } from './viewer-poster'

beforeEach(() => {
	vi.stubGlobal(
		'matchMedia',
		vi.fn(() => ({
			matches: false,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		}))
	)
})

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

describe('the viewer poster', () => {
	it('offers the scene with one button named after it', () => {
		const onActivate = vi.fn()
		render(
			<ViewerPoster
				thumbnail="/thumb.webp"
				label="A ceramic vase"
				locale="en"
				onActivate={onActivate}
			/>
		)

		const button = screen.getByRole('button', {
			name: 'View A ceramic vase in 3D'
		})
		expect(button.textContent).toBe('View in 3D')
		fireEvent.click(button)
		expect(onActivate).toHaveBeenCalledOnce()
		// Nothing else on it takes focus or a click.
		expect(screen.getAllByRole('button')).toHaveLength(1)
	})

	it('shows the loader where the button was while loading', () => {
		render(
			<ViewerPoster
				state="loading"
				locale="en"
				loader={<span data-testid="loader" />}
				onActivate={vi.fn()}
			/>
		)

		expect(screen.queryByRole('button')).toBeNull()
		expect(screen.getByTestId('loader')).toBeTruthy()
	})

	it('draws the viewer loader by default while loading', () => {
		render(<ViewerPoster state="loading" locale="en" onActivate={vi.fn()} />)

		expect(screen.getByRole('progressbar')).toBeTruthy()
	})

	it('announces loading and then the failure, and offers the scene again', () => {
		const onActivate = vi.fn()
		const props = { label: 'A ceramic vase', locale: 'en', onActivate }
		const { container, rerender } = render(<ViewerPoster {...props} />)
		const region = () => container.querySelector('[aria-live="polite"]')
		expect(region()?.textContent).toBe('')

		rerender(<ViewerPoster {...props} state="loading" />)
		expect(region()?.textContent).toBe('Loading')

		rerender(<ViewerPoster {...props} state="failed" />)
		expect(region()?.textContent).toBe("Couldn't load, try again")
		fireEvent.click(
			screen.getByRole('button', { name: "Couldn't load, try again" })
		)
		expect(onActivate).toHaveBeenCalledOnce()
	})

	it('keeps focus on the poster while loading and returns it to the retry button', () => {
		const props = { locale: 'en', onActivate: vi.fn() }
		const { container, rerender } = render(<ViewerPoster {...props} />)
		const button = screen.getByRole('button')
		button.focus()
		fireEvent.click(button)

		rerender(<ViewerPoster {...props} state="loading" />)
		expect(document.activeElement).toBe(container.firstElementChild)

		rerender(<ViewerPoster {...props} state="failed" />)
		expect(document.activeElement).toBe(screen.getByRole('button'))
	})

	it('takes no focus when the host starts or fails a load', () => {
		const props = { locale: 'en', onActivate: vi.fn() }
		;(document.activeElement as HTMLElement | null)?.blur()
		const { rerender } = render(<ViewerPoster {...props} />)

		rerender(<ViewerPoster {...props} state="loading" />)
		expect(document.activeElement).toBe(document.body)
		rerender(<ViewerPoster {...props} state="failed" />)
		expect(document.activeElement).toBe(document.body)
	})

	it('leaves focus alone when it was elsewhere on the page', () => {
		const props = { locale: 'en', onActivate: vi.fn() }
		const outside = document.createElement('input')
		document.body.append(outside)
		outside.focus()
		const { rerender } = render(<ViewerPoster {...props} />)

		rerender(<ViewerPoster {...props} state="loading" />)
		expect(document.activeElement).toBe(outside)
		outside.remove()
	})

	it('speaks the scene language', () => {
		render(
			<ViewerPoster
				locale="en"
				onActivate={vi.fn()}
				messages={{ viewInThreeD: 'Ansehen' }}
			/>
		)

		expect(screen.getByRole('button').textContent).toBe('Ansehen')
	})

	it('shows the image while it loads, so a server-rendered poster paints, and drops one that fails', () => {
		const { container } = render(
			<ViewerPoster thumbnail="/thumb.webp" onActivate={vi.fn()} />
		)
		const image = container.querySelector('img')
		expect(image?.getAttribute('class')).not.toContain('vv:invisible')
		expect(image?.getAttribute('alt')).toBe('')

		fireEvent.error(image!)
		expect(container.querySelector('img')).toBeNull()
	})

	/** An image that settled before React listened: complete, with no width. */
	const stubSettledWithoutWidth = (decodes: boolean) => {
		vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(
			true
		)
		vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(
			0
		)
		HTMLImageElement.prototype.decode = vi.fn(() =>
			decodes ? Promise.resolve() : Promise.reject(new Error('EncodingError'))
		)
	}

	it('drops an image that failed before it hydrated', async () => {
		stubSettledWithoutWidth(false)
		const { container } = render(
			<ViewerPoster thumbnail="/thumb.webp" onActivate={vi.fn()} />
		)
		await waitFor(() => expect(container.querySelector('img')).toBeNull())
	})

	it('keeps an image with no size of its own, such as an SVG', async () => {
		stubSettledWithoutWidth(true)
		const { container } = render(
			<ViewerPoster thumbnail="/thumb.svg" onActivate={vi.fn()} />
		)
		await act(async () => {
			await Promise.resolve()
		})
		expect(HTMLImageElement.prototype.decode).toHaveBeenCalled()
		expect(container.querySelector('img')).not.toBeNull()
	})

	it('draws on the background it is given when there is no image', () => {
		const { container } = render(
			<ViewerPoster background="rgb(1, 2, 3)" onActivate={vi.fn()} />
		)
		expect(container.querySelector('img')).toBeNull()
		expect((container.firstElementChild as HTMLElement).style.background).toBe(
			'rgb(1, 2, 3)'
		)
	})
})

describe('the poster entry', () => {
	/*
	  The entry's promise is that a page showing only posters never downloads
	  three.js or the viewer. Followed through the source graph from the entry,
	  so an import anywhere below it that would break the promise fails here:
	  every bare package it reaches must be on this list.
	*/
	const ALLOWED_PACKAGES = new Set([
		'react',
		'react/jsx-runtime',
		'clsx',
		'tailwind-merge'
	])
	const WORKSPACE: Record<string, string> = {
		'@vctrl/core/viewer-locale': '../../../core/src/viewer-locale/index.ts',
		'@shared/components/ui/load-progress':
			'../../../../shared/components/src/ui/load-progress.ts',
		'@shared/utils': '../../../../shared/utils/src/index.ts'
	}
	const here = import.meta.dirname

	const resolveFile = (from: string, specifier: string) => {
		const base = path.resolve(path.dirname(from), specifier)
		for (const candidate of [
			base,
			`${base}.ts`,
			`${base}.tsx`,
			path.join(base, 'index.ts')
		]) {
			try {
				if (readFileSync(candidate)) return candidate
			} catch {
				// Not this one; try the next extension.
			}
		}
		throw new Error(`Cannot resolve ${specifier} from ${from}`)
	}

	const reachedPackages = () => {
		const seen = new Set<string>()
		const packages = new Set<string>()
		const visit = (file: string) => {
			if (seen.has(file)) return
			seen.add(file)
			// Type-only statements first, each bounded by its own string and
			// semicolon so it cannot reach into the statement after it.
			const source = readFileSync(file, 'utf8').replace(
				/^(?:import|export)\s+type\b[^'";]*from\s*['"][^'"]+['"]/gm,
				''
			)
			// Every form that loads a module: `from '…'`, a side-effect
			// `import '…'`, and a dynamic `import('…')`.
			for (const [, specifier] of source.matchAll(
				/(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g
			)) {
				if (specifier.startsWith('.')) {
					if (!/\.css$/.test(specifier)) visit(resolveFile(file, specifier))
				} else if (WORKSPACE[specifier]) {
					visit(path.resolve(here, WORKSPACE[specifier]))
				} else {
					packages.add(specifier)
				}
			}
		}
		visit(path.resolve(here, '../poster.ts'))
		return { packages, files: seen }
	}

	it('reaches no package that draws in 3D', () => {
		const { packages, files } = reachedPackages()
		expect([...packages].filter((name) => !ALLOWED_PACKAGES.has(name))).toEqual(
			[]
		)
		// The walk really went through the poster and its loader.
		expect([...files].some((file) => file.endsWith('viewer-poster.tsx'))).toBe(
			true
		)
		expect([...files].some((file) => file.endsWith('load-progress.ts'))).toBe(
			true
		)
	})
})
