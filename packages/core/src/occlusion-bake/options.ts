export interface OcclusionBakeOptions {
	/** Texture width and height in pixels. */
	resolution: number
	/** Rays per texel. More is smoother and slower. */
	samples: number
	/**
	 * How far a ray looks for something that blocks it, as a share of the
	 * scene's bounding box diagonal. Shorter keeps the darkening to creases.
	 */
	distance: number
}

export const DEFAULT_OCCLUSION_BAKE_OPTIONS: OcclusionBakeOptions = {
	resolution: 512,
	samples: 256,
	distance: 0.25
}
