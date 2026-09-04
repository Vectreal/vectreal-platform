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
import { resolveNormalizedScale } from '@vctrl/core'
import {
	AnimationSettings,
	BoundsProps,
	CameraProps,
	ControlsProps,
	EnvironmentProps,
	HotspotDefinition,
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
	useMemo,
	useRef,
	useState
} from 'react'
import { AnimationClip, Box3, Object3D, Vector3 } from 'three'

import { AnimationControls, Canvas, Overlay } from './components'
import {
	SceneAnimation,
	SceneBounds,
	SceneCamera,
	SceneControls,
	SceneEnvironment,
	resolveHotspotCameraTargets,
	SceneHotspots,
	SceneModel,
	ScenePostProcessing,
	SceneShadows
} from './components/scene'
import { useAnimationRuntime } from './hooks/use-animation-runtime'
import { useViewerLoading } from './hooks/use-viewer-loading'

import type { HotspotPositionSetter } from './components/scene'
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

	/**
	 * Animation clips belonging to `model`, as parsed from the same glTF.
	 * Without these no animation runtime is mounted.
	 */
	animations?: AnimationClip[]

	/**
	 * Playback configuration for `animations`.
	 * Absent, or `enabled: false`, leaves the model on its rest pose.
	 */
	animationOptions?: AnimationSettings

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
	 * Point-of-interest hotspots to draw over the model, straight from
	 * `SceneSettings.hotspots`.
	 *
	 * Drawn in navigation-sequence order, and a sequenced hotspot carries its
	 * step number. A hotspot the author hid (`visible: false`) is never drawn,
	 * and neither is one marked `internalOnly` unless `showInternalHotspots`
	 * says this is an editing surface. Clicking a hotspot that names a
	 * `linkedCameraId` activates that camera.
	 */
	hotspots?: HotspotDefinition[]

	/**
	 * Overrides the hotspot marker fill. Any CSS colour.
	 *
	 * The default is a neutral white disc with dark ink, deliberately not the
	 * Vectreal accent: a marker sits on top of somebody's product, and a
	 * saturated one competes with the thing the scene exists to show. Pass a
	 * colour where the hotspots are meant to carry a brand rather than get out
	 * of the way.
	 *
	 * The ink stays dark whatever you pass, so a dark or saturated fill needs
	 * `--vctrl-hotspot-ink` overridden on the viewer container to keep the step
	 * numeral readable: white on `#18181b` navy is 1.8:1, against 18:1 for the
	 * default pale fill.
	 */
	hotspotColor?: string

	// --- Editor affordances ---
	// Editing-surface features (e.g. the publisher). Public/embedded viewers omit
	// these. See the package README for the slim-embed surface.

	/**
	 * When true, renders an in-scene draggable handle for aiming the shadow light.
	 * Intended for editing surfaces (e.g. the publisher), not public viewers.
	 */
	shadowLightEditable?: boolean

	/**
	 * When true, hotspots marked `internalOnly` are drawn as well. Intended for
	 * the publisher, where those hotspots are authored.
	 *
	 * Public and embedded surfaces leave this off. `internalOnly` is a
	 * visibility contract, and the published payload is already stripped of
	 * these server-side; this is the viewer's own half of it, which matters
	 * because a consumer of this package can hand it any settings object,
	 * including one that never passed through that redaction.
	 * Default: false.
	 */
	showInternalHotspots?: boolean

	/**
	 * When true, hotspots the author hid (`visible: false`) are drawn greyed, so
	 * they can be found and switched back on. Editing surfaces only.
	 *
	 * Changes no step number: a marker a visitor would not see is never numbered
	 * or counted, whichever of these flags drew it. Default: false.
	 */
	showHiddenHotspots?: boolean

	/**
	 * The hotspot to draw as the current one, with a selection ring. Neutral,
	 * never a brand colour - see `styles.css`.
	 */
	selectedHotspotId?: string | null

	/**
	 * Runs when a marker is clicked on a surface that selects rather than
	 * navigates. Passing it is what makes selection possible at all, and a marker
	 * that could do either selects: selecting is local and reversible, while
	 * activating a linked camera throws away the viewpoint the author was working
	 * from. A surface that wants the camera instead simply does not pass this.
	 */
	onHotspotSelect?: (id: string) => void

	/**
	 * Hands back a setter that moves a marker without moving the hotspot, or
	 * `null` on teardown - the same shape as `onCommandExecutorReady` and the
	 * capture callbacks beside it.
	 *
	 * A setter rather than a viewer command because a drag emits a position every
	 * frame and none of them may reach React: the command bus routes through
	 * state, so a `set_hotspot_position` command would re-render every marker
	 * sixty times a second, which is the whole cost this exists to avoid.
	 */
	onHotspotPositionSetterReady?: (setter: null | HotspotPositionSetter) => void

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
		animations,
		animationOptions,
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
		hotspots,
		hotspotColor,
		// Editor affordances
		shadowLightEditable,
		showInternalHotspots = false,
		showHiddenHotspots = false,
		selectedHotspotId = null,
		onHotspotSelect,
		onHotspotPositionSetterReady,
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
	const animation = useAnimationRuntime({
		animations,
		options: animationOptions,
		hasContent
	})

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

	const { forwardCommand: forwardAnimationCommand } = animation

	const executeViewerCommand = useCallback(
		(command: ViewerCommand) => {
			switch (command.type) {
				case 'activate_camera':
					cameraCommandExecutorRef.current?.execute(command)
					break
				case 'set_controls_enabled':
					setControlsEnabledOverride(command.enabled)
					break
				case 'set_auto_rotate':
					setAutoRotateOverride({
						enabled: command.enabled,
						speed: command.speed
					})
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
				case 'restart_animation':
				case 'seek_animation_clip':
				case 'set_animation_playing':
					forwardAnimationCommand(command)
					break
			}
		},
		[forwardAnimationCommand]
	)

	// A hotspot's linked camera goes through the same command path an external
	// `activate_camera` takes, so a hotspot click and a host calling the embed
	// API land on one implementation of "fly to this viewpoint".
	/*
	  A hotspot camera aims at its hotspot unless the author framed it by hand.

	  Applied here rather than baked into the saved settings, so it follows a
	  marker that moves, needs no migration for scenes already saved, and holds on
	  every surface rather than only where the publisher wrote it.
	*/
	/*
	  The model's pre-normalization diagonal, held here so `Center` can be told
	  when to measure again.

	  drei's `Center` reads its children's bounding box in a layout effect whose
	  dependencies do not include `children`, and `cacheKey` defaults to a
	  constant - so without a key it measures once on mount and never again. The
	  normalization scale lives on a group *inside* it, so toggling normalization
	  rescaled the model while the centering offset kept the pre-scale value, and
	  the model was left off-centre.

	  It also silently broke the publisher's hotspot re-anchor, which corrects a
	  marker by the ratio of the two scales. That correction is exact only while
	  the centering offset scales with the model (`c = S . c0`), which is to say
	  only while `Center` re-measures. Keying it here is what makes that true.

	  Measured here rather than taken from `SceneModel`'s callback, which reports
	  from an effect: routing it through state would leave the key one render
	  behind the scale `SceneModel` had already applied, and `bounds.fit()` - a
	  passive effect - would frame the model against the previous centering offset
	  on a model swap.

	  Keyed on `model` alone, exactly as `SceneModel` keys its own measurement, and
	  that is load-bearing rather than incidental. `Box3.setFromObject` does not
	  walk up to refresh ancestors, so it reads whatever scale the model is already
	  mounted under. Re-measuring when the normalization *options* change would
	  therefore measure an already-scaled model and derive a different scale from
	  the one `SceneModel` holds. The two agree today only because the sole control
	  toggles `enabled` - disabled resolves to 1 whatever the input, and enabling
	  happens from a scale of 1 - so a min/max control added later would break it
	  silently. Measuring once per model removes the coincidence.
	*/
	const rawDiagonal = useMemo(
		() =>
			model
				? new Box3().setFromObject(model).getSize(new Vector3()).length()
				: 0,
		[model]
	)

	const centerCacheKey = useMemo(
		() => resolveNormalizedScale(rawDiagonal, normalizationOptions),
		[rawDiagonal, normalizationOptions]
	)

	const aimedCameras = useMemo(
		() => resolveHotspotCameraTargets(cameraOptions?.cameras, hotspots),
		[cameraOptions?.cameras, hotspots]
	)

	const handleActivateHotspotCamera = useCallback(
		(cameraId: string) => {
			executeViewerCommand({ type: 'activate_camera', cameraId })
		},
		[executeViewerCommand]
	)

	const handleHotspotActivated = useCallback(
		(hotspotId: string, cameraId: string | null) => {
			onInteractionEvent?.({ type: 'hotspot_activated', hotspotId, cameraId })
		},
		[onInteractionEvent]
	)

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
	// AO is gated on shadows being enabled so toggling shadows off also tears
	// down the AO composer.
	const aoEnabled = shadowsEnabled && (shadowsOptions?.ao ?? false)
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
						animationControls={
							animation.showControls ? (
								<AnimationControls
									playing={animation.status.playing}
									complete={animation.status.complete}
									onToggle={animation.toggle}
									onRestart={animation.restart}
								/>
							) : null
						}
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
							<SceneEnvironment {...envOptions} />
							{/* <Perf /> */}
							{enablePostProcessing ? (
								<ScenePostProcessing
									ao={aoEnabled}
									aoIntensity={shadowsOptions?.aoIntensity}
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
									cameras={aimedCameras}
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
								{model && animations && animation.shouldMount && (
									<SceneAnimation
										model={model}
										animations={animations}
										options={animationOptions}
										onCommandExecutorReady={animation.registerExecutor}
										onInteractionEvent={onInteractionEvent}
										onPlaybackStatusChange={animation.setStatus}
									/>
								)}
								<Center top cacheKey={centerCacheKey}>
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
									normalizationOptions={normalizationOptions}
									{...shadowsOptions}
									isModelAnimating={animation.status.active}
									lightEditable={shadowLightEditable}
									onLightChange={onShadowLightChange}
									staticBake={staticShadowBake}
									bakedShadow={bakedShadow}
									onShadowBakeReady={onShadowBakeReady}
								/>
								<SceneHotspots
									hotspots={hotspots}
									model={model}
									includeInternal={showInternalHotspots}
									includeHidden={showHiddenHotspots}
									color={hotspotColor}
									selectedId={selectedHotspotId}
									onActivateCamera={handleActivateHotspotCamera}
									onSelect={onHotspotSelect}
									onHotspotActivated={handleHotspotActivated}
									onPositionSetterReady={onHotspotPositionSetterReady}
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
