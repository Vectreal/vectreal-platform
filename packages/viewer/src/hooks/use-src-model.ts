import { useEffect, useRef, useState } from 'react'

import type { SrcLoadOptions, SrcModel } from '../load-src'
import type { LoadProgress } from '@vctrl/core'

export type SrcModelState =
	| { status: 'idle'; model: null; error: null }
	/** `progress` is null until the download reports. */
	| {
			status: 'loading'
			model: null
			error: null
			progress: LoadProgress | null
	  }
	| ({ status: 'ready'; error: null } & SrcModel)
	| { status: 'error'; model: null; error: unknown }

const IDLE: SrcModelState = { status: 'idle', model: null, error: null }
const LOADING: Extract<SrcModelState, { status: 'loading' }> = {
	status: 'loading',
	model: null,
	error: null,
	progress: null
}

/*
  A download reports every chunk, hundreds for a large model; the loader shows
  whole steps. One render per whole percent, per 256 KB with no known size, or
  per phase or file count change.
*/
const progressKey = ({ phase, bytes, items }: LoadProgress) =>
	bytes
		? bytes.total
			? `${phase}:${Math.floor((bytes.loaded / bytes.total) * 100)}`
			: `${phase}:~${Math.floor(bytes.loaded / (256 * 1024))}`
		: `${phase}:${items?.loaded ?? ''}/${items?.total ?? ''}`

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
		let shown = ''
		const onProgress = (progress: LoadProgress) => {
			const key = progressKey(progress)
			if (superseded || key === shown) return
			shown = key
			setState({ ...LOADING, progress })
		}
		import('../load-src')
			.then(({ loadSrcModel }) =>
				loadSrcModel(
					address,
					{
						...options,
						init: { ...options.init, signal: controller.signal }
					},
					onProgress
				)
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
