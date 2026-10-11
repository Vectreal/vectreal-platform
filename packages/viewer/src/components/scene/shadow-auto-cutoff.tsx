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

import {
	calibratedAlphaTest,
	cutoffCalibrationStep
} from './shadow-cutoff-calibration'

type AccumulativeApi = ComponentRef<typeof AccumulativeShadows>

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
 * directly once the bake settles — no re-bake. It re-runs whenever drei has
 * written over the calibrated value, which every reset and re-bake does (new
 * model, moved light, changed settings), and when the manual trim changes.
 */
const ShadowAutoCutoff = ({
	apiRef,
	cutoffScale,
	temporal
}: ShadowAutoCutoffProps) => {
	const gl = useThree((state) => state.gl)
	const invalidate = useThree((state) => state.invalidate)
	// The alphaTest last written to the material; null forces a recalibration.
	const lastWrittenRef = useRef<number | null>(null)

	useEffect(() => {
		lastWrittenRef.current = null
	}, [cutoffScale, temporal])

	useFrame(() => {
		const api = apiRef.current
		if (!api) return

		const mesh = api.getMesh() as Mesh & {
			material: { map?: Texture | null; alphaTest: number }
		}
		const map = mesh?.material?.map
		if (!map) return

		const step = cutoffCalibrationStep({
			temporal,
			count: api.count,
			frames: api.frames,
			alphaTest: mesh.material.alphaTest,
			lastWritten: lastWrittenRef.current
		})
		if (step === 'baking') lastWrittenRef.current = null
		if (step !== 'calibrate') return

		const alphaTest = calibratedAlphaTest(
			measureLitBrightness(gl, map),
			cutoffScale
		)
		if (alphaTest === null) {
			// Nothing to calibrate against: adopt drei's value rather than
			// measuring again on every frame.
			lastWrittenRef.current = mesh.material.alphaTest
			return
		}

		mesh.material.alphaTest = alphaTest
		lastWrittenRef.current = alphaTest
		// A material edit moves nothing in the scene graph, so without this a
		// viewer already converging at rest would keep the uncalibrated shadow.
		invalidate()
	})

	return null
}

export default ShadowAutoCutoff
