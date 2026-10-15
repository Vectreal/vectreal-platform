import { useEffect, useRef, useState } from 'react'

import type { SrcLoadOptions, SrcModel } from '../load-src'

export type SrcModelState =
	| { status: 'idle' | 'loading'; model: null; error: null }
	| ({ status: 'ready'; error: null } & SrcModel)
	| { status: 'error'; model: null; error: unknown }

const IDLE: SrcModelState = { status: 'idle', model: null, error: null }
const LOADING: SrcModelState = { status: 'loading', model: null, error: null }

export interface SrcModelCallbacks {
	onLoad?: (result: SrcModel) => void
	onLoadError?: (error: unknown) => void
}

/**
 * The model a `src` names, loaded by the viewer itself.
 *
 * Keyed on the address alone: a host passing a new options object or new
 * callbacks every render does not refetch, so both are read through a ref.
 * A new address, or no address, aborts the load in flight, and a superseded
 * load writes nothing. An abort through the caller's own `init.signal` is not
 * a supersession: that load fails with the signal's reason, so the viewer
 * does not wait on it forever.
 *
 * `null` means there is nothing to load, which is also how a caller that
 * passed `model` switches this off.
 */
export function useSrcModel(
	src: string | URL | null | undefined,
	options: SrcLoadOptions = {},
	callbacks: SrcModelCallbacks = {}
): SrcModelState {
	const [state, setState] = useState<SrcModelState>(IDLE)
	const latest = useRef({ options, callbacks })
	latest.current = { options, callbacks }

	const address = src ? String(src) : null

	useEffect(() => {
		if (!address) {
			setState(IDLE)
			return
		}

		let superseded = false
		const controller = new AbortController()
		const { options } = latest.current
		const callerSignal = options.init?.signal
		const abort = () => controller.abort(callerSignal?.reason)
		if (callerSignal?.aborted) abort()
		callerSignal?.addEventListener('abort', abort, { once: true })

		setState(LOADING)
		import('../load-src')
			.then(({ loadSrcModel }) =>
				loadSrcModel(address, {
					...options,
					init: { ...options.init, signal: controller.signal }
				})
			)
			.then(
				(loaded) => {
					if (superseded) return
					setState({ status: 'ready', error: null, ...loaded })
					latest.current.callbacks.onLoad?.(loaded)
				},
				(error: unknown) => {
					if (superseded) return
					setState({ status: 'error', model: null, error })
					latest.current.callbacks.onLoadError?.(error)
				}
			)

		return () => {
			superseded = true
			callerSignal?.removeEventListener('abort', abort)
			controller.abort()
		}
	}, [address])

	return state
}
