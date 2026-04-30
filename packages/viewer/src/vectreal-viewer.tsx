/* vectreal-core | vctrl/viewer
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

import { Center } from '@react-three/drei'
import { LoadingSpinner as DefaultSpinner } from '@shared/components/ui/loading-spinner'
import { cn } from '@shared/utils'
import {
	BoundsProps,
	CameraProps,
	ControlsProps,
	EnvironmentProps,
	GridProps,
	ShadowsProps
} from '@vctrl/core'
// import { Perf } from 'r3f-perf'
import {
	memo,
	PropsWithChildren,
	Suspense,
	useCallback,
	useEffect,
	useRef,
	useState
} from 'react'
import { Object3D } from 'three'

import { Canvas, Overlay } from './components'
import {
	SceneBounds,
	SceneCamera,
	SceneControls,
	SceneEnvironment,
	SceneModel,
	ScenePostProcessing,
	SceneShadows
} from './components/scene'
import { useViewerLoading } from './hooks/use-viewer-loading'

import type {
	SceneCameraSnapshotCapture,
	SceneScreenshotCapture,
	ViewerCommand,
	ViewerCommandExecutor,
	ViewerInteractionEvent,
	ViewerLoadingThumbnail
} from './types/viewer-types'

export type {
	SceneCameraSnapshot,
	SceneCameraSnapshotCapture,
	SceneScreenshotCapture,
	SceneScreenshotOptions,
	ViewerCommandExecutor,
	ViewerCommand,
	ViewerInteractionEvent,
	ViewerLoadingThumbnail
} from './types/viewer-types'

export interface VectrealViewerProps extends PropsWithChildren {
	/**
	 * The 3D model to render in the viewer. (three.js `Object3D`)
	 */
	model?: Object3D

	/**
	 * An optional className to apply to the outermost container of the viewer.
	 */
	className?: string

	/**
	 * Theme for the viewer.
	 * - 'light': Force light theme
	 * - 'dark': Force dark theme
	 * - 'system': Use system preference (default)
	 */
	theme?: 'light' | 'dark' | 'system'

	/**
	 * Whether to render the canvas only when visible in viewport.
	 * Improves performance by not rendering off-screen scenes.
	 * Default: true
	 */
	enableViewportRendering?: boolean

	/**
	 * Whether to enable postprocessing effects.
	 * Disabling this can significantly reduce GPU usage.
	 * Default: true
	 */
	enablePostProcessing?: boolean

	/**
	 * Options for the scene bounds.
	 */
	boundsOptions?: BoundsProps

	/**
	 * Options for the scene cameras.
	 */
	cameraOptions?: CameraProps

	/**
	 * Options for the OrbitControls.
	 */
	controlsOptions?: ControlsProps

	/**
	 * Options for the react-three environment components with custom hdr map presets.
	 */
	envOptions?: EnvironmentProps

	/**
	 * Options for the shadows.
	 */
	shadowsOptions?: ShadowsProps

	/**
	 * Options for the grid.
	 */
	gridOptions?: GridProps

	/**
	 * Slot for the info popover component.
	 */
	popover?: React.ReactNode

	/**
	 * JSX element to render while the model is loading.
	 */
	loader?: React.ReactNode

	/**
	 * Optional thumbnail rendered as a blurred backdrop under the loader.
	 */
	loadingThumbnail?: ViewerLoadingThumbnail

	/**
	 * Callback function to handle screenshot generation (accept data URL via param).
	 */
	onScreenshot?: (dataUrl: string) => void

	/**
	 * Callback that receives a capture function capable of producing scene screenshots on demand.
	 */
	onScreenshotCaptureReady?: (capture: null | SceneScreenshotCapture) => void

	/**
	 * Callback that receives a function for capturing the current camera pose.
	 */
	onCameraSnapshotCaptureReady?: (
		capture: null | SceneCameraSnapshotCapture
	) => void

	/**
	 * Callback invoked when the viewer emits runtime interaction events.
	 */
	onInteractionEvent?: (event: ViewerInteractionEvent) => void

	/**
	 * Callback that receives a command executor for imperative viewer actions.
	 */
	onCommandExecutorReady?: (executor: null | ViewerCommandExecutor) => void
}

/**
 * A React component for rendering 3D models.
 *
 * This component is designed to be easily extensible and customizable. It uses the
 * `@react-three/drei` library to render the 3D scene.
 *
 * The component will render any provided children inside the canvas.
 *
 * See [The official docs]({@link https://vectreal.com/docs}) or the [vctrl/viewer README]({@link https://github.com/vectreal/vectreal-platform/blob/main/packages/viewer/README.md}) for more information.
 *
 * @example
 * import { VectrealViewer } from '@vctrl/viewer';
 *
 * const MyComponent = () => {
 *   return (
 *     <VectrealViewer
 *       model={model}
 *       controlsOptions={{ maxPolarAngle: Math.PI / 2 }}
 *     />
 *   );
 * };
 */
const VectrealViewer = memo(({ model, ...props }: VectrealViewerProps) => {
	const {
		className,
		children,
		theme = 'system',
		cameraOptions,
		boundsOptions,
		envOptions,
		// gridOptions,
		controlsOptions,
		shadowsOptions,
		popover,
		loadingThumbnail,
		onScreenshot,
		onScreenshotCaptureReady,
		onCameraSnapshotCaptureReady,
		onInteractionEvent,
		onCommandExecutorReady,
		enableViewportRendering = true,
		enablePostProcessing = true,
		loader = <DefaultSpinner />
	} = props

	const hasContent = !!(model || children)
	const [isInitialFramingComplete, setIsInitialFramingComplete] =
		useState(false)
	const [controlsEnabledOverride, setControlsEnabledOverride] = useState<
		null | boolean
	>(null)
	const cameraCommandExecutorRef = useRef<null | ViewerCommandExecutor>(null)

	useEffect(() => {
		if (!hasContent) {
			setIsInitialFramingComplete(false)
			setControlsEnabledOverride(null)
		}
	}, [hasContent])

	const handleInitialFramingComplete = useCallback(() => {
		setIsInitialFramingComplete(true)
	}, [])

	const executeViewerCommand = useCallback((command: ViewerCommand) => {
		switch (command.type) {
			case 'activate_camera':
				cameraCommandExecutorRef.current?.execute(command)
				break
			case 'set_controls_enabled':
				setControlsEnabledOverride(command.enabled)
				break
		}
	}, [])

	const handleSceneCameraExecutorReady = useCallback(
		(executor: null | ViewerCommandExecutor) => {
			cameraCommandExecutorRef.current = executor
		},
		[]
	)

	useEffect(() => {
		onCommandExecutorReady?.({ execute: executeViewerCommand })

		return () => {
			onCommandExecutorReady?.(null)
		}
	}, [executeViewerCommand, onCommandExecutorReady])

	const { loadingState, completeLoadingTransition } = useViewerLoading(
		hasContent,
		isInitialFramingComplete
	)
	const shadowsEnabled = shadowsOptions?.enabled ?? false
	return (
		<Suspense fallback={loader}>
			<Canvas
				frameloop="always"
				containerClassName={cn(
					'viewer vctrl-viewer h-full w-full overflow-clip font-[DM_Sans_Variable,sans-serif] text-base [&_a]:text-inherit [&_a]:no-underline [&_button]:border-0 [&_p]:m-0',
					className
				)}
				theme={theme}
				loadingState={loadingState}
				overlay={
					<Overlay
						loadingState={loadingState}
						onLoaderFadeOutComplete={completeLoadingTransition}
						popover={popover}
						loader={loader}
						loadingThumbnail={loadingThumbnail}
					/>
				}
				enableViewportRendering={enableViewportRendering}
				shadows={shadowsEnabled}
				gl={{ antialias: false, powerPreference: 'low-power' }}
			>
				<Suspense fallback={null}>
					{hasContent && (
						<>
							{/* <SceneGrid {...gridOptions} /> */}
							<SceneShadows {...shadowsOptions} />
							<SceneEnvironment {...envOptions} />
							{/* <Perf /> */}
							{enablePostProcessing ? <ScenePostProcessing /> : null}
							<SceneControls
								{...controlsOptions}
								enabledOverride={controlsEnabledOverride}
							/>
							{/* <SceneToneMapping
								mapping={toneMappingOptions?.mapping}
								exposure={toneMappingOptions?.exposure}
								/> */}
							<SceneBounds {...boundsOptions}>
								<SceneCamera
									{...cameraOptions}
									onCameraSnapshotCaptureReady={onCameraSnapshotCaptureReady}
									onCommandExecutorReady={handleSceneCameraExecutorReady}
									onInitialFramingComplete={handleInitialFramingComplete}
									onInteractionEvent={onInteractionEvent}
								/>
								<Center top>
									{model ? (
										<SceneModel
											onScreenshot={onScreenshot}
											onScreenshotCaptureReady={onScreenshotCaptureReady}
											object={model}
										/>
									) : (
										children
									)}
								</Center>
							</SceneBounds>
						</>
					)}
				</Suspense>
			</Canvas>
		</Suspense>
	)
})

VectrealViewer.displayName = 'VectrealViewer'

export default VectrealViewer
