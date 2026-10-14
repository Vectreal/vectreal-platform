import './styles.css'

export {
	default as VectrealViewer,
	type BakedShadow,
	type SceneScreenshotCapture,
	type SceneCameraSnapshot,
	type SceneCameraSnapshotCapture,
	type SceneScreenshotOptions,
	type ShadowBakeCapture,
	type ShadowBakeResult,
	type ViewerCommandExecutor,
	type ViewerCommand,
	type ViewerInteractionEvent,
	type ViewerLoadingThumbnail,
	type VectrealViewerProps
} from './vectreal-viewer'
export type { SrcLoadOptions, SrcModel } from './load-src'
export {
	default as AnimationControls,
	type AnimationControlsProps
} from './components/animation-controls'
export {
	default as CameraControls,
	type CameraControlsOption,
	type CameraControlsProps
} from './components/camera-controls'
export * from './components/scene'
export * from './components/info-popover'
