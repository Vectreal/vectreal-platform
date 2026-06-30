import { useThree } from '@react-three/fiber'
import {
	EffectComposer,
	N8AO,
	SMAA,
	ToneMapping
} from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { memo, useEffect, useState } from 'react'
import { ACESFilmicToneMapping, Box3, Object3D, Vector3 } from 'three'

interface ScenePostProcessingProps {
	/**
	 * Enables screen-space ambient occlusion (N8AO). When on, rendering routes
	 * through a postprocessing composer and tone mapping moves into it; when off,
	 * tone mapping is applied directly on the renderer (no composer at all).
	 */
	ao?: boolean
	/** AO strength (higher = darker). Only used when {@link ao} is true. */
	aoIntensity?: number
	/** Loaded model, measured to scale the AO radius to the subject. */
	model?: Object3D
}

/**
 * Applies ACES tone mapping directly on the renderer — the no-composer path.
 *
 * Mutates the existing renderer (no `gl` prop change, which would recreate the
 * WebGL context and drop the loaded model) and restores the previous values on
 * unmount. Used whenever the AO composer is not mounted, so the scene is never
 * double tone-mapped.
 */
const RendererToneMapping = () => {
	const gl = useThree((state) => state.gl)

	useEffect(() => {
		const previousToneMapping = gl.toneMapping
		const previousExposure = gl.toneMappingExposure
		gl.toneMapping = ACESFilmicToneMapping
		gl.toneMappingExposure = 1
		return () => {
			gl.toneMapping = previousToneMapping
			gl.toneMappingExposure = previousExposure
		}
	}, [gl])

	return null
}

// AO look-up radius as a fraction of the model's bounding radius. Small enough to
// read as crevice/contact occlusion rather than broad scene darkening.
const AO_RADIUS_FACTOR = 0.3

/**
 * Measures the model's world-space bounding radius so the AO radius can be sized
 * to the subject (models arrive at arbitrary scales — normalization is off by
 * default). Returns 1 until measured.
 */
const useModelRadius = (model?: Object3D): number => {
	const [radius, setRadius] = useState(1)

	useEffect(() => {
		if (!model) return
		model.updateWorldMatrix(true, true)
		const size = new Box3().setFromObject(model).getSize(new Vector3())
		const next = 0.5 * Math.hypot(size.x, size.y, size.z)
		if (next > 0 && Number.isFinite(next)) setRadius(next)
	}, [model])

	return radius
}

/**
 * Postprocessing for the viewer.
 *
 * Two mutually exclusive modes keep the pipeline from double tone-mapping:
 * - AO off (default): tone mapping is applied on the renderer, no composer.
 * - AO on: an `EffectComposer` runs N8AO for crevice self-occlusion, then ACES
 *   tone mapping. The composer sets the renderer's tone mapping to `NoToneMapping`
 *   itself, so ACES lives in the composer here.
 *
 * The composer is only mounted while AO is enabled. That keeps it the sole
 * positive render-priority owner of the loop (drei's AccumulativeShadows bakes at
 * priority 0 into its own targets, so it composes fine) and avoids the
 * disabled-but-mounted case where the composer leaves `autoClear` off and trails
 * other shadow passes.
 *
 * Memoized: drei's EffectComposer rebuilds ALL of its effect passes whenever its
 * `children` change identity. Without memo, every parent re-render (the viewer
 * re-renders on most publisher interactions) would hand the composer fresh child
 * elements and force a full pass teardown/rebuild — a visible flash and a stall on
 * every click/hover. With stable props (ao/aoIntensity/model) memo skips those
 * re-renders entirely, so the passes are built once.
 *
 * N8AO runs every frame the canvas draws (the viewer is `frameloop="always"`), so
 * it's kept cheap: half-resolution AO at the 'performance' preset. Hardware MSAA
 * is disabled (`multisampling={0}`) because it cannot antialias the AO/depth
 * buffer — it would be pure wasted cost — and SMAA (a cheap post AA pass) is used
 * instead, which is the N8AO author's recommended pairing.
 */
const ScenePostProcessing = memo(
	({ ao, aoIntensity = 1.4, model }: ScenePostProcessingProps) => {
		const radius = useModelRadius(model)

		if (!ao) return <RendererToneMapping />

		return (
			<EffectComposer multisampling={0} enableNormalPass={false}>
				<N8AO
					aoRadius={radius * AO_RADIUS_FACTOR}
					intensity={aoIntensity}
					distanceFalloff={1}
					quality="performance"
					screenSpaceRadius={false}
					halfRes
					depthAwareUpsampling
					color="black"
				/>
				<ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
				<SMAA />
			</EffectComposer>
		)
	}
)

ScenePostProcessing.displayName = 'ScenePostProcessing'

export default ScenePostProcessing
