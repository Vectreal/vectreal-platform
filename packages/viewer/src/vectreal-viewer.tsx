/* vectreal-core | vctrl/viewer
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>. */

import { Center } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { LoadingSpinner as DefaultSpinner } from '@shared/components/ui/loading-spinner'
import { cn } from '@shared/utils'
import {
	ControlsProps,
	EnvironmentProps,
	GridProps,
	ShadowsProps
} from '@vctrl/core'
// import { Perf } from 'r3f-perf'
import { memo, PropsWithChildren, Suspense, useEffect, useState } from 'react'
import { Object3D } from 'three'

import { InfoPopover, type InfoPopoverProps } from './components'
import {
	SceneControls,
	SceneEnvironment,
	SceneGrid,
	SceneModel,
	SceneShadows
} from './components/scene'

import styles from './styles.module.css'

export interface VectrealViewerProps extends PropsWithChildren {
	/**
	 * The 3D model to render in the viewer. (three.js `Object3D`)
	 */
	model?: Object3D

	/**
	 * An optional className to apply to the outermost container of the viewer.
	 */
	className?: string

	/**
	 * Options for the OrbitControls.
	 */
	controlsOptions?: ControlsProps

	/**
	 * Options for the react-three environment components with custom hdr map presets.
	 */
	envOptions?: EnvironmentProps

	/**
	 * Options for the shadows.
	 */
	shadowsOptions?: ShadowsProps

	/**
	 * Options for the grid.
	 */
	gridOptions?: GridProps

	/**
	 * Options for the info popover.
	 */
	infoPopoverOptions?: InfoPopoverProps

	/**
	 * JSX element to render while the model is loading.
	 */
	loader?: React.ReactNode

	/**
	 * Callback function to handle screenshot generation (accept data URL via param).
	 */
	onScreenshot?: (dataUrl: string) => void
}

/**
 * A React component for rendering 3D models.
 *
 * This component is designed to be easily extensible and customizable. It uses the
 * `@react-three/drei` library to render the 3D scene.
 *
 * The component also accepts the following props:
 *
 * - `children`: Any React children to render inside the canvas.
 * - `model`: A 3D model to render as three `Object3D`.
 * - `className`: An optional className to apply to the outermost container element.
 * - `controlsOptions`: An optional object containing options for the OrbitControls.
 * - `envOptions`: An optional object containing options for the environment.
 * - `gridOptions`: An optional object containing options for the grid.
 * - `infoPopoverOptions`: An optional object containing options for the info popover.
 * - `loader`: An optional JSX element to render while the model is loading.
 *
 * The component will render any provided children inside the canvas.
 *
 * See [The official website]({@link https://core.vectreal.com}) or the [vctrl/viewer README]({@link https://github.com/vectreal/vectreal-core/blob/main/packages/viewer/README.md}) for more information.
 *
 * @example
 * import { VectrealViewer } from '@vctrl/viewer';
 *
 * const MyComponent = () => {
 *   return (
 *     <VectrealViewer
 *       model={model}
 *       controlsOptions={{ maxPolarAngle: Math.PI / 2 }}
 *     />
 *   );
 * };
 */
const VectrealViewer = memo(({ model, ...props }: VectrealViewerProps) => {
	const {
		className,
		children,
		envOptions,
		gridOptions,
		controlsOptions,
		infoPopoverOptions,
		shadowsOptions,
		onScreenshot,
		loader = <DefaultSpinner />
	} = props

	const [showLoader, setShowLoader] = useState(!model)
	const [isLoaderFading, setIsLoaderFading] = useState(false)
	const [showCanvas, setShowCanvas] = useState(!!model)

	useEffect(() => {
		if ((model && showLoader) || children) {
			// Start canvas fade in and loader fade out simultaneously
			setIsLoaderFading(true)
			setShowCanvas(true)

			setTimeout(() => {
				// After fade out duration, hide loader
				setShowLoader(false)
				setIsLoaderFading(false)
			}, 500) // Matching this duration with CSS transition duration
		} else if (!model && !showLoader) {
			setShowLoader(true)
			setShowCanvas(false)
		}
	}, [model, showLoader, children])

	// Check if the dark mode is manually enabled - This needs to be js because of CSS modules and minification
	const isManualDarkModel = className?.split(' ').includes('dark')

	return (
		<div
			className={cn(
				className,
				'vctrl-viewer',
				styles['viewer'],
				isManualDarkModel && styles.dark
			)}
		>
			<Canvas
				shadows
				// gl={{
				// 	preserveDrawingBuffer: true,
				// 	powerPreference: 'high-performance'
				// }}
				// dpr={[1, 1.5]}
				className={cn(
					'vctrl-viewer-canvas',
					styles['viewer-canvas'],
					showCanvas && styles['fade-in']
				)}
			>
				<Suspense fallback={null}>
					{(model || children) && (
						<>
							{/* <Perf /> */}
							{/* <ScenePostProcessing /> */}
							<SceneControls {...controlsOptions} />
							<SceneEnvironment {...envOptions} />
							<SceneGrid {...gridOptions} />
							<SceneShadows {...shadowsOptions} />
							{/* <SceneToneMapping
								mapping={toneMappingOptions?.mapping}
								exposure={toneMappingOptions?.exposure}
							/> */}

							<Center top>
								{model ? (
									<SceneModel onScreenshot={onScreenshot} object={model} />
								) : (
									children
								)}
							</Center>
						</>
					)}
				</Suspense>
			</Canvas>

			{showLoader && !children && (
				<div
					className={cn(
						'absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-4',
						styles['loader-container'],
						isLoaderFading && styles['fade-out']
					)}
				>
					{loader}
				</div>
			)}

			<InfoPopover {...infoPopoverOptions} />
		</div>
	)
})
export default VectrealViewer
