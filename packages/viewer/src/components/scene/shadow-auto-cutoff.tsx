import { AccumulativeShadows } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type ComponentRef, type RefObject } from 'react'
import {
	FloatType,
	Mesh,
	MeshBasicMaterial,
	OrthographicCamera,
	PlaneGeometry,
	Scene,
	Texture,
	WebGLRenderTarget,
	type WebGLRenderer
} from 'three'

type AccumulativeApi = ComponentRef<typeof AccumulativeShadows>

// alphaTest is clamped to this safe band so a degenerate measurement can never
// blow out the plane or erase the shadow entirely.
const ALPHA_TEST_MIN = 1.0
const ALPHA_TEST_MAX = 6.0

// Lightmap UVs sampled for the LIT brightness. The model's shadow sits at the
// center, so these edge/corner points read the fully-lit plane; the max across
// them is taken so a sample that happens to land in penumbra can't drag the
// estimate down.
const LIT_SAMPLES: ReadonlyArray<readonly [number, number]> = [
	[0.04, 0.04],
	[0.96, 0.96],
	[0.96, 0.04],
	[0.04, 0.96],
	[0.5, 0.04],
	[0.04, 0.5]
]

const READBACK_RES = 32

/**
 * Measures the maximum (lit) brightness of the baked lightmap by drawing it to a
 * small float target and reading back a few edge samples. Values are linear: the
 * basic material is untonemapped and the target is float, so the readback is the
 * raw accumulated irradiance.
 */
const measureLitBrightness = (gl: WebGLRenderer, map: Texture): number => {
	const target = new WebGLRenderTarget(READBACK_RES, READBACK_RES, {
		type: FloatType
	})
	const scene = new Scene()
	const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
	const material = new MeshBasicMaterial({ map, toneMapped: false })
	const quad = new Mesh(new PlaneGeometry(2, 2), material)
	scene.add(quad)

	const previous = gl.getRenderTarget()
	gl.setRenderTarget(target)
	gl.render(scene, camera)
	const pixels = new Float32Array(READBACK_RES * READBACK_RES * 4)
	gl.readRenderTargetPixels(target, 0, 0, READBACK_RES, READBACK_RES, pixels)
	gl.setRenderTarget(previous)

	let maxSum = 0
	for (const [u, v] of LIT_SAMPLES) {
		const x = Math.floor(u * (READBACK_RES - 1))
		const y = Math.floor(v * (READBACK_RES - 1))
		const i = (y * READBACK_RES + x) * 4
		maxSum = Math.max(maxSum, pixels[i] + pixels[i + 1] + pixels[i + 2])
	}

	target.dispose()
	material.dispose()
	quad.geometry.dispose()
	return maxSum
}

interface ShadowAutoCutoffProps {
	apiRef: RefObject<AccumulativeApi | null>
	/** Manual trim on the auto value (1 = pure auto, <1 deeper, >1 lighter). */
	cutoffScale: number
	/**
	 * Whether the shadow bakes temporally (across frames) or in one synchronous
	 * pass. In non-temporal mode drei never advances `api.count`, so the
	 * "still baking" gate below must not wait on it.
	 */
	temporal: boolean
}

/**
 * Auto-calibrates the accumulative shadow's alphaTest to the current environment.
 *
 * alphaTest in drei's SoftShadowMaterial is a brightness divisor: the shadow
 * alpha is `max(0, 1 - planeBrightness / alphaTest)`. Setting it to the lit-plane
 * brightness makes lit areas exactly transparent while the dimmer shadowed areas
 * keep their contrast — and because the lit brightness tracks the HDRI, the
 * shadow reads consistently on any environment with no manual tuning.
 *
 * alphaTest only maps the already-baked lightmap to alpha, so we set the material
 * directly once the bake settles — no re-bake. It re-runs when the bake restarts
 * (new model / settings) or when the manual trim changes.
 */
const ShadowAutoCutoff = ({
	apiRef,
	cutoffScale,
	temporal
}: ShadowAutoCutoffProps) => {
	const gl = useThree((state) => state.gl)
	const calibratedRef = useRef(false)

	useEffect(() => {
		calibratedRef.current = false
	}, [cutoffScale, temporal])

	useFrame(() => {
		const api = apiRef.current
		if (!api) return

		// In temporal mode, re-arm while the bake ramps and calibrate once it has
		// settled. In non-temporal mode drei bakes synchronously in a layout effect
		// and leaves `api.count` at 0, so there is no counter to wait on — the bake
		// is already complete by the first frame; calibrate once (the calibrated
		// flag prevents re-measuring every frame).
		if (temporal && api.count < api.frames) {
			calibratedRef.current = false
			return
		}
		if (calibratedRef.current) return

		const mesh = api.getMesh() as Mesh & {
			material: { map?: Texture | null; alphaTest: number }
		}
		const map = mesh?.material?.map
		if (!map) return

		calibratedRef.current = true
		const litBrightness = measureLitBrightness(gl, map)
		if (litBrightness <= 0) return

		mesh.material.alphaTest = Math.min(
			ALPHA_TEST_MAX,
			Math.max(ALPHA_TEST_MIN, litBrightness * cutoffScale)
		)
	})

	return null
}

export default ShadowAutoCutoff
