import {
	Environment,
	Stage,
	EnvironmentProps as ThreeEnvironmentProps
} from '@react-three/drei'
import { ComponentProps, CSSProperties } from 'react'

export type EnvironmentKeys =
	| 'nature-moonlit'
	| 'nature-park'
	| 'nature-park-overcast'
	| 'nature-snow'
	| 'night-building'
	| 'night-city'
	| 'night-pure-sky'
	| 'night-stars'
	| 'outdoor-golden-hour'
	| 'outdoor-noon'
	| 'outdoor-overcast'
	| 'studio-key'
	| 'studio-natural'
	| 'studio-soft'

export type EnvironmentTypes = 'nature' | 'night' | 'outdoor' | 'studio'

export type EnvironmentResolution = '1k' | '4k'

export interface EnvironmentMap {
	id: EnvironmentKeys
	type: EnvironmentTypes
	resolution: EnvironmentResolution
}

export type EnvironmentMaps = Record<EnvironmentKeys, EnvironmentMap>

type InheritedEnvProps = Pick<
	ThreeEnvironmentProps,
	| 'background'
	| 'backgroundBlurriness'
	| 'environmentIntensity'
	| 'ground'
	| 'scene'
	| 'files'
	| 'backgroundIntensity'
>

export interface EnvironmentProps extends InheritedEnvProps {
	preset?: EnvironmentKeys
	environmentResolution?: EnvironmentResolution
	backgroundColor?: CSSProperties['backgroundColor']
}

export const defaultEnvOptions = {
	preset: 'nature-snow',
	environmentIntensity: 1,
	backgroundIntensity: 1,
	background: false,
	backgroundBlurriness: 0,
	ground: false
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
const SceneEnvironment = (props: EnvironmentProps) => {
	const { preset, environmentResolution, ...rest } = {
		...props,
		...defaultEnvOptions
	}

	const url = buildEnvUrl({
		id: defaultEnvOptions.preset,
		type: preset?.split('-')[0] as EnvironmentTypes,
		resolution: environmentResolution ?? '1k'
	})

	return <Environment files={url} {...rest} />
}

export default SceneEnvironment
