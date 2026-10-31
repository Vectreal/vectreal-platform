import { ContactShadows } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { resolveLighting } from '@vctrl/core'
import {
	Fragment,
	memo,
	type RefObject,
	Suspense,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState
} from 'react'
import { Object3D, Vector3 } from 'three'

import LoadFailureBoundary from '../load-failure-boundary'
import AccumulativeShadowBake, {
	type ShadowBakeApi
} from './accumulative-shadow-bake'
import {
	type ClipExtent,
	type ClipExtentRegistry,
	useClipExtents
} from './clip-planes'
import { measureModel, worldBounds } from './model-measurement'
import SceneBakedShadow from './scene-baked-shadow'
import {
	groundBakeInputs,
	groundBakeSources,
	LIGHT_DISTANCE_FACTOR,
	lightDirection,
	litLights
} from './scene-lighting'
import {
	captureShadowDensity,
	computeBakeSignature,
	isPersistedBakeValid,
	PERSISTED_BAKE_RESOLUTION
} from './shadow-bake'
import ShadowLightGizmo from './shadow-light-gizmo'

import type { BakedShadow, ShadowBakeCapture } from '../../types/viewer-types'
import type {
	BakeBasis,
	NormalizationOptions,
	ResolvedLighting,
	ShadowsProps
} from '@vctrl/core'

/**
 * What this viewer filled in for a legacy `shadowsOptions` field left out.
 * Nothing here reads it any more: legacy shadows reach the viewer through
 * `resolveLighting`, whose `LEGACY_LIGHTING_DEFAULTS` must stay equal to it
 * (the app's `viewer-defaults.spec.ts` checks), and it is still exported for
 * integrations that spread it into `shadowsOptions`.
 *
 * @deprecated Use `lighting` and `resolveLighting` from `@vctrl/core`.
 */
export const defaultShadowsOptions: ShadowsProps = {
	enabled: false,
	// Spread the bake across frames so it fades in smoothly rather than hitching
	// the first frame. Fewer frames settle faster (quicker to appear, more
	// responsive when the light moves) at a small cost in penumbra smoothness,
	// which the radius jitter largely hides.
	temporal: true,
	frames: 48,
	// NOT a discard threshold — in drei's SoftShadowMaterial the shadow alpha is
	// `max(0, 1 - planeBrightness / alphaTest) * opacity`. The bake plane is a
	// Lambert surface lit by the scene Environment, so its summed brightness sits
	// at ~1.75 in shadow and ~4.0 when fully lit (measured, studio-natural env at
	// environmentIntensity 1). alphaTest must sit between those: just below the
	// lit value so lit areas stay transparent, but well above the shadow value so
	// the shadow core gets real alpha. Fixed just below the lit brightness; shadow
	// depth is driven by light.ambient ("Darkness") rather than alphaTest.
	alphaTest: 3.0,
	// Manual trim on the auto-calibrated cutoff (see AccumulativeShadowBake). 1 = auto.
	cutoffScale: 1,
	opacity: 0.9,
	// Ground plane side length, in multiples of the model's footprint. Kept tight
	// so the shadow fills more of the fixed-resolution lightmap (a larger plane
	// spreads the same texels thinner and the shadow reads pixelated).
	scale: 2.5,
	resolution: 1024,
	colorBlend: 2,
	color: '#000000',
	// Screen-space crevice occlusion (N8AO). Opt-in: real-time SSAO runs every
	// rendered frame and adds GPU cost, so the default is the zero-idle-cost baked
	// shadow only (see scene-postprocessing.tsx).
	ao: false,
	aoIntensity: 1.4,
	// Draw AO only once the view is still. Off: AO staying put while orbiting
	// reads better than it dropping out and settling back in.
	aoAtRest: false,
	// Soft contact/ground shadow under the directional bake (drei ContactShadows),
	// approximating ground ambient occlusion. Baked once. Opt-in; tuned via blur
	// (softness) and opacity (darkness).
	contact: {
		enabled: false,
		opacity: 0.6,
		blur: 3,
		scale: 1.5,
		reach: 0.35
	},
	light: {
		// Bright bake light so the lit plane is well above the Environment's
		// ambient floor, widening the window in which the shadow reads (see
		// alphaTest note above). drei divides this by `amount` per sub-light.
		intensity: Math.PI * 2,
		// Number of jittered light samples accumulated into the bake.
		amount: 8,
		// Positional jitter of the light, in model-size units — the penumbra
		// softness.
		radius: 0.8,
		// Hemisphere fill fraction. Lower = less fill under the model = darker
		// shadow core. Surfaced in the UI as "Darkness".
		ambient: 0.3,
		// Light direction/distance, in model-size units (target is the model base).
		// Default is straight overhead so the initial shadow is minimal and tucked
		// under the model; presets and the in-scene handle move it off-axis.
		position: [0, 2.5, 0],
		bias: 0.001
	}
}

// Shadow-camera orthographic half-extent, in model-size units. Kept tight to the
// model so the directional shadow map spends its resolution on the subject (a
// looser frustum makes the cast read blocky).
const SHADOW_CAMERA_SIZE_FACTOR = 1.2

// Frame count used while the light handle is being dragged — a fast, coarse bake
// that settles in a few frames so the shadow visibly follows the light, then
// snaps back to the full frame count on release.
const PREVIEW_FRAMES = 12

// Cheaper contact shadows, used only while a model is actively animating (the
// baked accumulative shadow would otherwise lag the moving geometry). `scale` is
// a multiple of the model size; blur/far are in world units (resolved per model).
const defaultContactFallback = {
	opacity: 0.5,
	scale: 4,
	blur: 2.4,
	far: 10,
	color: '#000000'
}

/*
  The ground bake's quality. Not settings: what a shadow looks like follows
  from the lights, and these only decide how faithfully it is drawn. The plane
  is a multiple of the model's footprint: wide enough for a low light's long
  shadow to fade out before the plane's edge, tight enough that the shadow
  still fills a fair share of the fixed-resolution light map.
*/
const GROUND_BAKE = {
	frames: 48,
	scale: 4,
	resolution: 1024,
	// The cutoff a temporal bake ramps toward before calibration replaces it;
	// see `defaultShadowsOptions.alphaTest`.
	alphaTest: 3,
	colorBlend: 2,
	amount: 8,
	intensity: Math.PI * 2,
	bias: 0.001
}

/**
 * Either the scene's resolved lighting or, as before it, shadow settings,
 * which are resolved into lighting here.
 */
type SceneShadowsProps = SceneShadowsOwnProps &
	Partial<Omit<ShadowsProps, keyof SceneShadowsOwnProps>>

interface SceneShadowsOwnProps {
	/** The scene's lighting, resolved; its lights cast the ground's shadow. */
	lighting?: ResolvedLighting
	/**
	 * The loaded model. Used only to measure the subject's world-space size so the
	 * bake can be proportioned to it.
	 */
	model?: Object3D
	/**
	 * The viewer's `displayedModel`: drawn in place of `model`, so a live bake
	 * still accumulating meanwhile takes its frames from that object.
	 */
	displayedModel?: Object3D
	/**
	 * Model normalization, which rescales the model via an ancestor group.
	 *
	 * Read only to know when to re-measure: the scale lives on a group above the
	 * model, so toggling it changes the model's world size without changing the
	 * `model` object itself, and nothing else here would notice.
	 */
	normalizationOptions?: NormalizationOptions
	/**
	 * Set while the loaded model's geometry is actively animating. Camera
	 * auto-rotate keeps the model static and must NOT set this. When true the
	 * viewer renders cheaper contact shadows that track the moving geometry.
	 */
	isModelAnimating?: boolean
	/**
	 * When true, renders an in-scene draggable handle for aiming the key light.
	 */
	lightEditable?: boolean
	/**
	 * When true, the bake runs in a single synchronous pass on mount instead of
	 * fading in across frames. Intended for read-only/preview contexts so the
	 * shadow is present immediately rather than building up every time a scene
	 * opens. The editor keeps the temporal fade-in for responsive tweaking.
	 */
	staticBake?: boolean
	/**
	 * Called with the key light's new position, in units of the model's bounding
	 * radius, when the handle is dragged: the legacy `shadows.light.position`.
	 */
	onLightChange?: (position: [number, number, number]) => void
	/**
	 * Where the shadow ground and the light handle register their extents, so
	 * the camera's clip planes contain them.
	 */
	clipExtents?: ClipExtentRegistry
	/**
	 * A persisted shadow bake. When present and its signature still matches the
	 * current bake inputs, the viewer renders the stored texture and skips the
	 * accumulative bake entirely (no recomputation on load).
	 */
	bakedShadow?: BakedShadow
	/**
	 * Receives a function that captures the settled bake as a density PNG (for
	 * persistence). Intended for editing surfaces that save scenes.
	 */
	onShadowBakeReady?: (capture: ShadowBakeCapture | null) => void
}

interface ModelMetrics {
	/** Largest horizontal (X/Z) extent — what the ground shadow plane is sized to. */
	footprint: number
	/** Bounding-sphere radius — what the light distance / shadow camera scale to. */
	radius: number
	/** Vertical (Y) extent — sizes the contact shadow's capture depth. */
	height: number
	/** Total vertex count — part of the persisted-bake fingerprint. */
	vertexCount: number
	/** False until the model has actually been measured (values are real, not defaults). */
	measured: boolean
	/**
	 * True once these figures are final: the model was measured, could not be
	 * (no geometry), or there is no model and the subject is the viewer's
	 * children. A live bake waits for this rather than `measured`.
	 */
	sized: boolean
}

const DEFAULT_METRICS: ModelMetrics = {
	footprint: 1,
	radius: 1,
	height: 1,
	vertexCount: 0,
	measured: false,
	sized: false
}

/**
 * Measures the model's world-space bounds so shadow parameters can be sized to
 * the subject (model normalization is off by default, so models arrive at
 * arbitrary scales). Footprint and bounding radius are tracked separately,
 * mirroring how model-viewer / Sketchfab frame ground shadows to the bounding
 * box: the plane follows the horizontal footprint, while the light distance and
 * shadow camera follow the overall size. Using one shared max-dimension instead
 * makes the shadow read too small under tall models and too large under flat
 * ones. Returns unit metrics until the first model is measured. Right after a
 * swap it keeps the previous model's figures, so a stored bake's plane holds
 * its size, but marks them unmeasured and unsized, so nothing reads them as
 * this model's.
 */
export const useModelMetrics = (
	model?: Object3D,
	normalizationOptions?: NormalizationOptions
): ModelMetrics => {
	const [measurement, setMeasurement] = useState<{
		model: Object3D
		metrics: ModelMetrics
	} | null>(null)

	const normalizationEnabled = normalizationOptions?.enabled ?? false
	const normalizationMinSize = normalizationOptions?.minSize
	const normalizationMaxSize = normalizationOptions?.maxSize

	useEffect(() => {
		if (!model) return
		// World size, so after the normalization scale applied above the model.
		const size = worldBounds(model).getSize(new Vector3())
		const footprint = Math.max(size.x, size.z)
		const radius = 0.5 * Math.hypot(size.x, size.y, size.z)
		const measurable = footprint > 0 && radius > 0 && Number.isFinite(radius)
		setMeasurement({
			model,
			metrics: measurable
				? {
						footprint,
						radius,
						height: size.y,
						vertexCount: measureModel(model).vertexCount,
						measured: true,
						sized: true
					}
				: { ...DEFAULT_METRICS, sized: true }
		})
		// Normalization is a dependency because it rescales the model from an
		// ancestor group: the object identity is unchanged, but every figure
		// derived here (plane size, light distance, shadow-camera extent, and the
		// bake signature built from them) is in model-size units and goes stale.
	}, [model, normalizationEnabled, normalizationMinSize, normalizationMaxSize])

	if (!model) return { ...DEFAULT_METRICS, sized: true }
	if (!measurement) return DEFAULT_METRICS
	return measurement.model === model
		? measurement.metrics
		: { ...measurement.metrics, measured: false, sized: false }
}

interface ShadowBakeCaptureProps {
	apiRef: RefObject<ShadowBakeApi | null>
	/** Signature of the live bake inputs, measured on the loaded model. */
	signature: string
	/** The loaded model's measurements, which {@link signature} is computed from. */
	basis: BakeBasis
	/** The persisted bake being rendered instead of a live one, if any. */
	persistedBake?: BakedShadow
	onReady?: (capture: ShadowBakeCapture | null) => void
}

/**
 * Exposes a function that reports the bake state at save time, so persistence is
 * always fresh and never churns:
 * - persisted bake still valid for the current inputs → `{ signature, dataUrl: null }`
 *   (keep the stored asset, no re-upload),
 * - a live bake has settled → `{ signature, dataUrl }` (a fresh density PNG to
 *   persist; see captureShadowDensity),
 * - nothing settled / no accumulative shadow → `null`.
 *
 * Mounted unconditionally (in both the persisted and live branches) so a save can
 * confirm the persisted bake is current; registered/cleared like the screenshot
 * capture. Reusing the stored asset when inputs are unchanged is what avoids a
 * new upload every save.
 */
const ShadowBakeCapture = ({
	apiRef,
	signature,
	basis,
	persistedBake,
	onReady
}: ShadowBakeCaptureProps) => {
	const gl = useThree((state) => state.gl)
	// Keep the latest values without re-registering the capture each render.
	const liveRef = useRef({ signature, basis })
	liveRef.current = { signature, basis }
	const persistedBakeRef = useRef(persistedBake)
	persistedBakeRef.current = persistedBake

	useEffect(() => {
		if (!onReady) return
		const capture: ShadowBakeCapture = async () => {
			// Persisted bake is already valid for the current inputs: keep it, with
			// the basis it was validated against.
			const persisted = persistedBakeRef.current
			if (persisted) {
				return persisted.basis
					? {
							dataUrl: null,
							signature: persisted.signature,
							basis: persisted.basis
						}
					: { dataUrl: null, ...liveRef.current }
			}
			const api = apiRef.current
			// Only a settled live bake, calibrated cutoff included, is worth
			// persisting.
			if (!api?.settled) return null
			const dataUrl = captureShadowDensity(
				gl,
				api.texture,
				api.cutoff,
				PERSISTED_BAKE_RESOLUTION
			)
			if (!dataUrl) return null
			return { dataUrl, ...liveRef.current }
		}
		onReady(capture)
		return () => onReady(null)
	}, [gl, apiRef, onReady])

	return null
}

/**
 * The ground under the model and the shadows the scene's lights cast on it.
 *
 * Baked into the plane's UV space from jittered samples of every light, and of
 * the environment's hemisphere, independent of the camera: camera auto-rotate
 * orbits the camera, not the model, and keeps the bake valid. While the model
 * animates, a cheaper live contact shadow tracks the moving geometry instead.
 *
 * The bake renders on the default `useFrame` priority and does not take over
 * the render loop, so r3f's automatic `gl.render` still draws the scene and
 * the baked plane.
 */
const SceneShadows = memo(
	({
		lighting: resolvedLighting,
		model,
		displayedModel,
		normalizationOptions,
		isModelAnimating = false,
		lightEditable = false,
		onLightChange,
		staticBake = false,
		bakedShadow,
		onShadowBakeReady,
		clipExtents,
		...legacyShadows
	}: SceneShadowsProps) => {
		// Shadow settings from before `lighting`, as a caller composing the
		// scene components passes them; keyed by value, since a caller spreads
		// them fresh on every render.
		const legacyKey = resolvedLighting ? '' : JSON.stringify(legacyShadows)
		const lighting = useMemo(
			() =>
				resolvedLighting ??
				resolveLighting({ shadows: legacyShadows as ShadowsProps }),
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[resolvedLighting, legacyKey]
		)
		const { footprint, radius, vertexCount, measured, sized } = useModelMetrics(
			model,
			normalizationOptions
		)
		const apiRef = useRef<ShadowBakeApi | null>(null)
		// While the light handle is dragged, bake a coarse, fast preview so the
		// shadow tracks the light, then settle to full quality on release.
		const [previewing, setPreviewing] = useState(false)

		const enabled = lighting.ground.enabled
		const rotation = lighting.environment.rotation
		// Keyed on the lights' values, not the resolved array, which is built
		// fresh by every resolve: an unrelated re-render must not re-bake.
		const lights = litLights(lighting)
		const bakeInputs = groundBakeInputs(lights)
		const bakeKey = JSON.stringify(bakeInputs)
		const bakeLights = useMemo(
			() => bakeInputs,
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[bakeKey]
		)
		const ground = useMemo(
			() => groundBakeSources(bakeLights, rotation, radius),
			[bakeLights, rotation, radius]
		)

		const planeScale = GROUND_BAKE.scale * footprint
		const frames = previewing ? PREVIEW_FRAMES : GROUND_BAKE.frames
		// In a read-only/preview context, bake in one synchronous pass on mount so
		// the shadow is present immediately instead of building up over many frames.
		// The editor keeps the temporal fade-in so live tweaks don't hard-hitch.
		const temporal = !staticBake

		// Memoized so its identity changes only with a bake input: the hold effect
		// below watches it to learn that the bake changed during a hold.
		const bake = useMemo(
			() => (
				<AccumulativeShadowBake
					ref={apiRef}
					temporal={temporal}
					frames={frames}
					alphaTest={GROUND_BAKE.alphaTest}
					cutoffScale={1}
					// Darkness comes from the lights' share of all the light alone.
					opacity={1}
					scale={planeScale}
					resolution={GROUND_BAKE.resolution}
					colorBlend={GROUND_BAKE.colorBlend}
					color="#000000"
					light={{
						amount: GROUND_BAKE.amount,
						sources: ground.sources,
						ambient: ground.ambient,
						distance: ground.distance,
						intensity: GROUND_BAKE.intensity,
						bias: GROUND_BAKE.bias,
						size: SHADOW_CAMERA_SIZE_FACTOR * radius,
						mapSize: 1024,
						// Scale the shadow camera depth range to the model. A fixed near
						// clips the model out of the shadow map when the light is dragged
						// close; a small relative near (with a generous far) keeps the
						// model inside the frustum at any light distance.
						near: radius * 0.02,
						far: radius * 25
					}}
				/>
			),
			[temporal, frames, planeScale, ground, radius]
		)

		// The ground the shadows are drawn on: a square centered under the model,
		// as wide as the widest shadow plane drawn. It reaches well past the
		// model, so the clip planes have to know about it.
		const animatingScale = defaultContactFallback.scale * footprint
		const groundScale = isModelAnimating ? animatingScale : planeScale
		const groundExtent = useMemo<ClipExtent[] | null>(() => {
			if (!enabled) return null
			const half = groundScale / 2
			return [
				{
					kind: 'polygon',
					corners: [
						new Vector3(-half, 0, -half),
						new Vector3(half, 0, -half),
						new Vector3(half, 0, half),
						new Vector3(-half, 0, half)
					]
				}
			]
		}, [enabled, groundScale])
		useClipExtents(clipExtents, groundExtent)

		// The bake inputs a signature covers. A persisted bake is reused only while
		// it still matches; any change to a light, the rotation or the model
		// re-bakes live (and the next save re-persists). Uses the full frame
		// count, not the drag-preview reduction.
		const bakeOptions = useMemo(
			() => ({
				lights: bakeLights,
				rotation,
				frames: GROUND_BAKE.frames,
				scale: GROUND_BAKE.scale,
				resolution: GROUND_BAKE.resolution
			}),
			[bakeLights, rotation]
		)
		const bakeBasis = useMemo(
			() => ({ footprint, radius, vertexCount }),
			[footprint, radius, vertexCount]
		)
		const bakeSignature = useMemo(
			() => computeBakeSignature(bakeOptions, footprint, radius, vertexCount),
			[bakeOptions, footprint, radius, vertexCount]
		)
		const usePersistedBake = useMemo(
			() =>
				Boolean(
					bakedShadow &&
					isPersistedBakeValid(bakedShadow, bakeOptions, {
						...bakeBasis,
						measured
					})
				),
			[bakedShadow, bakeOptions, bakeBasis, measured]
		)
		// A stored bake whose image failed to load gives way to a live bake.
		const [failedBakeUrl, setFailedBakeUrl] = useState<string | null>(null)
		const showsPersistedBake =
			usePersistedBake && bakedShadow?.url !== failedBakeUrl

		// Every live shadow pass captures the meshes drawn when it starts: the
		// bake snapshots them on restart. So while the viewer draws another
		// object, a bake that has not settled starts over on it, and once the
		// model is drawn again the bake starts over on the model unless it had
		// settled before the hold. Restarting reuses the bake's render targets,
		// so the bake remounts only when it changed during the hold. A layout
		// effect, so no frame renders between the swap and the restart.
		const [shadowGeneration, setShadowGeneration] = useState(0)
		const holdRef = useRef<{
			settledBake: ShadowBakeApi | null
			passesChanged: boolean
		} | null>(null)
		useLayoutEffect(() => {
			const api = apiRef.current
			if (displayedModel) {
				const settled = api === null || api.settled
				// Drawing one object after another keeps the first one's record.
				holdRef.current ??= {
					settledBake: settled ? api : null,
					passesChanged: false
				}
				if (api && !settled) api.restart()
				return
			}
			const hold = holdRef.current
			holdRef.current = null
			if (!hold) return
			if (hold.passesChanged)
				setShadowGeneration((generation) => generation + 1)
			else if (api && api !== hold.settledBake) api.restart()
		}, [displayedModel])
		// Declared after the hold effect, so a pass that changes in the commit a
		// hold starts in is still recorded.
		useLayoutEffect(() => {
			if (holdRef.current) holdRef.current.passesChanged = true
		}, [enabled, isModelAnimating, showsPersistedBake, sized, bake])

		// The handle aims the key light, or the first light there is.
		const handleLight =
			lights.find((light) => light.role === 'key') ?? lights[0]
		const handlePosition = useMemo(
			() =>
				handleLight
					? (lightDirection(handleLight, rotation).map(
							(axis) => axis * LIGHT_DISTANCE_FACTOR * radius
						) as [number, number, number])
					: null,
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[handleLight?.azimuth, handleLight?.elevation, rotation, radius]
		)

		if (!enabled) return null

		if (isModelAnimating) {
			return (
				<ContactShadows
					// As dark as ground every light is blocked from.
					opacity={1 - ground.blockedShare}
					scale={animatingScale}
					color={defaultContactFallback.color}
					blur={defaultContactFallback.blur}
					far={defaultContactFallback.far * radius}
				/>
			)
		}

		return (
			<>
				<Fragment key={shadowGeneration}>
					{showsPersistedBake && bakedShadow ? (
						// Load-time fast path: render the stored bake, no recomputation.
						<LoadFailureBoundary
							key={bakedShadow.url}
							onError={() => setFailedBakeUrl(bakedShadow.url)}
						>
							<Suspense fallback={null}>
								<SceneBakedShadow
									url={bakedShadow.url}
									planeScale={planeScale}
									opacity={1}
									color="#000000"
								/>
							</Suspense>
						</LoadFailureBoundary>
					) : sized ? (
						// Not before: the bake runs on mount, so a bake sized from the
						// placeholder metrics is thrown away when the real ones land.
						// A static bake blocks the main thread for its whole length.
						bake
					) : null}
				</Fragment>

				{/* Mounted in both branches so a save can either persist a fresh live
				    bake or confirm the stored one is still valid (avoiding re-upload). */}
				{onShadowBakeReady && (
					<ShadowBakeCapture
						apiRef={apiRef}
						signature={bakeSignature}
						basis={bakeBasis}
						persistedBake={showsPersistedBake ? bakedShadow : undefined}
						onReady={onShadowBakeReady}
					/>
				)}

				{lightEditable && onLightChange && handlePosition && (
					<ShadowLightGizmo
						position={handlePosition}
						minDistance={radius * 1.3}
						clipExtents={clipExtents}
						onDragStart={() => setPreviewing(true)}
						onDragEnd={() => setPreviewing(false)}
						onChange={(worldPosition) =>
							onLightChange(
								worldPosition.map((axis) => axis / radius) as [
									number,
									number,
									number
								]
							)
						}
					/>
				)}
			</>
		)
	}
)

SceneShadows.displayName = 'SceneShadows'

export default SceneShadows
