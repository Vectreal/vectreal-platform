import { EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

const ScenePostProcessing = () => {
	return (
		<EffectComposer enableNormalPass={false} multisampling={4}>
			<ToneMapping
				blendFunction={BlendFunction.AVERAGE} // blend mode
				adaptive={true} // toggle adaptive luminance map usage
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
