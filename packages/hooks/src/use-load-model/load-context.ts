import type { LoadedModel } from './types'
import type { useOptimizeModel } from '../use-optimize-model'
import type { ModelLoader } from '@vctrl/core/model-loader'

export type Optimizer = ReturnType<typeof useOptimizeModel> | undefined

/**
 * What every per-source loader needs, and nothing else.
 *
 * `publish` exists because a load has two useful moments: the model is parsed
 * and can be rendered, and the optimizer has finished ingesting it. Publishing
 * the first means the viewer never waits on the second.
 */
export interface LoadContext {
	modelLoader: ModelLoader
	optimizer: Optimizer
	publish: (loaded: LoadedModel) => void
	onProgress: (progress: number) => void
}
