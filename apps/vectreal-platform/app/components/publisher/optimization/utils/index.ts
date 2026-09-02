export { withTimeout } from './with-timeout'

export {
	runGeometryOptimizationsInWorker,
	OPTIMIZATION_STEP_TIMEOUT_MS,
	MODEL_SYNC_TIMEOUT_MS
} from './geometry-worker'
export type { GeometryOptimizationResult } from './geometry-worker'

export {
	resolvePublishedSceneBytes,
	useSceneSizeCalculator
} from './scene-size'
