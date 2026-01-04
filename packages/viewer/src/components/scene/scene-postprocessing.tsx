import { EffectComposer, SMAA, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

const ScenePostProcessing = () => {
	return (
		<EffectComposer enableNormalPass={true} multisampling={0}>
			<SMAA />
			<ToneMapping
				blendFunction={BlendFunction.AVERAGE} // blend mode
				adaptive={false} // toggle adaptive luminance map usage
				resolution={256} // texture resolution of the luminance map
				middleGrey={0.5} // middle grey factor
				maxLuminance={20.0} // maximum luminance
				averageLuminance={1.5} // average luminance
				adaptationRate={1.0} // luminance adaptation rate
			/>
		</EffectComposer>
	)
}

export default ScenePostProcessing
