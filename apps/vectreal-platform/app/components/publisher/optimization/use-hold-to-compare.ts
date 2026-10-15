import { ModelLoader } from '@vctrl/core/model-loader'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useSetAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { comparedModelAtom } from '../../../lib/stores/scene-optimization-store'

import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { Material, Mesh, Object3D, Texture } from 'three'

/** The key that holds the comparison anywhere outside a text field. */
export const COMPARE_HOLD_KEY = '\\'

/** Frees what a built source holds on the GPU. It is never shown again. */
const disposeModel = (model: Object3D) => {
	model.traverse((node) => {
		const mesh = node as Mesh
		if (!mesh.isMesh) return
		mesh.geometry?.dispose()
		const materials: Material[] = Array.isArray(mesh.material)
			? mesh.material
			: [mesh.material]
		for (const material of materials) {
			for (const value of Object.values(material)) {
				if ((value as Texture | null)?.isTexture) (value as Texture).dispose()
			}
			material.dispose()
		}
	})
}

const HOLD_BUTTON_ATTRIBUTE = 'data-compare-hold'

const isHoldButton = (target: EventTarget | null) =>
	target instanceof Element &&
	target.closest(`[${HOLD_BUTTON_ATTRIBUTE}]`) !== null

/** The keys that hold the button itself while it has focus. */
const isButtonHoldKey = (key: string) => key === ' ' || key === 'Enter'

const isTextField = (target: EventTarget | null) =>
	target instanceof HTMLElement &&
	(target.isContentEditable ||
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target instanceof HTMLSelectElement)

interface HoldToCompareOptions {
	/** Whether the drawer is open: closing it frees the built source. */
	isOpen: boolean
	/** Whether there is anything to compare right now. */
	isAvailable: boolean
	/** Whether the source is the untouched upload, for the canvas label. */
	isOriginal: boolean
}

/**
 * Shows the optimizer's source in place of the optimized model for as long as
 * the author holds it, and the optimized model again on release.
 *
 * Holding is the whole interaction on purpose: any other key or pointer
 * ends the hold before it acts, so a save can never start mid-compare and
 * capture the source as its thumbnail. The source is built once per source
 * and freed when the drawer closes, since an original can be large.
 */
export function useHoldToCompare({
	isOpen,
	isAvailable,
	isOriginal
}: HoldToCompareOptions) {
	const { optimizer } = useModelContext(true)
	const setComparedModel = useSetAtom(comparedModelAtom)
	const loader = useMemo(() => new ModelLoader(), [])
	const builtRef = useRef<{
		source: Uint8Array
		model: Promise<Object3D | null>
	} | null>(null)
	const heldRef = useRef(false)
	// The physical key holding the comparison. A layout that types `\` with a
	// modifier reports another `key` once the modifier is let go first.
	const holdKeyCodeRef = useRef<string | null>(null)
	const [isPreparing, setIsPreparing] = useState(false)

	const release = useCallback(() => {
		heldRef.current = false
		holdKeyCodeRef.current = null
		setIsPreparing(false)
		setComparedModel(null)
	}, [setComparedModel])

	const freeBuilt = useCallback(() => {
		const built = builtRef.current
		builtRef.current = null
		void built?.model.then((model) => model && disposeModel(model))
	}, [])

	const hold = useCallback(async () => {
		if (!isAvailable || heldRef.current) return
		const source = optimizer.getSource()
		if (!source) return
		heldRef.current = true

		if (builtRef.current?.source !== source) {
			freeBuilt()
			builtRef.current = {
				source,
				model: loader
					.loadToThreeJS(
						new File([source as Uint8Array<ArrayBuffer>], 'source.glb', {
							type: 'model/gltf-binary'
						})
					)
					.then((result) => result.scene)
					.catch((error: unknown) => {
						console.warn('[optimization] the source could not be shown', error)
						return null
					})
			}
		}
		const built = builtRef.current

		setIsPreparing(true)
		const model = await built.model
		if (!model) {
			// Not kept, so the next hold tries again.
			if (builtRef.current === built) builtRef.current = null
			if (heldRef.current) setIsPreparing(false)
			return
		}
		// Released, or the source replaced, while it was being built.
		if (!heldRef.current || builtRef.current !== built) return
		setIsPreparing(false)
		setComparedModel({ model, isOriginal })
	}, [freeBuilt, isAvailable, isOriginal, loader, optimizer, setComparedModel])

	// A pass starting, the original loading or the drawer closing ends a hold.
	useEffect(() => {
		if (!isAvailable) release()
	}, [isAvailable, release])

	useEffect(() => {
		if (!isOpen) freeBuilt()
	}, [isOpen, freeBuilt])

	useEffect(
		() => () => {
			release()
			freeBuilt()
		},
		[release, freeBuilt]
	)

	// While a hold lasts, nothing else may happen: any other key or a pointer
	// anywhere else ends it first, so the hold key and a click on Save, or a
	// shortcut whose release the browser never reports, cannot overlap it.
	useEffect(() => {
		if (!isAvailable) return
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === COMPARE_HOLD_KEY) {
				if (event.repeat) return
				// Option and AltGr type `\` on some layouts; Cmd makes it a shortcut.
				if (event.metaKey) return
				if (isTextField(event.target)) return
				event.preventDefault()
				// `hold` marks the hold before its first await.
				void hold()
				if (heldRef.current) holdKeyCodeRef.current = event.code
				return
			}
			const onHoldButton = isHoldButton(event.target)
			if (onHoldButton && isButtonHoldKey(event.key)) return
			if (heldRef.current) release()
		}
		const onKeyUp = (event: KeyboardEvent) => {
			if (
				event.key === COMPARE_HOLD_KEY ||
				(holdKeyCodeRef.current !== null &&
					event.code === holdKeyCodeRef.current)
			) {
				release()
			}
		}
		const onPointerDown = (event: PointerEvent) => {
			if (heldRef.current && !isHoldButton(event.target)) release()
		}
		// Capture, so a handler that stops a key on its way up (Escape in a
		// drill-down, say) cannot hide it from the hold.
		window.addEventListener('keydown', onKeyDown, true)
		window.addEventListener('keyup', onKeyUp, true)
		window.addEventListener('pointerdown', onPointerDown, true)
		window.addEventListener('pointerup', release)
		window.addEventListener('pointercancel', release)
		window.addEventListener('blur', release)
		return () => {
			window.removeEventListener('keydown', onKeyDown, true)
			window.removeEventListener('keyup', onKeyUp, true)
			window.removeEventListener('pointerdown', onPointerDown, true)
			window.removeEventListener('pointerup', release)
			window.removeEventListener('pointercancel', release)
			window.removeEventListener('blur', release)
		}
	}, [isAvailable, hold, release])

	const holdProps = {
		[HOLD_BUTTON_ATTRIBUTE]: '',
		// The mobile sheet would otherwise take the press as a drag.
		'data-vaul-no-drag': '',
		onPointerDown: () => void hold(),
		onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
			if (!isButtonHoldKey(event.key)) return
			event.preventDefault()
			if (!event.repeat) void hold()
		},
		onKeyUp: (event: ReactKeyboardEvent<HTMLElement>) => {
			if (isButtonHoldKey(event.key)) release()
		},
		onBlur: release
	}

	return { isPreparing, holdProps }
}
