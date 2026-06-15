import { ContactShadows } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { ContactShadowProps, ShadowsProps } from '@vctrl/core'
import { memo } from 'react'

export const defaultShadowsOptions: ShadowsProps = {
	type: 'contact',
	enabled: false,
	opacity: 0.4,
	blur: 0.1,
	scale: 1,
	color: '#000000',
	smooth: true
}

/**
 * Renders contact shadows for the Three.js scene.
 * Accepts partial shadow configuration merged with defaults.
 */
const SceneShadows = memo((props?: Partial<ShadowsProps>) => {
	const shadowOptions: ShadowsProps = { ...defaultShadowsOptions, ...props }

	// ContactShadows renders depth into its own WebGLRenderTarget via useFrame.
	// r3f sets gl.autoClear = false globally, so the RT is never cleared before
	// each depth render. Background pixels retain the previous blurred result
	// through NormalBlending, causing the shadow to accumulate and grow each
	// frame. Bracketing ContactShadows' useFrame (priority 0) with
	// autoClear=true/false ensures the RT is cleared before each depth render.
	const isEnabled = !!shadowOptions.enabled

	useFrame((state) => {
		if (isEnabled) state.gl.autoClear = true
	}, -1)

	useFrame((state) => {
		if (isEnabled) state.gl.autoClear = false
	}, 1)

	if (!shadowOptions.enabled) return null

	const { type: _type, enabled: _enabled, ...contactProps } =
		shadowOptions as ContactShadowProps

	return <ContactShadows {...contactProps} />
})

SceneShadows.displayName = 'SceneShadows'

export default SceneShadows
