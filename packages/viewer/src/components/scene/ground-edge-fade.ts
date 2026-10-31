/**
 * GLSL that fades a ground plane's shadow out toward the plane's edge, so a
 * long shadow from a low light thins away instead of ending on the square's
 * border. `vUv` is the plane's own UV, centered at 0.5; the fade is round,
 * so no corner of the square shows. Shared by the live bake and a persisted
 * one, which draw the same plane.
 */
export const GROUND_EDGE_FADE = /* glsl */ `
	float groundEdgeFade(vec2 uv) {
		return 1.0 - smoothstep(0.3, 0.5, distance(uv, vec2(0.5)));
	}
`
