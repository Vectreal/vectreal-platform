import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'

import * as THREE from 'three'

export interface ToneMappingProps {
	exposure?: number
	mapping?: 'ACESFilmic'
}

export const defaultToneMappingOptions = {
	exposure: 0.85,
	mapping: 'ACESFilmic'
} satisfies ToneMappingProps

// const options = ['No', 'Linear', 'AgX', 'ACESFilmic', 'Reinhard', 'Cineon', 'Custom']

function Tone({ mapping, exposure }: Required<ToneMappingProps>) {
	const gl = useThree((state) => state.gl)

	useEffect(() => {
		const prevFrag = THREE.ShaderChunk.tonemapping_pars_fragment
		const prevTonemapping = gl.toneMapping
		const prevTonemappingExp = gl.toneMappingExposure
		// Model viewers "commerce" tone mapping
		// https://github.com/google/model-viewer/blob/master/packages/model-viewer/src/three-components/Renderer.ts#L141
		THREE.ShaderChunk.tonemapping_pars_fragment =
			THREE.ShaderChunk.tonemapping_pars_fragment.replace(
				'vec3 CustomToneMapping( vec3 color ) { return color; }',
				`float startCompression = 0.8 - 0.04;
         float desaturation = 0.15;
         vec3 CustomToneMapping( vec3 color ) {
           color *= toneMappingExposure;
           float x = min(color.r, min(color.g, color.b));
           float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
           color -= offset;
           float peak = max(color.r, max(color.g, color.b));
           if (peak < startCompression) return color;
           float d = 1. - startCompression;
           float newPeak = 1. - d * d / (peak + d - startCompression);
           color *= newPeak / peak;
           float g = 1. - 1. / (desaturation * (peak - newPeak) + 1.);
           return mix(color, vec3(1, 1, 1), g);
         }`
			)

		const toneMappingKey = (mapping + 'ToneMapping') as keyof typeof THREE
		gl.toneMapping = THREE[toneMappingKey] as THREE.ToneMapping
		gl.toneMappingExposure = exposure

		return () => {
			// Retore on unmount or data change
			gl.toneMapping = prevTonemapping
			gl.toneMappingExposure = prevTonemappingExp
			THREE.ShaderChunk.tonemapping_pars_fragment = prevFrag
		}
	}, [mapping, exposure, gl])

	return null
}

export default function SceneToneMapping(props: ToneMappingProps) {
	const { mapping, exposure } = {
		...defaultToneMappingOptions,
		...props
	}

	const toneMapping = useMemo(() => {
		return <Tone mapping={mapping} exposure={exposure} />
	}, [mapping, exposure])

	return toneMapping
}
