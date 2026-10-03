import { useFrame, useThree } from '@react-three/fiber'
import {
	EffectComposer,
	EffectPass,
	Pass,
	RenderPass,
	SMAAEffect,
	ToneMappingEffect,
	ToneMappingMode
} from 'postprocessing'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
	Box3,
	type Camera,
	HalfFloatType,
	NeutralToneMapping,
	Object3D,
	OrthographicCamera,
	PerspectiveCamera,
	type Scene,
	Vector2,
	Vector3,
	type WebGLRenderer
} from 'three'

import { AccumulatePass } from './accumulate-pass'
import { N8AOPostPass } from './n8ao'
import {
	computeSceneSignature,
	createRenderActivity,
	type FramePlan,
	type RenderActivity
} from './render-activity'
import { warmUpScene } from './shader-warmup'

interface ScenePostProcessingProps {
	/**
	 * Routes rendering through the viewer's composer: idle supersampling, and
	 * N8AO when {@link ao} is on. When off, the renderer draws the scene directly
	 * with hardware MSAA and nothing converges at rest.
	 */
	enabled?: boolean
	/** Screen-space ambient occlusion (N8AO). Only used when {@link enabled}. */
	ao?: boolean
	/**
	 * Draws AO only while the viewer is at rest: orbiting costs nothing extra,
	 * and the occlusion drops out during motion and settles back in after it.
	 */
	aoAtRest?: boolean
	/** AO strength (higher = darker). Only used when {@link ao} is true. */
	aoIntensity?: number
	/** Loaded model, measured to scale the AO radius to the subject. */
	model?: Object3D
	/**
	 * Holds the viewer in motion while true, for changes the scene graph does
	 * not show, such as morph-target animation.
	 */
	active?: boolean
	/**
	 * Called once the scene's shaders have compiled and the first frame can be
	 * drawn without stalling. The viewer keeps its loader up until then.
	 */
	onShadersReady?: () => void
}

/**
 * Khronos PBR Neutral: reproduces base colors and hues faithfully under
 * grayscale lighting, which is what a product viewer is for. Filmic curves
 * (ACES, AgX) shift hue and desaturate in exchange for a look.
 */
const VIEWER_TONE_MAPPING = NeutralToneMapping
const COMPOSER_TONE_MAPPING = ToneMappingMode.NEUTRAL

/**
 * Hardware MSAA on the scene render. It is all the antialiasing a moving frame
 * gets; at rest the jittered accumulation supersamples on top of it. AO drawn
 * on moving frames rules it out, because AO reads a depth buffer MSAA cannot
 * antialias; SMAA covers those frames instead (the N8AO author's pairing).
 * AO drawn only at rest keeps it, since the jitter antialiases the AO there.
 */
const MSAA_SAMPLES = 4

// AO look-up radius as a fraction of the model's bounding radius. Small enough to
// read as crevice/contact occlusion rather than broad scene darkening.
const AO_RADIUS_FACTOR = 0.3

/**
 * Applies the viewer's tone mapping on the renderer.
 *
 * Mutates the existing renderer (no `gl` prop change, which would recreate the
 * WebGL context and drop the loaded model) and restores the previous values on
 * unmount. three tone-maps only draws that target the canvas, so this never
 * stacks with the composer's own tone mapping: the composer renders the scene
 * into its buffers and presents through an untoned pass. It governs the
 * direct-render path and anything else drawn onto the canvas.
 */
const RendererToneMapping = () => {
	const gl = useThree((state) => state.gl)

	useEffect(() => {
		const previousToneMapping = gl.toneMapping
		const previousExposure = gl.toneMappingExposure
		gl.toneMapping = VIEWER_TONE_MAPPING
		gl.toneMappingExposure = 1
		return () => {
			gl.toneMapping = previousToneMapping
			gl.toneMappingExposure = previousExposure
		}
	}, [gl])

	return null
}

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

/** A pass that draws nothing and runs a callback at its place in the chain. */
class CallbackPass extends Pass {
	private readonly callback: () => void

	constructor(callback: () => void) {
		super('CallbackPass')
		this.callback = callback
		this.needsSwap = false
	}

	override render() {
		this.callback()
	}
}

const isJitterable = (
	camera: unknown
): camera is OrthographicCamera | PerspectiveCamera =>
	camera instanceof PerspectiveCamera || camera instanceof OrthographicCamera

/**
 * Builds the composer chain for one renderer, scene, camera and AO setting.
 *
 * Only the scene render is jittered. The camera is restored before N8AO runs
 * and N8AO's record of the previous camera is brought level with it, so N8AO
 * keeps accumulating its own samples through OrbitControls' damping tail,
 * rotating its noise each frame; averaging those frames is what clears the AO
 * grain.
 */
const createPipeline = (
	gl: WebGLRenderer,
	scene: Scene,
	camera: Camera,
	ao: boolean,
	aoAtRest: boolean
) => {
	const aoInMotion = ao && !aoAtRest
	// The composer switches the renderer's autoClear off for good when it is
	// handed the renderer. Everything else that renders into its own target -
	// drei's ContactShadows among them - relies on the default, so the
	// composer gets it off only while it renders.
	const autoClear = gl.autoClear
	const composer = new EffectComposer(gl, {
		frameBufferType: HalfFloatType,
		multisampling: aoInMotion ? 0 : MSAA_SAMPLES
	})
	gl.autoClear = autoClear

	const bufferSize = new Vector2()
	const jitter: [number, number] = [0, 0]
	let jittering = false

	composer.addPass(
		new CallbackPass(() => {
			if (!jittering || !isJitterable(camera)) return
			gl.getDrawingBufferSize(bufferSize)
			// A perspective camera takes its aspect from the full size it is
			// given here, so the width comes from its own aspect rather than the
			// drawing buffer: at fractional pixel ratios the two disagree and the
			// image would stretch the moment the viewer comes to rest.
			const fullWidth =
				camera instanceof PerspectiveCamera
					? bufferSize.y * camera.aspect
					: bufferSize.x
			camera.setViewOffset(
				fullWidth,
				bufferSize.y,
				jitter[0],
				jitter[1],
				fullWidth,
				bufferSize.y
			)
		})
	)
	composer.addPass(new RenderPass(scene, camera))

	let aoPass: N8AOPostPass | null = null
	if (ao) {
		aoPass = new N8AOPostPass(scene, camera)
		aoPass.setQualityMode('Performance')
		Object.assign(aoPass.configuration, {
			distanceFalloff: 1,
			screenSpaceRadius: false,
			halfRes: true,
			depthAwareUpsampling: true,
			accumulate: true
		})
	}

	composer.addPass(
		new CallbackPass(() => {
			if (!jittering) return
			if (isJitterable(camera)) camera.clearViewOffset()
			if (!aoPass) return
			// The planner calls the camera still once it stops moving visibly;
			// N8AO compares matrices exactly and would restart on every frame of
			// the damping tail, leaving every sample with the same noise.
			camera.updateMatrixWorld()
			aoPass.lastViewMatrix.copy(camera.matrixWorldInverse)
			aoPass.lastProjectionMatrix.copy(camera.projectionMatrix)
		})
	)
	if (aoPass) composer.addPass(aoPass)

	composer.addPass(
		new EffectPass(
			camera,
			new ToneMappingEffect({ mode: COMPOSER_TONE_MAPPING })
		)
	)

	// SMAA is off while accumulating, where it would blur the very samples being
	// averaged, except for the first: that one is shown alone, and without SMAA
	// the first frame at rest would look rougher than the moving frame before it.
	const smaaPass = aoInMotion ? new EffectPass(camera, new SMAAEffect()) : null
	if (smaaPass) composer.addPass(smaaPass)

	const accumulatePass = new AccumulatePass()
	composer.addPass(accumulatePass)

	return {
		composer,
		aoPass,
		accumulatePass,
		render(delta: number, plan: FramePlan, keepHistory: boolean) {
			jittering = plan.kind === 'accumulate'
			if (plan.kind === 'accumulate') {
				jitter[0] = plan.offset[0]
				jitter[1] = plan.offset[1]
				accumulatePass.accumulate(plan.sample)
			} else {
				// A change the camera did not cause leaves N8AO's camera check
				// satisfied; tell it its accumulated AO is stale.
				if (aoPass) aoPass.needsFrame = true
				accumulatePass.present(keepHistory)
			}
			if (aoPass) aoPass.enabled = !aoAtRest || jittering
			if (smaaPass) {
				smaaPass.enabled = plan.kind !== 'accumulate' || plan.sample === 0
			}

			const previousAutoClear = gl.autoClear
			gl.autoClear = false
			composer.render(delta)
			gl.autoClear = previousAutoClear
		},
		dispose() {
			if (aoPass) {
				aoPass.accumulationQuad?.dispose()
				aoPass.depthDownsampleQuad?.dispose()
				aoPass.effectCompositerQuad?.dispose()
				aoPass.effectShaderQuad?.dispose()
				aoPass.poissonBlurQuad?.dispose()
			}
			composer.dispose()
		}
	}
}

type Pipeline = ReturnType<typeof createPipeline>

/**
 * The viewer's composer and the one owner of the frame.
 *
 * Moving, it renders every frame: the scene, N8AO if on (unless it is held
 * for rest), tone mapping, and SMAA when moving AO rules out MSAA. At rest it
 * renders `ACCUMULATION_SAMPLES` more
 * frames with the projection nudged by a sub-pixel each time and averages them,
 * then stops drawing: a still viewer converges to a supersampled image and
 * costs no GPU time until something changes. `render-activity.ts` decides
 * which kind of frame each one is.
 */
const ViewerComposer = ({
	ao,
	aoAtRest,
	aoIntensity,
	model,
	active,
	onShadersReady
}: Required<Pick<ScenePostProcessingProps, 'ao' | 'aoAtRest' | 'aoIntensity'>> &
	Pick<ScenePostProcessingProps, 'model' | 'active' | 'onShadersReady'>) => {
	const gl = useThree((state) => state.gl)
	const scene = useThree((state) => state.scene)
	const camera = useThree((state) => state.camera)
	const size = useThree((state) => state.size)
	const dpr = useThree((state) => state.viewport.dpr)
	const invalidate = useThree((state) => state.invalidate)
	const radius = useModelRadius(model)

	const activeRef = useRef(active ?? false)
	activeRef.current = active ?? false

	// N8AO's own defaults are far darker and wider than the viewer's, so the
	// current values go in as the pipeline is built, not an effect later.
	const aoConfig = {
		aoRadius: radius * AO_RADIUS_FACTOR,
		intensity: aoIntensity
	}
	const aoConfigRef = useRef(aoConfig)
	aoConfigRef.current = aoConfig

	// The frame loop reads the live pipeline through a ref that is cleared
	// before the pipeline is disposed, so no frame can reach a disposed one
	// (disposal empties the pass list). Built and disposed in one effect
	// rather than memoized, so an effect re-run (StrictMode, a hidden-then-shown
	// Activity) builds a fresh chain instead of keeping the emptied one.
	//
	// A layout effect, because R3F subscribes `useFrame` in one: a passive
	// effect left a frame between the two, drawn straight to the canvas. That
	// frame compiled every material for the canvas's output, and the next
	// compiled them all again for the composer's linear buffer, blocking the
	// main thread twice while the loader was on screen.
	const live = useRef<{ pipeline: Pipeline; activity: RenderActivity } | null>(
		null
	)
	useLayoutEffect(() => {
		const pipeline = createPipeline(gl, scene, camera, ao, aoAtRest)
		if (pipeline.aoPass) {
			Object.assign(pipeline.aoPass.configuration, aoConfigRef.current)
		}
		live.current = { pipeline, activity: createRenderActivity() }
		return () => {
			live.current = null
			pipeline.dispose()
		}
	}, [ao, aoAtRest, camera, gl, scene])

	useEffect(() => {
		live.current?.pipeline.composer.setSize(size.width, size.height)
	}, [size.width, size.height, dpr])

	// Which model's shaders are compiled. The frame loop draws nothing until it
	// matches the model on screen: drawing sooner would compile on the main
	// thread, which is the freeze this exists to prevent. A swapped model keeps
	// the previous frame up meanwhile, since an undrawn canvas keeps showing it.
	const modelRef = useRef(model)
	modelRef.current = model
	const warmed = useRef<{ model?: Object3D } | null>(null)
	const onShadersReadyRef = useRef(onShadersReady)
	onShadersReadyRef.current = onShadersReady

	useEffect(() => {
		const current = live.current
		if (!current) return
		let cancelled = false
		void warmUpScene(
			gl,
			scene,
			camera,
			current.pipeline.composer.inputBuffer,
			() => cancelled
		).then(() => {
			if (cancelled) return
			warmed.current = { model }
			onShadersReadyRef.current?.()
			invalidate()
		})
		return () => {
			cancelled = true
		}
	}, [model, camera, gl, scene, invalidate])

	useEffect(() => {
		const aoPass = live.current?.pipeline.aoPass
		if (aoPass) Object.assign(aoPass.configuration, aoConfigRef.current)
	}, [radius, aoIntensity])

	// A React commit of the viewer is a change to what it shows: settings,
	// environment, model. Most such changes reach the scene graph without
	// moving anything, so restart the accumulation on every render of the viewer.
	useEffect(() => {
		invalidate()
	})

	const bufferSize = useMemo(() => new Vector2(), [])

	useFrame((state, delta) => {
		// Before a pipeline exists, or while one is being replaced, draw directly
		// rather than leave the canvas blank: this subscriber's priority has
		// already taken the render over from R3F.
		if (!live.current) {
			state.gl.render(state.scene, state.camera)
			return
		}
		const { pipeline, activity } = live.current

		if (!warmed.current || warmed.current.model !== modelRef.current) {
			if (state.internal.priority > 1) {
				pipeline.accumulatePass.presentHistory(state.gl)
			}
			return
		}

		state.scene.updateMatrixWorld()
		state.camera.updateMatrixWorld()
		state.gl.getDrawingBufferSize(bufferSize)

		const plan = activity.plan({
			camera: state.camera,
			width: bufferSize.x,
			height: bufferSize.y,
			sceneSignature: computeSceneSignature(state.scene),
			invalidated: state.internal.frames > 0,
			active: activeRef.current
		})

		if (plan.kind !== 'converged') {
			// The history is redrawn only under another renderer's frame.
			pipeline.render(delta, plan, state.internal.priority > 1)
			return
		}

		// Converged. With nothing else drawing on this canvas the browser keeps
		// showing the last presented frame, so there is nothing to do. Another
		// positive-priority renderer (the publisher's view cube) draws every
		// frame, and its frame starts from a cleared buffer: give it the
		// converged image to draw over.
		if (state.internal.priority > 1) {
			pipeline.accumulatePass.presentHistory(state.gl)
		}
	}, 1)

	return null
}

/**
 * Rendering for the viewer: tone mapping always, and the composer that owns
 * the frame unless post-processing is disabled.
 */
const ScenePostProcessing = ({
	enabled = true,
	ao = false,
	aoAtRest = false,
	aoIntensity = 1.4,
	model,
	active,
	onShadersReady
}: ScenePostProcessingProps) => (
	<>
		<RendererToneMapping />
		{enabled && (
			<ViewerComposer
				ao={ao}
				aoAtRest={aoAtRest}
				aoIntensity={aoIntensity}
				model={model}
				active={active}
				onShadersReady={onShadersReady}
			/>
		)}
	</>
)

export default ScenePostProcessing
