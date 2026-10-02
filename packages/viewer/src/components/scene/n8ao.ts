// @ts-expect-error n8ao ships no type declarations
import { N8AOPostPass as UntypedN8AOPostPass } from 'n8ao'

import type { Pass } from 'postprocessing'
import type { Camera, Matrix4, Scene } from 'three'

/**
 * The part of n8ao's post pass the viewer's composer touches, typed here
 * because the package ships none. Names match n8ao 1.10's source.
 */
export interface N8AOConfiguration {
	aoRadius: number
	distanceFalloff: number
	intensity: number
	screenSpaceRadius: boolean
	halfRes: boolean
	depthAwareUpsampling: boolean
	/**
	 * Accumulates AO samples across frames while the camera's view and
	 * projection matrices are unchanged, rotating the noise each frame.
	 */
	accumulate: boolean
}

export interface N8AOPostPass extends Pass {
	configuration: N8AOConfiguration
	/** Forces the next render to discard accumulated samples. */
	needsFrame: boolean
	/**
	 * The camera matrices of the previous render. Accumulation continues only
	 * while both still equal the camera's exactly.
	 */
	lastViewMatrix: Matrix4
	lastProjectionMatrix: Matrix4
	/** Internal full-screen quads, which the pass's own disposal leaves alive. */
	accumulationQuad?: { dispose(): void }
	depthDownsampleQuad?: { dispose(): void }
	effectCompositerQuad?: { dispose(): void }
	effectShaderQuad?: { dispose(): void }
	poissonBlurQuad?: { dispose(): void }
	setQualityMode(
		mode: 'Performance' | 'Low' | 'Medium' | 'High' | 'Ultra'
	): void
}

export const N8AOPostPass = UntypedN8AOPostPass as new (
	scene: Scene,
	camera: Camera
) => N8AOPostPass
