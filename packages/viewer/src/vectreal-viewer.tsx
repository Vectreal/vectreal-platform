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
import { resolveEnvironmentFiles, resolveNormalizedScale } from '@vctrl/core'
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
import { AnimationClip, Object3D } from 'three'

import {
	AnimationControls,
	Canvas,
	Overlay,
	SceneViewReturn
} from './components'
import {
	SceneAnimation,
	SceneBounds,
	SceneCamera,
	SceneControls,
	SceneEnvironment,
	resolveHotspotCameraTargets,
	resolveHotspotMarkers,
	SceneHotspots,
	SceneModel,
	ScenePostProcessing,
	SceneShadows
} from './components/scene'
import EnvironmentPrewarm from './components/scene/environment-prewarm'
import { useModelFrame, type ModelKey } from './components/scene/model-frame'
import { preloadEnvironmentFiles } from './components/scene/scene-environment'
import { useAnimationRuntime } from './hooks/use-animation-runtime'
import { useHeldExecutor } from './hooks/use-held-executor'
import { useSceneViewReturn } from './hooks/use-scene-view-return'
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
	 * Which model `model` renders, when the caller can say so. A new `model`
	 * under the same key is a new rendition of the same model, such as an
	 * optimization pass's output: the camera, the framing and the centering stay
	 * exactly where they are. A new key is a new model and is framed afresh.
	 * Defaults to the object's identity, so every new object counts as a new model.
	 */
	modelKey?: ModelKey

	/**
	 * Draws this object in place of `model` without changing what the scene is
	 * about: `model` stays mounted, hidden, and framing, normalization, shadow
	 * sizing, animation and hotspots keep reading it, so swapping this in and out
	 * leaves all of them as they were. Shadows are cast by what is drawn. Used to
	 * show another rendition of the same model for a moment, such as the
	 * original beside an optimized result. The displayed object is not animated:
	 * playback stays bound to `model`.
	 */
	displayedModel?: Object3D

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
	 * Whether the viewer renders through its composer: ambient occlusion, and
	 * supersampling that converges while the camera is still, after which a
	 * still viewer draws nothing until something changes. Disable it to render
	 * the scene directly with hardware MSAA, for instance when `children` bring
	 * their own `EffectComposer`. Whether the canvas itself is multisampled is
	 * fixed when it is created, from this prop's value at that time.
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
	/**
	 * Whether the hotspot markers are drawn at all. Default true.
	 *
	 * For a host page that navigates the scene itself, from the hotspots the
	 * embed handshake reports. The hotspots stay resolved either way, so
	 * `focus_hotspot` still flies a camera by id with nothing drawn on the
	 * model - which is the combination that host needs, and which suppressing
	 * them by passing no `hotspots` would not give.
	 */
	showHotspotMarkers?: boolean
	/**
	 * Whether a marker opens a card of its own. Default true.
	 *
	 * False still activates: the camera flies and `hotspot_activated` is
	 * emitted, so a host drawing its own panel gets the event without the viewer
	 * drawing a second copy of the same text over the model.
	 */
	revealHotspotContent?: boolean
	/**
	 * Whether the viewer draws its way back from a hotspot's camera. Default true.
	 *
	 * While the view stands at a camera a hotspot flew it to, a "Back to scene
	 * view" control is drawn, and Escape inside the viewer does the same: both
	 * return to the scene camera the visitor was on before, or the scene's
	 * default when there was none. Turn it off only where something else
	 * offers the way back - a host's own control can send
	 * `return_to_scene_view`, which works either way.
	 */
	showSceneViewReturn?: boolean

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
		modelKey,
		displayedModel,
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
		showHotspotMarkers,
		revealHotspotContent,
		showSceneViewReturn = true,
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

	// Prefetched as soon as a surface says which environment it wants, which
	// can be long before there is content to light: the map is otherwise only
	// requested once the model has loaded and the scene mounts. A surface that
	// has not decided yet prefetches nothing rather than the default.
	const environmentFiles = envOptions
		? resolveEnvironmentFiles(envOptions)
		: null
	const environmentFilesKey = environmentFiles && String(environmentFiles)
	useEffect(() => {
		if (environmentFiles) preloadEnvironmentFiles(environmentFiles)
	}, [environmentFilesKey])

	// Bounds-based camera framing is the fallback for scenes without saved camera positions.
	// Explicit boundsOptions.enable overrides this inference.
	const boundsEnabled =
		boundsOptions?.enable !== undefined
			? boundsOptions.enable
			: !cameraOptions?.cameras?.some((c) => c.position != null)
	const [isInitialFramingComplete, setIsInitialFramingComplete] =
		useState(false)
	// Latched on the first compile: a later model swap keeps the previous frame
	// up while it compiles, and must not bring the loader back.
	const [areShadersReady, setAreShadersReady] = useState(false)
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
	const cameraLayer = useHeldExecutor()
	const hotspotLayer = useHeldExecutor()
	const animation = useAnimationRuntime({
		animations,
		options: animationOptions,
		hasContent
	})

	useEffect(() => {
		if (!hasContent) {
			setIsInitialFramingComplete(false)
			setAreShadersReady(false)
			setControlsEnabledOverride(null)
			setAutoRotateOverride(null)
			setControlsOptionsOverride(null)
			setTransitionOverride(null)
		}
	}, [hasContent])

	const handleInitialFramingComplete = useCallback(() => {
		setIsInitialFramingComplete(true)
	}, [])

	const handleShadersReady = useCallback(() => {
		setAreShadersReady(true)
	}, [])

	const { forwardCommand: forwardAnimationCommand } = animation

	// Filled in below, once the camera state it reads exists. A ref keeps the
	// command executor's identity independent of every camera change.
	const returnToSceneViewRef = useRef<() => boolean>(() => false)

	const executeViewerCommand = useCallback(
		(command: ViewerCommand) => {
			switch (command.type) {
				case 'activate_camera':
					cameraLayer.execute(command)
					break
				case 'focus_hotspot':
					hotspotLayer.execute(command)
					break
				case 'return_to_scene_view':
					returnToSceneViewRef.current()
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
		[cameraLayer, forwardAnimationCommand, hotspotLayer]
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

	  Measured once per model through `useModelFrame`, the same rule `SceneModel`
	  uses with the same key, and that is load-bearing rather than incidental.
	  `Box3.setFromObject` does not walk up to refresh ancestors, so it reads
	  whatever scale the model is already mounted under. Re-measuring when the
	  normalization *options* change would therefore measure an already-scaled
	  model and derive a different scale from the one `SceneModel` holds; so would
	  re-measuring a new rendition of the same model, whose bounds an optimization
	  pass can nudge. One measurement per model removes both.
	*/
	const rawDiagonal = useModelFrame(model, modelKey)?.rawDiagonal ?? 0

	const centerCacheKey = useMemo(
		() => resolveNormalizedScale(rawDiagonal, normalizationOptions),
		[rawDiagonal, normalizationOptions]
	)

	const aimedCameras = useMemo(
		() => resolveHotspotCameraTargets(cameraOptions?.cameras, hotspots),
		[cameraOptions?.cameras, hotspots]
	)

	/**
	 * Which camera the viewer is looking through, so the hotspot that owns it
	 * can draw itself as the one you are standing at.
	 *
	 * Taken from the event the camera layer already emits rather than from
	 * `cameraOptions.activeCameraId`, because that prop is the opening request,
	 * not the running state - a marker click, a host command and an interaction
	 * all move the camera without touching it.
	 */
	const [activeCameraId, setActiveCameraId] = useState<null | string>(null)

	// The markers this surface draws, by the same rule `SceneHotspots` draws
	// them, so a hidden or internal hotspot's camera is never a hotspot view.
	const hotspotMarkers = useMemo(
		() =>
			resolveHotspotMarkers(hotspots, {
				includeInternal: showInternalHotspots,
				includeHidden: showHiddenHotspots
			}),
		[hotspots, showInternalHotspots, showHiddenHotspots]
	)

	const activateCamera = useCallback(
		(cameraId: string) =>
			cameraLayer.execute({ type: 'activate_camera', cameraId }),
		[cameraLayer]
	)

	const sceneViewReturn = useSceneViewReturn({
		cameras: cameraOptions?.cameras,
		hotspots,
		markers: hotspotMarkers,
		activeCameraId,
		activateCamera
	})
	const { noteCamera, returnToSceneView } = sceneViewReturn
	returnToSceneViewRef.current = returnToSceneView

	const handleInteractionEvent = useCallback(
		(event: ViewerInteractionEvent) => {
			if (event.type === 'camera_changed') {
				setActiveCameraId(event.cameraId)
				noteCamera(event.cameraId)
			} else if (event.type === 'initial_framing_completed') {
				setActiveCameraId(event.cameraId)
				noteCamera(event.cameraId)
			}
			onInteractionEvent?.(event)
		},
		[noteCamera, onInteractionEvent]
	)

	/**
	 * Escape inside the viewer leaves a hotspot's camera, like the control.
	 *
	 * A native listener on the container, so it hears only keys pressed while
	 * focus is inside this viewer and a host page keeps its own Escape. An open
	 * hotspot card claims the key first: its handler stops propagation inside
	 * drei's own React root, below this container, so the first Escape closes
	 * the card and the second leaves the view.
	 */
	const [container, setContainer] = useState<HTMLDivElement | null>(null)

	useEffect(() => {
		if (!container || !showSceneViewReturn) return

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || event.defaultPrevented) return
			// An open dialog inside the viewer (the info popover) owns Escape;
			// its listener sits on the document, after this one.
			if (
				event.target instanceof Element &&
				event.target.closest('[role="dialog"]')
			) {
				return
			}
			if (returnToSceneViewRef.current()) event.preventDefault()
		}

		container.addEventListener('keydown', handleKeyDown)
		return () => container.removeEventListener('keydown', handleKeyDown)
	}, [container, showSceneViewReturn])

	const handleActivateHotspotCamera = useCallback(
		(cameraId: string) => {
			executeViewerCommand({ type: 'activate_camera', cameraId })
		},
		[executeViewerCommand]
	)

	const handleHotspotActivated = useCallback(
		(hotspotId: string, cameraId: string | null) => {
			// Through the funnel, not straight out to the prop. Everything the
			// viewer needs to notice about an interaction is noticed in one place -
			// `activeCameraId` is tracked there today - and a second path out
			// would be the shape that reintroduces the split this replaced.
			// Harmless for this event, which carries no camera state; the next
			// event added is the one that would pick the wrong path.
			handleInteractionEvent({
				type: 'hotspot_activated',
				hotspotId,
				cameraId
			})
		},
		[handleInteractionEvent]
	)

	useEffect(() => {
		onCommandExecutorReady?.({ execute: executeViewerCommand })

		return () => {
			onCommandExecutorReady?.(null)
		}
	}, [executeViewerCommand, onCommandExecutorReady])

	// Without the composer nothing compiles ahead of the first frame, so there
	// is nothing to wait for.
	const { loadingState, completeLoadingTransition } = useViewerLoading(
		hasContent,
		isInitialFramingComplete && (areShadersReady || !enablePostProcessing),
		Boolean(loader)
	)
	const shadowsEnabled = shadowsOptions?.enabled ?? false
	// AO is gated on shadows being enabled so toggling shadows off also turns
	// AO off.
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
				onContainerChange={setContainer}
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
						sceneViewReturn={
							showSceneViewReturn ? (
								<SceneViewReturn
									hotspotName={sceneViewReturn.hotspot?.name ?? null}
									onReturn={returnToSceneView}
									focusOnLeave={container}
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
				// The composer antialiases inside its own buffers and presents a
				// full-screen quad, so a multisampled canvas would only cost memory
				// (four samples of color and depth at full size). Without the composer
				// the renderer draws the scene straight to the canvas and needs it.
				// Read once, when the context is created.
				gl={{
					antialias: !enablePostProcessing,
					powerPreference: 'low-power'
				}}
			>
				<EnvironmentPrewarm files={environmentFiles} />
				<Suspense fallback={null}>
					{hasContent && (
						<>
							<SceneEnvironment {...envOptions} />
							{/* <Perf /> */}
							<ScenePostProcessing
								enabled={enablePostProcessing}
								ao={aoEnabled}
								aoIntensity={shadowsOptions?.aoIntensity}
								aoAtRest={shadowsOptions?.aoAtRest}
								model={model}
								active={animation.status.active}
								onShadersReady={handleShadersReady}
							/>
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
									onCommandExecutorReady={cameraLayer.register}
									onInitialFramingComplete={handleInitialFramingComplete}
									onInteractionEvent={handleInteractionEvent}
								/>
								{model && animations && animation.shouldMount && (
									<SceneAnimation
										model={model}
										animations={animations}
										options={animationOptions}
										onCommandExecutorReady={animation.registerExecutor}
										onInteractionEvent={handleInteractionEvent}
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
											displayedObject={displayedModel}
											modelKey={modelKey}
											enableShadows={shadowsEnabled}
											normalizationOptions={normalizationOptions}
											onRawDiagonalComputed={onRawDiagonalComputed}
										/>
									)}
								</Center>
								<SceneShadows
									model={model}
									displayedModel={displayedModel}
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
									showMarkers={showHotspotMarkers}
									revealContent={revealHotspotContent}
									selectedId={selectedHotspotId}
									activeCameraId={activeCameraId}
									onActivateCamera={handleActivateHotspotCamera}
									onSelect={onHotspotSelect}
									onHotspotActivated={handleHotspotActivated}
									onCommandExecutorReady={hotspotLayer.register}
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
