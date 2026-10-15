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
	/**
	 * Whether this load's model is the one on screen, which is the only model
	 * the optimizer may hold. Not whether it is the newest load: a newer drop
	 * that fails puts this load's model back, and it must still reach the
	 * optimizer, while a load retired before it published never may. Call it
	 * right before each optimizer call, which claims the optimizer.
	 */
	mayIngest: () => boolean
}
