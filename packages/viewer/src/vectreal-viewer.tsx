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
	AccumulativeShadowsProps,
	BoundsProps,
	CameraProps,
	ControlsProps,
	EnvironmentProps,
	GridProps,
	NormalizationOptions,
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
	BakedShadow,
	SceneCameraSnapshotCapture,
	SceneScreenshotCapture,
	ShadowBakeCapture,
	ViewerCommand,
	ViewerCommandExecutor,
	ViewerInteractionEvent,
	ViewerLoadingThumbnail
} from './types/viewer-types'

export type {
	BakedShadow,
	SceneCameraSnapshot,
	SceneCameraSnapshotCapture,
	SceneScreenshotCapture,
	SceneScreenshotOptions,
	ShadowBakeCapture,
	ShadowBakeResult,
	ViewerCommandExecutor,
	ViewerCommand,
	ViewerInteractionEvent,
	ViewerLoadingThumbnail
} from './types/viewer-types'

export interface VectrealViewerProps extends PropsWithChildren {
	// --- Content ---

	/**
	 * The 3D model to render in the viewer. (three.js `Object3D`)
	 */
	model?: Object3D

	// --- Container & appearance ---

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

	// --- Performance ---

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

	// --- Scene configuration ---

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
	 * Options for runtime model size normalization.
	 * Clamps the model's bounding-box diagonal to [minSize, maxSize].
	 * Does not modify the underlying model data.
	 */
	normalizationOptions?: NormalizationOptions

	/**
	 * Options for the grid.
	 */
	gridOptions?: GridProps

	// --- Editor affordances ---
	// Editing-surface features (e.g. the publisher). Public/embedded viewers omit
	// these. See the package README for the slim-embed surface.

	/**
	 * When true, renders an in-scene draggable handle for aiming the shadow light.
	 * Intended for editing surfaces (e.g. the publisher), not public viewers.
	 */
	shadowLightEditable?: boolean

	/**
	 * When true, the accumulative shadow bakes in a single pass on mount instead of
	 * fading in across frames, so it is present immediately when a scene opens.
	 * Intended for read-only/preview surfaces; the editor leaves this off to keep
	 * the smooth temporal fade-in while tweaking. Default: false.
	 */
	staticShadowBake?: boolean

	/**
	 * A persisted accumulative-shadow bake. When present and still valid for the
	 * current shadow settings + model, the viewer renders the stored texture and
	 * skips re-baking entirely (no recomputation on load).
	 */
	bakedShadow?: BakedShadow

	/**
	 * Receives a function that captures the settled shadow bake as a density PNG,
	 * for persistence. Intended for editing surfaces that save scenes.
	 */
	onShadowBakeReady?: (capture: ShadowBakeCapture | null) => void

	/**
	 * Called with a new shadow light position (model-size units) when the in-scene
	 * handle is dragged. Store this back into `shadowsOptions.light.position`.
	 */
	onShadowLightChange?: (position: [number, number, number]) => void

	// --- Slots ---

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

	// --- Callbacks & events ---

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

	/**
	 * Called with the raw (pre-normalization) bounding-box diagonal whenever the loaded model changes.
	 */
	onRawDiagonalComputed?: (diagonal: number) => void
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
		// Content
		children,
		// Container & appearance
		className,
		theme = 'system',
		// Performance
		enableViewportRendering = true,
		enablePostProcessing = true,
		// Scene configuration
		boundsOptions,
		cameraOptions,
		controlsOptions,
		envOptions,
		shadowsOptions,
		normalizationOptions,
		// gridOptions,
		// Editor affordances
		shadowLightEditable,
		staticShadowBake = false,
		bakedShadow,
		onShadowBakeReady,
		onShadowLightChange,
		// Slots
		popover,
		loadingThumbnail,
		loader = <DefaultSpinner />,
		// Callbacks & events
		onScreenshot,
		onScreenshotCaptureReady,
		onCameraSnapshotCaptureReady,
		onInteractionEvent,
		onCommandExecutorReady,
		onRawDiagonalComputed
	} = props

	const hasContent = !!(model || children)

	// Bounds-based camera framing is the fallback for scenes without saved camera positions.
	// Explicit boundsOptions.enable overrides this inference.
	const boundsEnabled =
		boundsOptions?.enable !== undefined
			? boundsOptions.enable
			: !cameraOptions?.cameras?.some((c) => c.position != null)
	const [isInitialFramingComplete, setIsInitialFramingComplete] =
		useState(false)
	const [controlsEnabledOverride, setControlsEnabledOverride] = useState<
		null | boolean
	>(null)
	const [autoRotateOverride, setAutoRotateOverride] = useState<{
		enabled: boolean
		speed?: number
	} | null>(null)
	const [controlsOptionsOverride, setControlsOptionsOverride] = useState<{
		zoom?: boolean
		pan?: boolean
	} | null>(null)
	const [transitionOverride, setTransitionOverride] = useState<
		CameraProps['sceneTransition'] | null
	>(null)
	const cameraCommandExecutorRef = useRef<null | ViewerCommandExecutor>(null)

	useEffect(() => {
		if (!hasContent) {
			setIsInitialFramingComplete(false)
			setControlsEnabledOverride(null)
			setAutoRotateOverride(null)
			setControlsOptionsOverride(null)
			setTransitionOverride(null)
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
			case 'set_auto_rotate':
				setAutoRotateOverride({ enabled: command.enabled, speed: command.speed })
				break
			case 'set_controls_options':
				setControlsOptionsOverride((prev) => ({ ...prev, ...command }))
				break
			case 'set_transition':
				setTransitionOverride({
					type: command.transitionType,
					duration: command.duration,
					easing: command.easing
				})
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
	// AO config lives on the accumulative shadow settings. It's gated on shadows
	// being enabled so toggling shadows off also tears down the AO composer.
	const accumulativeShadows =
		shadowsOptions?.type === 'accumulative' ? shadowsOptions : undefined
	const aoEnabled = shadowsEnabled && (accumulativeShadows?.ao ?? false)
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
				// 'percentage' = PCFShadowMap. AccumulativeShadows bakes its own soft
				// shadow from its RandomizedLight, so the realtime filter just needs to
				// be enabled. (A bare `shadows` would use the deprecated PCFSoftShadowMap.)
				shadows={shadowsEnabled ? 'percentage' : false}
				gl={{ antialias: false, powerPreference: 'low-power' }}
			>
				<Suspense fallback={null}>
					{hasContent && (
						<>
							{/* <SceneGrid {...gridOptions} /> */}
							<SceneEnvironment {...envOptions} />
							{/* <Perf /> */}
							{enablePostProcessing ? (
								<ScenePostProcessing
									ao={aoEnabled}
									aoIntensity={accumulativeShadows?.aoIntensity}
									model={model}
								/>
							) : null}
							<SceneControls
								{...controlsOptions}
								enabledOverride={controlsEnabledOverride}
								{...(autoRotateOverride !== null
									? {
											autoRotate: autoRotateOverride.enabled,
											autoRotateSpeed: autoRotateOverride.speed
										}
									: {})}
								{...(controlsOptionsOverride !== null
									? {
											enableZoom: controlsOptionsOverride.zoom,
											enablePan: controlsOptionsOverride.pan
										}
									: {})}
							/>
							{/* <SceneToneMapping
								mapping={toneMappingOptions?.mapping}
								exposure={toneMappingOptions?.exposure}
								/> */}
							<SceneBounds {...boundsOptions} enable={boundsEnabled}>
								<SceneCamera
									{...cameraOptions}
									sceneTransition={
										transitionOverride ?? cameraOptions?.sceneTransition
									}
									boundsEnabled={boundsEnabled}
									hasContent={hasContent}
									onCameraSnapshotCaptureReady={onCameraSnapshotCaptureReady}
									onCommandExecutorReady={handleSceneCameraExecutorReady}
									onInitialFramingComplete={handleInitialFramingComplete}
									onInteractionEvent={onInteractionEvent}
								/>
								<Center top>
									{model && (
										<SceneModel
											cameraOptions={cameraOptions}
											onScreenshot={onScreenshot}
											onScreenshotCaptureReady={onScreenshotCaptureReady}
											object={model}
											enableShadows={shadowsEnabled}
											normalizationOptions={normalizationOptions}
											onRawDiagonalComputed={onRawDiagonalComputed}
										/>
									)}
								</Center>
								<SceneShadows
									model={model}
									{...(shadowsOptions as Partial<AccumulativeShadowsProps>)}
									lightEditable={shadowLightEditable}
									onLightChange={onShadowLightChange}
									staticBake={staticShadowBake}
									bakedShadow={bakedShadow}
									onShadowBakeReady={onShadowBakeReady}
								/>
								{children}
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
