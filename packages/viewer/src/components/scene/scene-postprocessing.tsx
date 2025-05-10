import { EffectComposer, SSAO } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

const ScenePostProcessing = () => {
	return (
		<EffectComposer enableNormalPass={true} multisampling={0}>
			<SSAO
				blendFunction={BlendFunction.MULTIPLY} // blend mode
				samples={50} // amount of samples used for the occlusion effect. min: 1, max: 128
				rings={4} // amount of rings in the occlusion sampling pattern
				distanceThreshold={0.5} // global distance threshold at which the occlusion effect starts to fade out. min: 0, max: 1
				distanceFalloff={0.1} // distance falloff. min: 0, max: 1
				rangeThreshold={0.5} // local occlusion range threshold at which the occlusion starts to fade out. min: 0, max: 1
				rangeFalloff={0.1} // occlusion range falloff. min: 0, max: 1
				luminanceInfluence={0.9} // how much the luminance of the scene influences the ambient occlusion
				minRadiusScale={0.01} // minimum occlusion radius scale
			/>
		</EffectComposer>
	)
}

export default ScenePostProcessing
