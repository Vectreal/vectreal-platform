/* vectreal-core | vctrl/hooks
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>. */

import { fetchModelFiles, ModelLoader } from '@vctrl/core/model-loader'
import { useCallback, useMemo, useRef, useState } from 'react'

import {
	normalizeLocalLoadError,
	normalizeServerLoadError,
	normalizeUrlLoadError
} from './error-helpers'
import { loadModelFromFiles } from './file-loaders'
import { useOptimizerIntegration } from './optimizer-integration'
import { loadModelFromSceneData, loadModelFromServer } from './scene-loaders'
import {
	emptyModelState,
	errorModelState,
	loadingModelState,
	readyModelState,
	supportedFileTypes
} from './state'
import {
	LoadedModel,
	LoadOptions,
	ModelSource,
	LoadOutcome,
	ModelState,
	UseLoadModelReturn
} from './types'

import type { LoadContext } from './load-context'
import type { useOptimizeModel } from '../use-optimize-model'
import type { OperationProgress } from '@vctrl/core'

/**
 * Loads and holds one 3D model, from files, from a scene payload, or from the API.
 *
 * There is a single entry point, `load(source)`, and a single state value. The
 * state is a discriminated union, so "a model is on screen" and "loading
 * finished" are the same fact and cannot disagree. `load` never rejects: it
 * resolves to the terminal state.
 *
 * One case separates the resolved value from the state. A rejected upload
 * leaves a model that was already on screen exactly as it was, because dropping
 * the wrong file should not cost the user their scene, so that failure is
 * reported only through the value `load` resolves to. With nothing on screen,
 * and for every other source, which replaces what is there, the failure is the
 * state.
 *
 * @template T - The type of the optimizer parameter (inferred automatically)
 * @param optimizer - Optional optimizer hook returned from useOptimizeModel
 * @returns Model state and methods, with a conditionally typed optimizer property
 */
function useLoadModel<
	T extends ReturnType<typeof useOptimizeModel> | undefined
>(optimizer?: T): UseLoadModelReturn<T extends undefined ? false : true> {
	const [state, setState] = useState<ModelState>(emptyModelState)

	// `useOptimizeModel` returns a fresh object every render. Reading it through a
	// ref is what keeps `load` referentially stable, so callers can put it in an
	// effect's dependency list without the effect re-firing on every render.
	const optimizerRef = useRef(optimizer)
	optimizerRef.current = optimizer

	// Every load claims a token. Only the newest one may write state, so a slow
	// load that has been superseded (or reset) can never overwrite the current
	// model, and callers never need their own `cancelled` flag.
	const loadTokenRef = useRef(0)
	// The load whose model is on screen, or 0; see `LoadContext.mayIngest`.
	const onScreenRef = useRef(0)

	/*
	  The only writer of `onScreenRef`. The optimizer may hold the on-screen
	  model or none, so another model reaching the screen releases it here,
	  rather than when an ingest gets as far as claiming it: a read that fails
	  first, or a source that never ingests, would otherwise leave the previous
	  model's document to be optimized and saved under the new model's name.
	*/
	const putOnScreen = useCallback((owner: number) => {
		if (onScreenRef.current === owner) return
		onScreenRef.current = owner
		optimizerRef.current?.reset()
	}, [])

	/*
	  For the optimizer's conversions, which report no progress. Each load
	  parses with a loader of its own (see `load`).
	*/
	const modelLoader = useMemo(() => new ModelLoader(), [])

	// The in-flight URL fetch, aborted by any newer load or a reset.
	const fetchAbortRef = useRef<AbortController | null>(null)

	// Read inside `load` so a failure can put back what was on screen.
	const stateRef = useRef(state)
	stateRef.current = state

	/*
	  The last model that reached the screen, which is not what `state` holds
	  once a second load is in flight.

	  `modelOnScreen` used to read `stateRef.current` and require `ready`. A load
	  commits `loadingModelState` on the way in, which blanks the file - so with
	  A on screen, a slow B in flight and then a bad C, C read `loading`, took
	  null, and its failure committed an error state that took A off the screen.
	  The promise directly above `modelOnScreen` - that a failed load costs the
	  visitor nothing - held only while no other load overlapped it, which is
	  exactly when dropping the wrong file is easiest.

	  Written from `commit` as well as during render because the two answer at
	  different times: `commit` is synchronous, so a load starting in the same
	  tick as the previous one's success still sees it, while the render pass
	  catches `replaceModel`, which swaps the file without going through `load`.
	*/
	const lastReadyRef = useRef<ModelState | null>(null)
	if (state.status === 'ready') lastReadyRef.current = state

	const load = useCallback(
		async (
			source: ModelSource,
			options?: LoadOptions
		): Promise<LoadOutcome> => {
			const token = ++loadTokenRef.current
			const isCurrent = () => loadTokenRef.current === token
			fetchAbortRef.current?.abort()
			fetchAbortRef.current = null

			/*
			  The same token the state writes are gated on, handed to the caller.

			  Without it a retired load resolves to a `ready` state that is
			  byte-identical to the winner's, so every caller acting on the value
			  rather than on the rendered state had to run a second clock of its
			  own - and two of them did, differently. `isCurrent` is not captured
			  as a boolean because the question outlives this function: a caller
			  that then encodes or exports has awaits of its own, and a drop can
			  land inside any of them.
			*/
			const isOnScreen = () => onScreenRef.current === token
			const outcome = (next: ModelState): LoadOutcome => ({
				...next,
				stillCurrent: isCurrent,
				stillOnScreen: isOnScreen
			})
			// Only an upload or a URL is an attempt to *add* a model; a scene source
			// replaces the one on screen, so its failure has to be visible as one
			// rather than leaving the previous scene's geometry under the new
			// scene's name.
			const modelOnScreen =
				source.kind === 'files' || source.kind === 'url'
					? lastReadyRef.current
					: null
			const modelOnScreenLoad = onScreenRef.current

			// `owner` is the load whose model `next` shows: this one, except when
			// a failure puts the previous model back.
			const commit = (next: ModelState, owner = token): ModelState => {
				if (isCurrent()) {
					if (next.status === 'ready') {
						lastReadyRef.current = next
						putOnScreen(owner)
					}
					if (next.status === 'error') putOnScreen(0)
					setState(next)
				}
				return next
			}

			// The loaders publish as soon as the model is parsed, before the
			// optimizer has ingested it, so the viewer never waits on that.
			let published: ModelState | null = null

			/*
			  A loader of this load's own, so the progress it reports is this
			  load's. A loader has one progress listener and no idea which call
			  emitted, so on a shared one a superseded load still parsing drew
			  its percentage into the newer load's bar. Its decoders are cached
			  per module, not per instance, so a loader costs a `WebIO`.

			  `parseRange` is the span of the bar the parser fills, as [start,
			  width]: all of it, except after a URL's download has filled the
			  first 90, where drawing the parser's own 0 to 100 would run the
			  bar back to the start.
			*/
			let parseRange: [number, number] = [0, 100]
			const loadLoader = new ModelLoader()
			loadLoader.onProgress((progress: OperationProgress) => {
				if (!isCurrent()) return
				const [start, width] = parseRange
				setState((prev) =>
					prev.status === 'loading'
						? { ...prev, progress: start + (progress.progress * width) / 100 }
						: prev
				)
			})

			const context: LoadContext = {
				modelLoader: loadLoader,
				optimizer: optimizerRef.current,
				mayIngest: isOnScreen,
				publish: (loaded: LoadedModel) => {
					published = commit(readyModelState(source.kind, loaded, token))
					/*
					  The same instant the viewer changes, so a caller can move what
					  it prints with the stage rather than an optimizer ingest later.
					  Guarded, because a retired load must not describe the page.
					*/
					if (isCurrent()) options?.onPublish?.(outcome(published))
				},
				onProgress: (progress: number) => {
					if (isCurrent()) {
						setState((prev) =>
							prev.status === 'loading' ? { ...prev, progress } : prev
						)
					}
				}
			}

			/*
			  A URL becomes the files a drop would give, and from there it is a
			  drop. The download fills the first 90 of the bar and parsing the
			  rest. Aborted by the next load or a reset, and by the caller's own
			  signal; listened to rather than combined, because
			  `AbortSignal.any` is newer than some browsers this package runs in.
			*/
			/*
			  Set when the download itself rejected after an abort. Which phase
			  threw decides it, not when the abort landed, so a parse failure
			  after a late abort still reports itself.
			*/
			let downloadAborted = false
			const fetchFiles = (
				{ url, init }: Extract<ModelSource, { kind: 'url' }>,
				{ onProgress }: LoadContext
			) => {
				const controller = new AbortController()
				fetchAbortRef.current = controller
				const callerSignal = init?.signal
				const abort = () => controller.abort(callerSignal?.reason)
				if (callerSignal?.aborted) abort()
				callerSignal?.addEventListener('abort', abort, { once: true })
				return fetchModelFiles(url, {
					init: { ...init, signal: controller.signal },
					onProgress: (fraction) => onProgress(fraction * 90)
				})
					.catch((error: unknown) => {
						downloadAborted = controller.signal.aborted
						throw error
					})
					.finally(() => {
						// A long-lived caller signal must not collect one per load.
						callerSignal?.removeEventListener('abort', abort)
						if (fetchAbortRef.current === controller) {
							fetchAbortRef.current = null
						}
						parseRange = [90, 10]
					})
			}

			commit(loadingModelState(source.kind))

			try {
				const loaded =
					source.kind === 'files'
						? await loadModelFromFiles(source.files, context)
						: source.kind === 'url'
							? await loadModelFromFiles(
									await fetchFiles(source, context),
									context
								)
							: source.kind === 'scene-data'
								? await loadModelFromSceneData(source, context)
								: await loadModelFromServer(source, context)

				return outcome(
					published ?? commit(readyModelState(source.kind, loaded, token))
				)
			} catch (error) {
				/*
				  The download was aborted: by the caller's signal, a newer load or
				  a reset. Not a failure to report. What was on screen stays, and
				  the load resolves empty, as one that never started would have
				  left the page.
				*/
				if (downloadAborted) {
					commit(modelOnScreen ?? emptyModelState, modelOnScreenLoad)
					return outcome(emptyModelState)
				}

				const structured =
					source.kind === 'files'
						? normalizeLocalLoadError(error, 'unknown')
						: source.kind === 'url'
							? normalizeUrlLoadError(error, String(source.url))
							: normalizeServerLoadError(error, source.sceneId ?? '')

				console.error(`Model load failed (${source.kind}):`, structured)

				// A load that fails takes nothing with it. Dropping the wrong file
				// onto an open scene reports the problem; it does not clear the model
				// the user was working on.
				if (modelOnScreen) commit(modelOnScreen, modelOnScreenLoad)
				else commit(errorModelState(source.kind, structured))
				return outcome(errorModelState(source.kind, structured))
			}
		},
		[putOnScreen]
	)

	const reset = useCallback(() => {
		// Claiming a token retires any in-flight load along with the state.
		loadTokenRef.current += 1
		fetchAbortRef.current?.abort()
		fetchAbortRef.current = null
		// No load may ingest a model that is no longer on screen.
		putOnScreen(0)
		// Nothing is on screen after this, so a later failure has nothing to
		// restore - without it, clearing the model and then failing a drop would
		// bring the cleared model back.
		lastReadyRef.current = null
		setState(emptyModelState)
	}, [putOnScreen])

	/*
	  Swaps in a new rendition of the model one load put on screen, and only that
	  load's. An optimization pass outlives a load started while it runs, and its
	  result arriving afterwards would otherwise replace the newer model with the
	  older one's output, under the newer load's id.
	*/
	const replaceModel = useCallback(
		(file: LoadedModel['file'], forLoadId: number) => {
			setState((prev) =>
				prev.status === 'ready' && prev.loadId === forLoadId
					? { ...prev, file }
					: prev
			)
		},
		[]
	)

	const isLatestLoad = useCallback(
		(loadId: number) => loadTokenRef.current === loadId,
		[]
	)

	const optimizerIntegration = useOptimizerIntegration(
		optimizer,
		replaceModel,
		state.file,
		state.status === 'ready' ? state.loadId : null,
		modelLoader
	)

	return {
		...state,
		supportedFileTypes,
		load,
		reset,
		isLatestLoad,
		optimizer: optimizerIntegration
	} as UseLoadModelReturn<T extends undefined ? false : true>
}

export default useLoadModel
