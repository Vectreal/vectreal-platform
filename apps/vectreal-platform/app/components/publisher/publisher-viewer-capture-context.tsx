import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useRef,
	type MutableRefObject,
	type PropsWithChildren
} from 'react'

import type {
	SceneCameraSnapshot,
	SceneCameraSnapshotCapture,
	SceneScreenshotCapture,
	SceneScreenshotOptions,
	ShadowBakeCapture,
	ShadowBakeResult,
	ViewerCommandExecutor
} from '@vctrl/viewer'

interface PublisherViewerCaptureContextValue {
	registerSceneScreenshotCapture: (
		capture: null | SceneScreenshotCapture
	) => void
	requestSceneScreenshot: (
		options?: SceneScreenshotOptions
	) => Promise<null | string>
	registerSceneCameraSnapshotCapture: (
		capture: null | SceneCameraSnapshotCapture
	) => void
	requestSceneCameraSnapshot: () => Promise<null | SceneCameraSnapshot>
	registerShadowBakeCapture: (capture: null | ShadowBakeCapture) => void
	requestShadowBake: () => Promise<null | ShadowBakeResult>
	registerCommandExecutor: (executor: null | ViewerCommandExecutor) => void
	commandExecutor: MutableRefObject<null | ViewerCommandExecutor>
}

const PublisherViewerCaptureContext =
	createContext<null | PublisherViewerCaptureContextValue>(null)

export function PublisherViewerCaptureProvider({
	children
}: PropsWithChildren) {
	const screenshotCaptureRef = useRef<null | SceneScreenshotCapture>(null)
	const cameraSnapshotCaptureRef = useRef<null | SceneCameraSnapshotCapture>(
		null
	)
	const commandExecutorRef = useRef<null | ViewerCommandExecutor>(null)

	const registerSceneScreenshotCapture = useCallback(
		(capture: null | SceneScreenshotCapture) => {
			screenshotCaptureRef.current = capture
		},
		[]
	)

	const requestSceneScreenshot = useCallback(
		async (options?: SceneScreenshotOptions): Promise<null | string> => {
			return screenshotCaptureRef.current
				? screenshotCaptureRef.current(options)
				: null
		},
		[]
	)

	const registerSceneCameraSnapshotCapture = useCallback(
		(capture: null | SceneCameraSnapshotCapture) => {
			cameraSnapshotCaptureRef.current = capture
		},
		[]
	)

	const requestSceneCameraSnapshot = useCallback(async () => {
		return cameraSnapshotCaptureRef.current
			? cameraSnapshotCaptureRef.current()
			: null
	}, [])

	const shadowBakeCaptureRef = useRef<null | ShadowBakeCapture>(null)

	const registerShadowBakeCapture = useCallback(
		(capture: null | ShadowBakeCapture) => {
			shadowBakeCaptureRef.current = capture
		},
		[]
	)

	const requestShadowBake = useCallback(async () => {
		return shadowBakeCaptureRef.current ? shadowBakeCaptureRef.current() : null
	}, [])

	const registerCommandExecutor = useCallback(
		(executor: null | ViewerCommandExecutor) => {
			commandExecutorRef.current = executor
		},
		[]
	)

	const value = useMemo<PublisherViewerCaptureContextValue>(
		() => ({
			registerSceneScreenshotCapture,
			requestSceneScreenshot,
			registerSceneCameraSnapshotCapture,
			requestSceneCameraSnapshot,
			registerShadowBakeCapture,
			requestShadowBake,
			registerCommandExecutor,
			commandExecutor: commandExecutorRef
		}),
		[
			registerSceneScreenshotCapture,
			requestSceneScreenshot,
			registerSceneCameraSnapshotCapture,
			requestSceneCameraSnapshot,
			registerShadowBakeCapture,
			requestShadowBake,
			registerCommandExecutor
		]
	)

	return (
		<PublisherViewerCaptureContext.Provider value={value}>
			{children}
		</PublisherViewerCaptureContext.Provider>
	)
}

export function usePublisherViewerCapture() {
	const context = useContext(PublisherViewerCaptureContext)

	if (!context) {
		throw new Error(
			'usePublisherViewerCapture must be used within PublisherViewerCaptureProvider'
		)
	}

	return context
}
