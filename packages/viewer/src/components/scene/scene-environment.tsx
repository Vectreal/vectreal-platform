import { Environment } from '@react-three/drei'
import { EnvironmentMap, EnvironmentProps, EnvironmentType } from '@vctrl/core'
import { memo } from 'react'

export const defaultEnvOptions = {
	preset: 'studio-natural',
	background: false,
	backgroundIntensity: 1,
	environmentIntensity: 1,
	environmentResolution: '1k',
	backgroundBlurriness: 0.5
} satisfies EnvironmentProps

const buildEnvUrl = ({ id, type, resolution }: EnvironmentMap) => {
	const urlId = id.replaceAll('-', '_')
	const presetName = `${urlId}_${resolution}`
	const baseUrl = `https://storage.googleapis.com/environment-maps/${type}/`
	return `${baseUrl}${presetName}.hdr`
}

/**
 * SceneEnvironment component that sets up the environment for a scene.
 */
const SceneEnvironment = memo((props: EnvironmentProps) => {
	const { preset, environmentResolution, ...rest } = {
		...defaultEnvOptions,
		...props
	}

	const url = buildEnvUrl({
		id: preset,
		type: preset?.split('-')[0] as EnvironmentType,
		resolution: environmentResolution ?? '1k'
	})

	return <Environment files={url} {...rest} />
})

export default SceneEnvironment
