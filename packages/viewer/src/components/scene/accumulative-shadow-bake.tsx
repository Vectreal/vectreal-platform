import { useFrame, useThree } from '@react-three/fiber'
import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState
} from 'react'
import {
	Color,
	type Group,
	type Mesh,
	ShaderMaterial,
	type Texture
} from 'three'

import { ProgressiveLightMap } from './progressive-light-map'
import { measureLitBrightness } from './shadow-bake'
import { calibratedAlphaTest } from './shadow-cutoff-calibration'
import { createSeededRandom, jitterLightPositions } from './shadow-light-jitter'

/**
 * Seed for the light jitter. Fixed, and reset on every restart, so the same
 * scene and settings always bake the same shadow: renders and thumbnails are
 * reproducible, and a restarted bake matches the one it replaces.
 */
const BAKE_SEED = 0x5eed

/** What `SceneShadows` reads from a live bake. */
export interface ShadowBakeApi {
	/** True once every frame has accumulated and the cutoff is calibrated. */
	readonly settled: boolean
	/** The accumulated light map, as of the last frame. */
	readonly texture: Texture
	/** The cutoff the plane draws with (the calibrated one once settled). */
	readonly cutoff: number
	/** Re-snapshots the scene and bakes again, e.g. for a newly drawn object. */
	restart: () => void
}

interface BakeLight {
	amount: number
	/** Jitter box width around `position`; the penumbra softness. */
	radius: number
	/** Fraction of samples spread over the hemisphere; the shadow fill. */
	ambient: number
	intensity: number
	position: [number, number, number]
	bias: number
	/** Half-extent of each light's orthographic shadow camera. */
	size: number
	near: number
	far: number
	mapSize: number
}

interface AccumulativeShadowBakeProps {
	/** Accumulate one frame per rendered frame, or every frame at once. */
	temporal: boolean
	frames: number
	/** Cutoff used while a temporal bake ramps in, and if calibration reads nothing. */
	alphaTest: number
	/** Manual trim on the calibrated cutoff (1 = pure auto, <1 deeper, >1 lighter). */
	cutoffScale: number
	opacity: number
	/** Side length of the ground plane, in world units. */
	scale: number
	resolution: number
	colorBlend: number
	color: string
	light: BakeLight
}

// drei's SoftShadowMaterial (MIT, pmndrs/drei). `cutoff` is a brightness
// divisor, not a discard threshold: the shadow alpha is
// `max(0, 1 - brightness / cutoff)`, so a cutoff at the lit-plane brightness
// makes lit areas exactly transparent.
const SOFT_SHADOW_VERTEX = /* glsl */ `
	varying vec2 vUv;
	void main() {
		gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
		vUv = uv;
	}
`

const SOFT_SHADOW_FRAGMENT = /* glsl */ `
	varying vec2 vUv;
	uniform sampler2D map;
	uniform vec3 color;
	uniform float opacity;
	uniform float cutoff;
	uniform float blend;
	void main() {
		vec4 light = texture2D(map, vUv);
		float brightness = light.r + light.g + light.b;
		gl_FragColor = vec4(color * light.r * blend, max(0.0, 1.0 - brightness / cutoff) * opacity);
		#include <tonemapping_fragment>
		#include <colorspace_fragment>
	}
`

const createSoftShadowMaterial = () =>
	new ShaderMaterial({
		uniforms: {
			map: { value: null },
			color: { value: new Color() },
			opacity: { value: 0 },
			cutoff: { value: 0 },
			blend: { value: 2 }
		},
		vertexShader: SOFT_SHADOW_VERTEX,
		fragmentShader: SOFT_SHADOW_FRAGMENT,
		transparent: true,
		depthWrite: false
	})

/** Averaging window for an accumulation of `frames` frames. */
const blendFor = (frames: number) => Math.max(2, frames)

/**
 * A soft ground shadow baked by accumulating many jittered light samples into a
 * light map, the technique of drei's `AccumulativeShadows`, owned here so the
 * viewer controls its lifecycle:
 *
 * - it bakes when a bake input changes, never because a parent re-rendered;
 * - it knows when the bake has settled, in both modes, and calibrates the
 *   cutoff as the bake's last step;
 * - its jitter is seeded, so the same inputs give the same shadow;
 * - it disposes its render targets on unmount.
 */
const AccumulativeShadowBake = forwardRef<
	ShadowBakeApi,
	AccumulativeShadowBakeProps
>((props, ref) => {
	const { temporal, frames, alphaTest, cutoffScale, opacity, scale, light } =
		props
	const gl = useThree((state) => state.gl)
	const scene = useThree((state) => state.scene)
	const camera = useThree((state) => state.camera)
	const invalidate = useThree((state) => state.invalidate)
	const planeRef = useRef<Mesh>(null)
	const lightsRef = useRef<Group>(null)

	const lightMap = useMemo(
		() => new ProgressiveLightMap(gl, scene, props.resolution),
		[gl, scene, props.resolution]
	)
	useEffect(() => () => lightMap.dispose(), [lightMap])

	const [material] = useState(createSoftShadowMaterial)
	useEffect(() => () => material.dispose(), [material])

	// Everything the bake reads, current as of the last render, so the bake
	// steps below never go stale and never re-run because a closure changed.
	const live = useRef({ props, gl, camera, invalidate, lightMap })
	live.current = { props, gl, camera, invalidate, lightMap }

	// The bake itself: one instance per mount, every step reading `live`.
	const [bake] = useState(() => {
		const state = {
			count: 0,
			settled: false,
			random: createSeededRandom(BAKE_SEED),
			// Lit-plane brightness of the settled bake, null until measured.
			litBrightness: null as number | null
		}
		const uniforms = material.uniforms

		const accumulate = (frameCount: number) => {
			const plane = planeRef.current
			const lights = lightsRef.current
			if (!plane || !lights) return
			const { props: current, camera: view, lightMap: map } = live.current
			lights.visible = true
			map.prepare()
			for (let frame = 0; frame < frameCount; frame++) {
				const positions = jitterLightPositions(state.random, current.light)
				lights.children.forEach((child, i) =>
					child.position.set(...positions[i])
				)
				map.update(plane, view, blendFor(current.frames))
			}
			lights.visible = false
			map.finish()
			uniforms.map.value = map.texture
		}

		const applyCutoff = () => {
			const { alphaTest: fallback, cutoffScale: trim } = live.current.props
			uniforms.cutoff.value =
				state.litBrightness === null
					? fallback
					: (calibratedAlphaTest(state.litBrightness, trim) ?? fallback)
		}

		const calibrate = () => {
			const { gl: renderer, lightMap: map, props: current } = live.current
			state.litBrightness = measureLitBrightness(renderer, map.texture)
			applyCutoff()
			uniforms.opacity.value = current.opacity
			state.settled = true
			live.current.invalidate()
		}

		const restart = () => {
			const lights = lightsRef.current
			if (!lights) return
			const { props: current, lightMap: map } = live.current
			map.clear(lights)
			state.random = createSeededRandom(BAKE_SEED)
			state.count = 0
			state.settled = false
			state.litBrightness = null
			uniforms.opacity.value = 0
			uniforms.cutoff.value = 0
			uniforms.map.value = map.texture
			if (!current.temporal) {
				accumulate(current.frames)
				calibrate()
				return
			}
			live.current.invalidate()
		}

		/** One temporal step: ramp the plane in and accumulate one frame. */
		const step = () => {
			const { props: current, invalidate: requestFrame } = live.current
			if (!current.temporal || state.settled) return
			const blend = blendFor(current.frames)
			uniforms.opacity.value = Math.min(
				current.opacity,
				uniforms.opacity.value + current.opacity / blend
			)
			uniforms.cutoff.value = Math.min(
				current.alphaTest,
				uniforms.cutoff.value + current.alphaTest / blend
			)
			accumulate(1)
			state.count++
			if (state.count >= current.frames) calibrate()
			else requestFrame()
		}

		/** A new trim or opacity, applied to the settled bake without re-baking. */
		const retune = () => {
			if (!state.settled) return
			applyCutoff()
			uniforms.opacity.value = live.current.props.opacity
			live.current.invalidate()
		}

		const api: ShadowBakeApi = {
			get settled() {
				return state.settled
			},
			get texture() {
				return live.current.lightMap.texture
			},
			get cutoff() {
				return uniforms.cutoff.value as number
			},
			restart
		}
		return { api, restart, step, retune }
	})

	useImperativeHandle(ref, () => bake.api, [bake])

	// Applied live: recoloring or tinting never needs a re-bake.
	useEffect(() => {
		material.uniforms.color.value.set(props.color)
		material.uniforms.blend.value = props.colorBlend
		invalidate()
	}, [material, props.color, props.colorBlend, invalidate])

	// Bake again whenever a bake input changes. A layout effect, so a static
	// bake is complete before the first frame that shows it; the lights' new
	// props are already applied by then, since child commits land first.
	const [px, py, pz] = light.position
	useLayoutEffect(() => {
		bake.restart()
	}, [
		bake,
		lightMap,
		temporal,
		frames,
		scale,
		light.amount,
		light.radius,
		light.ambient,
		light.intensity,
		px,
		py,
		pz,
		light.bias,
		light.size,
		light.near,
		light.far,
		light.mapSize
	])

	useEffect(() => {
		bake.retune()
	}, [bake, cutoffScale, alphaTest, opacity])

	useFrame(() => bake.step())

	return (
		<group>
			<group ref={lightsRef} visible={false}>
				{Array.from({ length: light.amount }, (_, index) => (
					<directionalLight
						key={index}
						castShadow
						shadow-bias={light.bias}
						shadow-mapSize={[light.mapSize, light.mapSize]}
						intensity={light.intensity / light.amount}
					>
						<orthographicCamera
							attach="shadow-camera"
							args={[
								-light.size,
								light.size,
								light.size,
								-light.size,
								light.near,
								light.far
							]}
						/>
					</directionalLight>
				))}
			</group>
			<mesh
				ref={planeRef}
				receiveShadow
				scale={scale}
				rotation={[-Math.PI / 2, 0, 0]}
				material={material}
			>
				<planeGeometry />
			</mesh>
		</group>
	)
})

AccumulativeShadowBake.displayName = 'AccumulativeShadowBake'

export default AccumulativeShadowBake
