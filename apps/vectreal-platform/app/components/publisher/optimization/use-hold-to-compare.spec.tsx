// @vitest-environment jsdom
/**
 * Holding shows the optimizer's source in place of the optimized model, and
 * releasing shows the optimized model again. Nothing outside a hold may leave
 * the source on screen: a save would capture it as the scene's thumbnail.
 */
import { act, renderHook } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { COMPARE_HOLD_KEY, useHoldToCompare } from './use-hold-to-compare'
import { comparedModelAtom } from '../../../lib/stores/scene-optimization-store'

import type { ReactNode } from 'react'

const { optimizerSource, loadToThreeJS } = vi.hoisted(() => ({
	optimizerSource: { current: new Uint8Array([1]) as Uint8Array | null },
	loadToThreeJS: vi.fn()
}))

vi.mock('@vctrl/hooks/use-load-model', () => ({
	useModelContext: () => ({
		optimizer: { getSource: () => optimizerSource.current }
	})
}))

vi.mock('@vctrl/core/model-loader', () => ({
	ModelLoader: class {
		loadToThreeJS = loadToThreeJS
	}
}))

/** A built source whose one mesh reports when it is freed. */
const builtModel = () => {
	const geometry = { dispose: vi.fn() }
	const material = { dispose: vi.fn() }
	const mesh = { isMesh: true, geometry, material }
	return {
		geometry,
		model: { traverse: (visit: (node: unknown) => void) => visit(mesh) }
	}
}

/** Lets a pending build settle and its result reach the atom. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

const renderHold = (
	options: {
		isOpen?: boolean
		isAvailable?: boolean
		isOriginal?: boolean
	} = {}
) => {
	const store = createStore()
	const wrapper = ({ children }: { children: ReactNode }) => (
		<Provider store={store}>{children}</Provider>
	)
	const props = {
		isOpen: true,
		isAvailable: true,
		isOriginal: true,
		...options
	}
	const view = renderHook((current) => useHoldToCompare(current), {
		wrapper,
		initialProps: props
	})
	return {
		...view,
		props,
		compared: () => store.get(comparedModelAtom),
		press: () => act(() => view.result.current.holdProps.onPointerDown()),
		lift: () =>
			act(() => {
				window.dispatchEvent(new Event('pointerup'))
			})
	}
}

const pressKey = (
	key: string,
	init: KeyboardEventInit = {},
	target?: Element
) =>
	act(() => {
		;(target ?? window).dispatchEvent(
			new KeyboardEvent('keydown', { key, bubbles: true, ...init })
		)
	})
const liftKey = (key: string, init: KeyboardEventInit = {}) =>
	act(() => {
		window.dispatchEvent(new KeyboardEvent('keyup', { key, ...init }))
	})

beforeEach(() => {
	optimizerSource.current = new Uint8Array([1])
	loadToThreeJS.mockReset()
})

afterEach(() => {
	document.body.innerHTML = ''
})

describe('useHoldToCompare', () => {
	it('shows the source while held and the optimized model on release', async () => {
		const { model } = builtModel()
		loadToThreeJS.mockResolvedValue({ scene: model })
		const hold = renderHold({ isOriginal: false })

		await hold.press()
		await settle()
		expect(hold.compared()).toEqual({ model, isOriginal: false })

		hold.lift()
		expect(hold.compared()).toBeNull()
	})

	it('builds the source once, however often it is held', async () => {
		loadToThreeJS.mockResolvedValue({ scene: builtModel().model })
		const hold = renderHold()

		await hold.press()
		await settle()
		hold.lift()
		await hold.press()
		await settle()

		expect(loadToThreeJS).toHaveBeenCalledOnce()
	})

	it('builds the new source, and frees the old one, once the source changes', async () => {
		const first = builtModel()
		const second = builtModel()
		loadToThreeJS
			.mockResolvedValueOnce({ scene: first.model })
			.mockResolvedValueOnce({ scene: second.model })
		const hold = renderHold()

		await hold.press()
		await settle()
		hold.lift()
		optimizerSource.current = new Uint8Array([2])
		await hold.press()
		await settle()

		expect(hold.compared()?.model).toBe(second.model)
		expect(first.geometry.dispose).toHaveBeenCalled()
	})

	it('never shows a source released before it was built', async () => {
		let finish: (value: unknown) => void = () => {}
		loadToThreeJS.mockReturnValue(new Promise((resolve) => (finish = resolve)))
		const hold = renderHold()

		await hold.press()
		hold.lift()
		await act(async () => finish({ scene: builtModel().model }))
		await settle()

		expect(hold.compared()).toBeNull()
	})

	it('does nothing while there is nothing to compare', async () => {
		const hold = renderHold({ isAvailable: false })

		await hold.press()
		await settle()

		expect(loadToThreeJS).not.toHaveBeenCalled()
		expect(hold.compared()).toBeNull()
	})

	it('ends a hold the moment comparing stops being possible', async () => {
		loadToThreeJS.mockResolvedValue({ scene: builtModel().model })
		const hold = renderHold()
		await hold.press()
		await settle()

		hold.rerender({ ...hold.props, isAvailable: false })

		expect(hold.compared()).toBeNull()
	})

	it('frees the built source when the drawer closes', async () => {
		const built = builtModel()
		loadToThreeJS.mockResolvedValue({ scene: built.model })
		const hold = renderHold()
		await hold.press()
		await settle()
		hold.lift()

		hold.rerender({ ...hold.props, isOpen: false, isAvailable: false })
		await settle()

		expect(built.geometry.dispose).toHaveBeenCalled()
	})

	it(`holds while ${COMPARE_HOLD_KEY} is down, outside text fields`, async () => {
		loadToThreeJS.mockResolvedValue({ scene: builtModel().model })
		const hold = renderHold()

		await pressKey(COMPARE_HOLD_KEY)
		await settle()
		expect(hold.compared()).not.toBeNull()
		await liftKey(COMPARE_HOLD_KEY)
		expect(hold.compared()).toBeNull()

		const field = document.body.appendChild(document.createElement('input'))
		await pressKey(COMPARE_HOLD_KEY, {}, field)
		await pressKey(COMPARE_HOLD_KEY, { metaKey: true })
		await settle()
		expect(hold.compared()).toBeNull()
	})

	// Holding the key leaves the other hand free: a click on Save or a
	// shortcut must end the hold before it acts, or a save would capture the
	// source as its thumbnail.
	it('ends a hold on any other key or a pointer anywhere else', async () => {
		loadToThreeJS.mockResolvedValue({ scene: builtModel().model })
		const hold = renderHold()
		const elsewhere = document.body.appendChild(
			document.createElement('button')
		)

		await pressKey(COMPARE_HOLD_KEY)
		await settle()
		await pressKey('Meta')
		expect(hold.compared()).toBeNull()

		await liftKey(COMPARE_HOLD_KEY)
		await pressKey(COMPARE_HOLD_KEY)
		await settle()
		expect(hold.compared()).not.toBeNull()
		await act(() => {
			elsewhere.dispatchEvent(new Event('pointerdown', { bubbles: true }))
		})
		expect(hold.compared()).toBeNull()
	})

	it('keeps holding while the hold button itself is pressed or held by key', async () => {
		loadToThreeJS.mockResolvedValue({ scene: builtModel().model })
		const hold = renderHold()
		const button = document.body.appendChild(document.createElement('button'))
		for (const [name, value] of Object.entries(hold.result.current.holdProps)) {
			if (typeof value === 'string') button.setAttribute(name, value)
		}

		await hold.press()
		await settle()
		await act(() => {
			button.dispatchEvent(new Event('pointerdown', { bubbles: true }))
		})
		await pressKey(' ', {}, button)

		expect(hold.compared()).not.toBeNull()
		expect(button.hasAttribute('data-vaul-no-drag')).toBe(true)
	})

	it('tries a failed build again on the next hold', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {})
		const { model } = builtModel()
		loadToThreeJS
			.mockRejectedValueOnce(new Error('decoder'))
			.mockResolvedValueOnce({ scene: model })
		const hold = renderHold()

		await hold.press()
		await settle()
		hold.lift()
		await hold.press()
		await settle()

		expect(hold.compared()?.model).toBe(model)
	})

	// Option and AltGr type a backslash on some layouts.
	it('holds on a backslash typed with Option or AltGr, not with Cmd', async () => {
		loadToThreeJS.mockResolvedValue({ scene: builtModel().model })
		const hold = renderHold()

		await pressKey(COMPARE_HOLD_KEY, { metaKey: true })
		await settle()
		expect(hold.compared()).toBeNull()

		await pressKey(COMPARE_HOLD_KEY, { altKey: true, ctrlKey: true })
		await settle()
		expect(hold.compared()).not.toBeNull()
	})

	// German Mac: Option+Shift+7 types the backslash. Let go of Option first
	// and the 7 is reported as itself when it comes up.
	it('ends a key hold when the key that started it comes up, whatever it now types', async () => {
		loadToThreeJS.mockResolvedValue({ scene: builtModel().model })
		const hold = renderHold()
		await pressKey(COMPARE_HOLD_KEY, { altKey: true, code: 'Digit7' })
		await settle()
		await liftKey('Alt', { code: 'AltLeft' })
		expect(hold.compared()).not.toBeNull()

		await liftKey('7', { code: 'Digit7' })

		expect(hold.compared()).toBeNull()
	})

	it('stops preparing when the source cannot be built mid-hold', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {})
		loadToThreeJS.mockRejectedValue(new Error('decoder'))
		const hold = renderHold()

		await hold.press()
		await settle()

		expect(hold.result.current.isPreparing).toBe(false)
		expect(hold.compared()).toBeNull()
	})

	it('hears a key even when a handler stops it on its way up', async () => {
		loadToThreeJS.mockResolvedValue({ scene: builtModel().model })
		const hold = renderHold()
		const panel = document.body.appendChild(document.createElement('div'))
		panel.addEventListener('keydown', (event) => event.stopPropagation())
		await pressKey(COMPARE_HOLD_KEY)
		await settle()

		await pressKey('Escape', {}, panel)

		expect(hold.compared()).toBeNull()
	})

	it('lets go when the window loses focus mid-hold', async () => {
		loadToThreeJS.mockResolvedValue({ scene: builtModel().model })
		const hold = renderHold()
		await pressKey(COMPARE_HOLD_KEY)
		await settle()

		await act(() => {
			window.dispatchEvent(new Event('blur'))
		})

		expect(hold.compared()).toBeNull()
	})
})
