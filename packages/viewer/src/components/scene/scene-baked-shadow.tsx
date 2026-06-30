import { useTexture } from '@react-three/drei'
import { useMemo } from 'react'
import { Color } from 'three'

interface SceneBakedShadowProps {
	/** URL of the persisted shadow-density PNG (alpha channel = density). */
	url: string
	/** World-space side length of the shadow plane (footprint × shadow scale). */
	planeScale: number
	/** Live shadow strength, multiplied over the baked density. */
	opacity: number
	/** Live shadow color. */
	color: string
}

const VERTEX_SHADER = /* glsl */ `
	varying vec2 vUv;
	void main() {
		vUv = uv;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`

// Re-applies the persisted density: alpha = density × opacity, tinted by the live
// shadow color. Opacity and color stay adjustable without a re-bake because the
// stored texture is pure density (see captureShadowDensity).
const FRAGMENT_SHADER = /* glsl */ `
	varying vec2 vUv;
	uniform sampler2D uMap;
	uniform vec3 uColor;
	uniform float uOpacity;
	void main() {
		float density = texture2D(uMap, vUv).a;
		gl_FragColor = vec4(uColor, density * uOpacity);
	}
`

/**
 * Renders a persisted accumulative-shadow bake as a static textured plane —
 * the load-time replacement for re-running the temporal bake. Same geometry the
 * accumulative shadow uses (a ground plane in UV space), so the stored density
 * lands exactly where it was baked.
 */
const SceneBakedShadow = ({
	url,
	planeScale,
	opacity,
	color
}: SceneBakedShadowProps) => {
	const map = useTexture(url)

	const uniforms = useMemo(
		() => ({
			uMap: { value: map },
			uColor: { value: new Color(color) },
			uOpacity: { value: opacity }
		}),
		[map]
	)

	uniforms.uColor.value.set(color)
	uniforms.uOpacity.value = opacity

	return (
		<mesh rotation={[-Math.PI / 2, 0, 0]} scale={planeScale}>
			<planeGeometry />
			<shaderMaterial
				transparent
				depthWrite={false}
				uniforms={uniforms}
				vertexShader={VERTEX_SHADER}
				fragmentShader={FRAGMENT_SHADER}
			/>
		</mesh>
	)
}

export default SceneBakedShadow
