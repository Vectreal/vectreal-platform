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
import { LoadingSpinner as DefaultSpinner } from '@shared/components/ui/loading-spinner'
import { cn } from '@shared/utils'
import {
	BoundsProps,
	CameraProps,
	ControlsProps,
	EnvironmentProps,
	GridProps,
	ShadowsProps
} from '@vctrl/core'
// import { Perf } from 'r3f-perf'
import { memo, PropsWithChildren, Suspense } from 'react'
import { Object3D } from 'three'

import { Canvas, Overlay } from './components'
import {
	SceneBounds,
	SceneControls,
	SceneEnvironment,
	SceneModel,
	ScenePostProcessing,
	SceneShadows
} from './components/scene'

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
	 * Theme for the viewer.
	 * - 'light': Force light theme
	 * - 'dark': Force dark theme
	 * - 'system': Use system preference (default)
	 */
	theme?: 'light' | 'dark' | 'system'

	/**
	 * Whether to render the canvas only when visible in viewport.
	 * Improves performance by not rendering off-screen scenes.
	 * Default: true
	 */
	enableViewportRendering?: boolean

	/**
	 * Options for the scene bounds.
	 */
	boundsOptions?: BoundsProps

	/**
	 * Options for the scene camera.
	 */
	cameraOptions?: CameraProps

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
	 * Slot for the info popover component.
	 */
	popover?: React.ReactNode

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
		theme = 'system',
		cameraOptions,
		boundsOptions,
		envOptions,
		// gridOptions,
		controlsOptions,
		shadowsOptions,
		popover,
		onScreenshot,
		enableViewportRendering = true,
		loader = <DefaultSpinner />
	} = props

	const hasContent = !!(model || children)

	return (
		<Suspense fallback={loader}>
			<Canvas
				containerClassName={cn(
					'viewer vctrl-viewer h-full w-full overflow-clip font-[poppins,sans-serif] text-base [&_a]:text-inherit [&_a]:no-underline [&_button]:border-0 [&_p]:m-0',
					className
				)}
				theme={theme}
				overlay={
					<Overlay hasContent={hasContent} popover={popover} loader={loader} />
				}
				enableViewportRendering={enableViewportRendering}
				shadows
				gl={{ antialias: true }}
				camera={cameraOptions}
			>
				<Suspense fallback={null}>
					{hasContent && (
						<>
							{/* <SceneGrid {...gridOptions} /> */}
							<SceneShadows {...shadowsOptions} />
							<SceneEnvironment {...envOptions} />
							{/* <Perf /> */}
							<ScenePostProcessing />
							<SceneControls {...controlsOptions} />
							{/* <SceneToneMapping
								mapping={toneMappingOptions?.mapping}
								exposure={toneMappingOptions?.exposure}
							/> */}
							<SceneBounds {...boundsOptions}>
								<Center top>
									{model ? (
										<SceneModel onScreenshot={onScreenshot} object={model} />
									) : (
										children
									)}
								</Center>
							</SceneBounds>
						</>
					)}
				</Suspense>
			</Canvas>
		</Suspense>
	)
})

VectrealViewer.displayName = 'VectrealViewer'

export default VectrealViewer
