import {
	AccumulativeShadows,
	ContactShadows,
	RandomizedLight
} from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { AccumulativeShadowsProps } from '@vctrl/core'
import {
	type ComponentRef,
	memo,
	type RefObject,
	Suspense,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react'
import { Box3, Mesh, Object3D, type Texture, Vector3 } from 'three'

import SceneBakedShadow from './scene-baked-shadow'
import ShadowAutoCutoff from './shadow-auto-cutoff'
import {
	captureShadowDensity,
	computeBakeSignature,
	computeModelFingerprint
} from './shadow-bake'
import ShadowLightGizmo from './shadow-light-gizmo'

import type { BakedShadow, ShadowBakeCapture } from '../../types/viewer-types'

// Accumulative shadows: high-quality baked soft shadows for a static subject.
// The shadow is baked into the receiving plane's UV space from the
// RandomizedLight, independent of the camera, so camera auto-rotate (which
// orbits the camera, not the model) keeps the bake valid while rotating. The
// RandomizedLight only feeds the bake and does not light the rest of the scene.
//
// The numeric controls below are expressed RELATIVE to the model's measured
// size (see `contentScale`): the plane scale and light radius are multiples of
// the model's largest dimension, and the light position is in model-size units.
// This keeps the bake correctly proportioned for any model — the shadow geometry
// is otherwise fixed in world units while model normalization is off by default,
// so a small model would cast a shadow far too tiny to survive the alpha cutoff.
export const defaultShadowsOptions: AccumulativeShadowsProps = {
	type: 'accumulative',
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
	// Manual trim on the auto-calibrated cutoff (see ShadowAutoCutoff). 1 = auto.
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

// The rendered variant is chosen by `isModelAnimating`, not the stored `type`,
// and the app normalizes any stored config to a valid accumulative one before it
// reaches here, so all fields are optional.
type SceneShadowsProps = Partial<AccumulativeShadowsProps> & {
	/**
	 * The loaded model. Used only to measure the subject's world-space size so the
	 * bake can be proportioned to it.
	 */
	model?: Object3D
	/**
	 * Set while the loaded model's geometry is actively animating. Camera
	 * auto-rotate keeps the model static and must NOT set this. When true the
	 * viewer renders cheaper contact shadows that track the moving geometry.
	 */
	isModelAnimating?: boolean
	/**
	 * When true, renders an in-scene draggable handle for aiming the shadow light.
	 */
	lightEditable?: boolean
	/**
	 * When true, the accumulative shadow bakes in a single synchronous pass on
	 * mount (drei `temporal={false}`) instead of fading in across frames. Intended
	 * for read-only/preview contexts so the shadow is present immediately rather
	 * than building up every time a scene opens. The editor keeps the temporal
	 * fade-in for responsive tweaking.
	 */
	staticBake?: boolean
	/**
	 * Called with a new light position in MODEL-SIZE units when the handle is
	 * dragged (i.e. ready to store back into `light.position`).
	 */
	onLightChange?: (position: [number, number, number]) => void
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
}

const DEFAULT_METRICS: ModelMetrics = {
	footprint: 1,
	radius: 1,
	height: 1,
	vertexCount: 0,
	measured: false
}

/**
 * Measures the model's world-space bounds so shadow parameters can be sized to
 * the subject (model normalization is off by default, so models arrive at
 * arbitrary scales). Footprint and bounding radius are tracked separately,
 * mirroring how model-viewer / Sketchfab frame ground shadows to the bounding
 * box: the plane follows the horizontal footprint, while the light distance and
 * shadow camera follow the overall size. Using one shared max-dimension instead
 * makes the shadow read too small under tall models and too large under flat
 * ones. Returns unit metrics until measured.
 */
const useModelMetrics = (model?: Object3D): ModelMetrics => {
	const [metrics, setMetrics] = useState<ModelMetrics>(DEFAULT_METRICS)

	useEffect(() => {
		if (!model) return
		// Bake ancestor transforms (model normalization scale, Center offset) into
		// the world matrices before measuring.
		model.updateWorldMatrix(true, true)
		const size = new Box3().setFromObject(model).getSize(new Vector3())
		const footprint = Math.max(size.x, size.z)
		const radius = 0.5 * Math.hypot(size.x, size.y, size.z)
		if (footprint > 0 && radius > 0 && Number.isFinite(radius)) {
			setMetrics({
				footprint,
				radius,
				height: size.y,
				vertexCount: computeModelFingerprint(model),
				measured: true
			})
		}
	}, [model])

	return metrics
}

interface ShadowBakeCaptureProps {
	apiRef: RefObject<ComponentRef<typeof AccumulativeShadows> | null>
	signature: string
	resolution: number
	onReady?: (capture: ShadowBakeCapture | null) => void
}

/**
 * Exposes a function that reads the settled accumulative-shadow bake into a
 * density PNG (see captureShadowDensity), tagged with the current bake signature.
 * The app calls it on save to persist the bake. Registered/cleared the same way
 * as the screenshot capture. Returns null until the bake has settled.
 */
const ShadowBakeCapture = ({
	apiRef,
	signature,
	resolution,
	onReady
}: ShadowBakeCaptureProps) => {
	const gl = useThree((state) => state.gl)
	// Keep the latest signature without re-registering the capture each bake.
	const signatureRef = useRef(signature)
	signatureRef.current = signature

	useEffect(() => {
		if (!onReady) return
		const capture: ShadowBakeCapture = async () => {
			const api = apiRef.current
			// Only a fully accumulated bake is worth persisting.
			if (!api || api.count < api.frames) return null
			const mesh = api.getMesh() as Mesh & {
				material: { map?: Texture | null; alphaTest: number }
			}
			const map = mesh?.material?.map
			const alphaTest = mesh?.material?.alphaTest
			if (!map || alphaTest == null) return null
			const dataUrl = captureShadowDensity(gl, map, alphaTest, resolution)
			if (!dataUrl) return null
			return { dataUrl, signature: signatureRef.current }
		}
		onReady(capture)
		return () => onReady(null)
	}, [gl, apiRef, resolution, onReady])

	return null
}

/**
 * Adaptive scene shadows: accumulative (baked, high quality) for a static
 * subject, contact (cheaper, live) while the model animates.
 *
 * Both drei shadow components render on the default `useFrame` priority and do
 * not take over the render loop — r3f's automatic `gl.render` still runs, so the
 * scene (and the baked shadow plane) draws normally. ContactShadows clears its
 * own render target each frame as long as `gl.autoClear` is at its default
 * (`true`); nothing here forces it off.
 */
const SceneShadows = memo(
	({
		model,
		isModelAnimating = false,
		lightEditable = false,
		onLightChange,
		staticBake = false,
		bakedShadow,
		onShadowBakeReady,
		...props
	}: SceneShadowsProps) => {
		const { footprint, radius, height, vertexCount, measured } =
			useModelMetrics(model)
		const apiRef = useRef<React.ComponentRef<typeof AccumulativeShadows> | null>(
			null
		)
		// While the light handle is dragged, bake a coarse, fast preview so the
		// shadow tracks the light, then settle to full quality on release.
		const [previewing, setPreviewing] = useState(false)

		// Merge incoming params over the defaults (defaults fill any gaps). The app
		// normalizes stored shadow settings to a valid accumulative config before
		// they reach here, so the props are trusted directly.
		const options = {
			...defaultShadowsOptions,
			...props,
			enabled: props.enabled ?? defaultShadowsOptions.enabled,
			light: {
				...defaultShadowsOptions.light,
				...props.light
			},
			contact: {
				...defaultShadowsOptions.contact,
				...props.contact
			}
		}

		// Resolve the relative controls to world units for the current model. The
		// plane and penumbra follow the horizontal footprint; the light distance and
		// shadow camera follow the bounding radius so the light always clears the
		// model regardless of its aspect ratio.
		const planeScale =
			(options.scale ?? defaultShadowsOptions.scale!) * footprint
		const lightRadius =
			(options.light.radius ?? defaultShadowsOptions.light!.radius!) * footprint
		// Source array is stable (it comes from the stored config / a constant), so
		// memoizing keeps the resolved world-space position referentially stable
		// across re-renders that don't actually move the light.
		const lightPositionSource =
			options.light.position ?? defaultShadowsOptions.light!.position!
		const lightPosition = useMemo(
			() =>
				lightPositionSource.map((axis) => axis * radius) as [
					number,
					number,
					number
				],
			[lightPositionSource, radius]
		)

		const frames = previewing
			? Math.min(PREVIEW_FRAMES, options.frames ?? PREVIEW_FRAMES)
			: options.frames

		// In a read-only/preview context, bake in one synchronous pass on mount so
		// the shadow is present immediately instead of building up over many frames
		// (drei bakes all frames in a layout effect when temporal is off). The editor
		// keeps the temporal fade-in so live tweaks don't hard-hitch.
		const temporal = staticBake ? false : options.temporal

		// Memoize the bake subtree. drei's AccumulativeShadows resets and re-bakes in
		// a layout effect that has NO dependency array, so it re-bakes on every one
		// of its renders. Re-rendering SceneShadows for an unrelated reason — chiefly
		// toggling `lightEditable` when the shadow tool opens, which mounts the light
		// gizmo — would therefore wipe and rebuild the bake. Keeping the element
		// referentially stable (it only changes when a real bake input changes) makes
		// React skip re-rendering AccumulativeShadows, so the bake survives.
		const bake = useMemo(
			() => (
				<AccumulativeShadows
					ref={apiRef}
					temporal={temporal}
					frames={frames}
					alphaTest={options.alphaTest}
					opacity={options.opacity}
					scale={planeScale}
					resolution={options.resolution}
					colorBlend={options.colorBlend}
					color={options.color}
				>
					<RandomizedLight
						castShadow
						amount={options.light.amount}
						radius={lightRadius}
						ambient={options.light.ambient}
						intensity={options.light.intensity}
						position={lightPosition}
						bias={options.light.bias}
						size={SHADOW_CAMERA_SIZE_FACTOR * radius}
						mapSize={1024}
						// Scale the shadow camera depth range to the model. drei's fixed
						// near=0.5 clips the model out of the shadow map when the light is
						// dragged close; a small relative near (with a generous far) keeps
						// the model inside the frustum at any light distance.
						near={radius * 0.02}
						far={radius * 25}
					/>
				</AccumulativeShadows>
			),
			[
				temporal,
				frames,
				options.alphaTest,
				options.opacity,
				planeScale,
				options.resolution,
				options.colorBlend,
				options.color,
				options.light.amount,
				options.light.ambient,
				options.light.intensity,
				options.light.bias,
				lightPosition,
				lightRadius,
				radius
			]
		)

		// Soft contact/ground shadow under the directional bake. Memoized for the
		// same reason as the bake (drei ContactShadows also re-bakes on re-render),
		// so opening the shadow tool / moving the gizmo doesn't rebuild it.
		//
		// `far` is the depth camera's capture height: only geometry between the floor
		// and `far` darkens, weighted by how close it is to the floor. A SMALL far
		// (low `reach`) compresses that gradient into a thin near-ground band, so the
		// falloff between touching and slightly-raised geometry is steep — true
		// contact AO (only wheels/underbelly), not a uniform silhouette pool. A small
		// floor keeps the camera from degenerating on near-flat models.
		const contactShadow = useMemo(() => {
			if (!options.contact.enabled) return null
			const reach = options.contact.reach ?? defaultShadowsOptions.contact!.reach!
			return (
				<ContactShadows
					frames={1}
					scale={
						(options.contact.scale ?? defaultShadowsOptions.contact!.scale!) *
						footprint
					}
					far={Math.max(reach * height, radius * 0.03)}
					blur={options.contact.blur ?? defaultShadowsOptions.contact!.blur!}
					opacity={
						options.contact.opacity ?? defaultShadowsOptions.contact!.opacity!
					}
					resolution={1024}
					color={options.color ?? '#000000'}
					// Sit just below the accumulative plane so the directional cast reads
					// on top of the ground pool.
					position={[0, -radius * 0.002, 0]}
				/>
			)
		}, [
			options.contact.enabled,
			options.contact.scale,
			options.contact.blur,
			options.contact.opacity,
			options.contact.reach,
			options.color,
			footprint,
			height,
			radius
		])

		// Signature of the current bake inputs. A persisted bake is reused only while
		// it still matches; any change to the light/frames/scale/model re-bakes live
		// (and the next save re-persists). Uses `options.frames` (the full count, not
		// the drag-preview reduction).
		const bakeSignature = computeBakeSignature(
			{
				light: options.light,
				frames: options.frames,
				scale: options.scale,
				resolution: options.resolution
			},
			footprint,
			radius,
			vertexCount
		)
		// Use the persisted bake when one exists and either the model isn't measured
		// yet (render it optimistically rather than spawn the expensive live bake we
		// are trying to avoid) or its signature still matches the measured inputs.
		const usePersistedBake = Boolean(
			bakedShadow && (!measured || bakedShadow.signature === bakeSignature)
		)

		if (!options.enabled) return null

		if (isModelAnimating) {
			return (
				<ContactShadows
					opacity={options.opacity ?? defaultContactFallback.opacity}
					scale={(options.scale ?? defaultContactFallback.scale) * footprint}
					color={options.color ?? defaultContactFallback.color}
					blur={defaultContactFallback.blur}
					far={defaultContactFallback.far * radius}
				/>
			)
		}

		return (
			<>
				{contactShadow}

				{usePersistedBake && bakedShadow ? (
					// Load-time fast path: render the stored bake, no recomputation.
					<Suspense fallback={null}>
						<SceneBakedShadow
							url={bakedShadow.url}
							planeScale={planeScale}
							opacity={options.opacity ?? defaultShadowsOptions.opacity!}
							color={options.color ?? '#000000'}
						/>
					</Suspense>
				) : (
					<>
						{bake}

						<ShadowAutoCutoff
							apiRef={apiRef}
							cutoffScale={options.cutoffScale ?? 1}
							temporal={temporal ?? true}
						/>

						{onShadowBakeReady && (
							<ShadowBakeCapture
								apiRef={apiRef}
								signature={bakeSignature}
								resolution={options.resolution ?? defaultShadowsOptions.resolution!}
								onReady={onShadowBakeReady}
							/>
						)}
					</>
				)}

				{lightEditable && onLightChange && (
					<ShadowLightGizmo
						position={lightPosition}
						minDistance={radius * 1.3}
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
