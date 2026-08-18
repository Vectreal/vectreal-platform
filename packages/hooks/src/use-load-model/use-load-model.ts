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

import { ModelLoader } from '@vctrl/core/model-loader'
import { useCallback, useMemo, useRef, useState } from 'react'

import { normalizeLocalLoadError } from './error-helpers'
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
	ModelSource,
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
 * finished" are the same fact and cannot disagree. `load` never rejects: the
 * failure is the state, which every consumer already renders from.
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

	const modelLoader = useMemo(() => {
		const loader = new ModelLoader()
		// Parser progress only means anything while a load is in flight.
		loader.onProgress((progress: OperationProgress) => {
			setState((prev) =>
				prev.status === 'loading'
					? { ...prev, progress: progress.progress }
					: prev
			)
		})
		return loader
	}, [])

	const load = useCallback(
		async (source: ModelSource): Promise<ModelState> => {
			const token = ++loadTokenRef.current
			const isCurrent = () => loadTokenRef.current === token

			const commit = (next: ModelState): ModelState => {
				if (isCurrent()) setState(next)
				return next
			}

			// The loaders publish as soon as the model is parsed, before the
			// optimizer has ingested it, so the viewer never waits on that.
			let published: ModelState | null = null

			const context: LoadContext = {
				modelLoader,
				optimizer: optimizerRef.current,
				publish: (loaded: LoadedModel) => {
					published = commit(readyModelState(source.kind, loaded))
				},
				onProgress: (progress: number) => {
					if (isCurrent()) {
						setState((prev) =>
							prev.status === 'loading' ? { ...prev, progress } : prev
						)
					}
				}
			}

			commit(loadingModelState(source.kind))

			try {
				const loaded =
					source.kind === 'files'
						? await loadModelFromFiles(source.files, context)
						: source.kind === 'scene-data'
							? await loadModelFromSceneData(source, context)
							: await loadModelFromServer(source, context)

				return published ?? commit(readyModelState(source.kind, loaded))
			} catch (error) {
				const structured = normalizeLocalLoadError(error, 'unknown')

				console.error(`Model load failed (${source.kind}):`, structured)
				return commit(errorModelState(source.kind, structured))
			}
		},
		[modelLoader]
	)

	const reset = useCallback(() => {
		// Claiming a token retires any in-flight load along with the state.
		loadTokenRef.current += 1
		setState(emptyModelState)
	}, [])

	const replaceModel = useCallback((file: LoadedModel['file']) => {
		setState((prev) =>
			prev.status === 'ready' ? { ...prev, file } : prev
		)
	}, [])

	const optimizerIntegration = useOptimizerIntegration(
		optimizer,
		replaceModel,
		state.file,
		modelLoader
	)

	return {
		...state,
		supportedFileTypes,
		load,
		reset,
		optimizer: optimizerIntegration
	} as UseLoadModelReturn<T extends undefined ? false : true>
}

export default useLoadModel
