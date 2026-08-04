# @vctrl/viewer

[![NPM Downloads](https://img.shields.io/npm/dm/%40vctrl%2Fviewer?logo=npm&logoColor=%23fc6c18&label=%40vctrl%2Fviewer%20%7C%20NPM%20Downloads&color=%23fc6c18)](https://www.npmjs.com/package/@vctrl/viewer)
[![Storybook](https://img.shields.io/badge/Storybook-Docs-fc6c18?logo=storybook&logoColor=%23fc6c18)](https://main--672b9522ee5bda25942a731c.chromatic.com/?path=/docs/viewer-vectreal-viewer--docs)

A ready-to-use React component for rendering and interacting with 3D models. Built on top of [Three.js](https://threejs.org) and [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/getting-started/introduction).

> This package is still in active development. Breaking changes may occur before the first major release.

---

## Installation

```bash
npm install @vctrl/viewer
# or
pnpm add @vctrl/viewer
```

---

## Quick start

```tsx
import { useLoadModel } from '@vctrl/hooks/use-load-model'
import { VectrealViewer } from '@vctrl/viewer'
import '@vctrl/viewer/css'

function App() {
	const { file } = useLoadModel()
	return <VectrealViewer model={file?.model} />
}
```

> You must import the CSS bundle (`@vctrl/viewer/css`) for the viewer to render correctly.

---

## `VectrealViewer` props

| Prop                           | Type                                                    | Required | Description                                                                      |
| ------------------------------ | ------------------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| `model`                        | `Object3D`                                              | No\*     | The Three.js scene to display. Optional only if you supply scene content via `children`; with neither, nothing renders. |
| `className`                    | `string`                                                | No       | Additional CSS classes for the viewer container                                  |
| `theme`                        | `'light' \| 'dark' \| 'system'`                         | No       | Viewer theme, default is `system`                                                |
| `enableViewportRendering`      | `boolean`                                               | No       | Render only while in viewport, default `true`                                    |
| `enablePostProcessing`         | `boolean`                                               | No       | Toggle postprocessing effects, default `true`                                    |
| `boundsOptions`                | `BoundsProps`                                           | No       | Scene bounds and framing behavior                                                |
| `cameraOptions`                | `CameraProps`                                           | No       | Perspective camera configuration                                                 |
| `controlsOptions`              | `ControlsProps`                                         | No       | OrbitControls configuration                                                      |
| `envOptions`                   | `EnvironmentProps`                                      | No       | Stage and Environment component configuration                                    |
| `shadowsOptions`               | `ShadowsProps`                                          | No       | Shadow behavior configuration                                                    |
| `popover`                      | `React.ReactNode`                                       | No       | Optional info popover slot                                                       |
| `loader`                       | `React.ReactNode`                                       | No       | Custom loading UI                                                                |
| `loadingThumbnail`             | `ViewerLoadingThumbnail`                                | No       | Optional blurred loading thumbnail                                               |
| `onScreenshot`                 | `(dataUrl: string) => void`                             | No       | Called when a screenshot is captured                                             |
| `onScreenshotCaptureReady`     | `(capture: SceneScreenshotCapture \| null) => void`     | No       | Receives a capture function for on-demand screenshots                            |
| `onCameraSnapshotCaptureReady` | `(capture: SceneCameraSnapshotCapture \| null) => void` | No       | Receives a capture function for the current camera pose                          |
| `onInteractionEvent`           | `(event: ViewerInteractionEvent) => void`               | No       | Receives viewer lifecycle and runtime interaction events                         |
| `onCommandExecutorReady`       | `(executor: ViewerCommandExecutor \| null) => void`     | No       | Receives a minimal imperative runtime command executor                           |

### Notes on content source

- `model` is optional because you can also render scene content via `children`.
- Grid options are currently typed but not active in render output.

---

## Camera options (`CameraProps`)

`cameraOptions` accepts:

```ts
type CameraProps = {
	activeCameraId?: string
	cameras?: Array<
		PerspectiveCameraProps & {
			cameraId: string
			name: string
			kind?: 'scene' | 'hotspot'
			initial?: boolean
			target?: [number, number, number]
		}
	>
	sceneTransition?: {
		type: 'linear' | 'object_avoidance' | 'none'
		duration?: number
		easing?: 'linear' | 'ease_in' | 'ease_out' | 'ease_in_out'
	}
}
```

Each camera entry extends `PerspectiveCameraProps` from Drei and adds viewer-specific camera switching metadata. Transitions between cameras are configured once at the scene level via `sceneTransition`, not per camera.

```tsx
<VectrealViewer
	cameraOptions={{
		activeCameraId: 'default',
		sceneTransition: {
			type: 'linear',
			duration: 900,
			easing: 'ease_in_out'
		},
		cameras: [
			{
				cameraId: 'default',
				name: 'Default',
				initial: true,
				position: [0, 5, 8],
				fov: 55,
				near: 0.1,
				far: 1000
			}
		]
	}}
/>
```

---

## Controls options (`ControlsProps`)

Based on [@react-three/drei OrbitControls](https://github.com/pmndrs/drei#orbitcontrols).

`controlsOptions` extends OrbitControls props and adds:

| Option            | Type     | Description                                            |
| ----------------- | -------- | ------------------------------------------------------ |
| `controlsTimeout` | `number` | Delay in milliseconds before controls behavior resumes |

```tsx
<VectrealViewer
	controlsOptions={{
		maxPolarAngle: Math.PI / 2,
		autoRotate: true,
		controlsTimeout: 2000
	}}
/>
```

---

## Camera snapshot callback

`onCameraSnapshotCaptureReady(capture)` gives you a function that captures the current viewer camera pose as `{ position, rotation, target, fov }`.

---

## Runtime commands and events

`VectrealViewer` exposes a small runtime interaction surface for surrounding app code.

### Commands

`onCommandExecutorReady(executor)` gives you a `ViewerCommandExecutor` with `execute(command)`.

Current commands:

| Command                | Payload                                                                                            | Effect                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `activate_camera`      | `{ cameraId: string }`                                                                             | Transitions to one of the configured scene cameras  |
| `set_controls_enabled` | `{ enabled: boolean }`                                                                             | Temporarily enables or disables orbit interaction   |
| `set_transition`       | `{ transitionType: 'none' \| 'linear' \| 'object_avoidance'; duration?: number; easing?: string }` | Overrides the active camera transition              |
| `set_auto_rotate`      | `{ enabled: boolean; speed?: number }`                                                             | Toggles and configures auto-rotation                |
| `set_controls_options` | `{ zoom?: boolean; pan?: boolean }`                                                                | Enables or disables zoom/pan interaction at runtime |

### Events

`onInteractionEvent(event)` emits the current viewer runtime events:

| Event                       | Payload                        | Meaning                                     |
| --------------------------- | ------------------------------ | ------------------------------------------- |
| `viewer_ready`              | none                           | Viewer runtime is ready to accept commands  |
| `initial_framing_completed` | `{ cameraId: string \| null }` | Initial framing and stabilization completed |
| `camera_changed`            | `{ cameraId: string }`         | Active camera changed                       |

```tsx
import { useRef } from 'react'
import { type ViewerCommandExecutor, VectrealViewer } from '@vctrl/viewer'

function ViewerRuntimeExample({ model }: { model: object }) {
	const executorRef = useRef<null | ViewerCommandExecutor>(null)

	return (
		<>
			<button
				onClick={() =>
					executorRef.current?.execute({
						type: 'activate_camera',
						cameraId: 'overview'
					})
				}
			>
				Go to overview
			</button>
			<button
				onClick={() =>
					executorRef.current?.execute({
						type: 'set_controls_enabled',
						enabled: false
					})
				}
			>
				Lock controls
			</button>
			<VectrealViewer
				model={model as never}
				onCommandExecutorReady={(executor) => {
					executorRef.current = executor
				}}
				onInteractionEvent={(event) => {
					console.log('viewer event', event)
				}}
			/>
		</>
	)
}
```

---

## Environment options (`EnvironmentProps`)

Configures the [@react-three/drei `Environment`](https://github.com/pmndrs/drei#environment) component. The viewer does not use Drei's `Stage`; framing is handled by `SceneBounds` and `SceneCamera`.

`envOptions` supports a typed preset system from `@vctrl/core`:

| Option                  | Type                 | Description                                                   |
| ----------------------- | -------------------- | ------------------------------------------------------------- |
| `preset`                | `EnvironmentKey`     | Preset key such as `studio-key`, `outdoor-noon`, `night-city` |
| `environmentResolution` | `'1k' \| '4k'`       | Resolution variant for environment assets                     |
| `background`            | `boolean`            | Render environment as scene background                        |
| `backgroundBlurriness`  | `number`             | Blur strength when background is enabled                      |
| `backgroundIntensity`   | `number`             | Background intensity multiplier                               |
| `environmentIntensity`  | `number`             | Lighting intensity multiplier                                 |
| `files`                 | `string \| string[]` | Custom environment files                                      |

```tsx
<VectrealViewer
	envOptions={{
		preset: 'studio-key',
		environmentResolution: '1k',
		background: true,
		backgroundBlurriness: 0.2,
		environmentIntensity: 1,
		backgroundIntensity: 1
	}}
/>
```

---

## Bounds and shadows

| Prop             | Type           | Summary                                              |
| ---------------- | -------------- | ---------------------------------------------------- |
| `boundsOptions`  | `BoundsProps`  | Pass-through to Drei `Bounds` behavior               |
| `shadowsOptions` | `ShadowsProps` | Baked accumulative shadow, with an optional contact pass |

### boundsOptions (`BoundsProps`)

`BoundsProps` is forwarded to Drei `Bounds`. The viewer defaults are:

| Option        | Default |
| ------------- | ------- |
| `clip`        | `false` |
| `margin`      | `1.5`   |
| `maxDuration` | `0`     |

`clip` is `false` because near/far planes are managed per frame in `SceneModel`, so
Drei's `Bounds` is deliberately kept from writing them.

`fit` is accepted for API compatibility but ignored: `SceneBounds` always passes
`fit={false}` to Drei's `Bounds` because `SceneCamera` drives fitting imperatively
via `bounds.reset().fit()`.

```tsx
<VectrealViewer
	boundsOptions={{
		clip: false,
		margin: 1.25,
		maxDuration: 300
	}}
/>
```

### shadowsOptions (`ShadowsProps`)

**Shadows are off by default.** `enabled` defaults to `false`, so every example below
needs `enabled: true` to render anything.

The `ShadowsProps` type is a `type`-discriminated union (`'accumulative' | 'contact'`),
but the viewer does not branch on it: whatever you pass is merged over the accumulative
defaults and rendered as Drei `AccumulativeShadows`. A contact shadow is not a separate
mode, it is an opt-in extra pass configured under the nested `contact` key.

Several numeric options are expressed **relative to the model's measured size**, not in
world units: `scale` is a multiple of the model footprint, and `light.radius` and
`light.position` are in model-size units. This keeps the bake proportioned for any model.

Viewer defaults:

| Option        | Default          |
| ------------- | ---------------- |
| `type`        | `'accumulative'` |
| `enabled`     | `false`          |
| `temporal`    | `true`           |
| `frames`      | `48`             |
| `alphaTest`   | `3.0`            |
| `cutoffScale` | `1`              |
| `opacity`     | `0.9`            |
| `scale`       | `2.5`            |
| `resolution`  | `1024`           |
| `colorBlend`  | `2`              |
| `color`       | `'#000000'`      |
| `ao`          | `false`          |
| `aoIntensity` | `1.4`            |

`alphaTest` is not a discard threshold. In Drei's `SoftShadowMaterial` the shadow alpha
is `max(0, 1 - planeBrightness / alphaTest) * opacity`, so it sits between the shadowed
and lit brightness of the bake plane. Shadow depth is driven by `light.ambient`, not by
`alphaTest`. `ao` enables screen-space crevice occlusion (N8AO), which runs every frame
and is opt-in for that reason.

Nested light defaults (`shadowsOptions.light`):

| Option      | Default       |
| ----------- | ------------- |
| `intensity` | `Math.PI * 2` |
| `amount`    | `8`           |
| `radius`    | `0.8`         |
| `ambient`   | `0.3`         |
| `position`  | `[0, 2.5, 0]` |
| `bias`      | `0.001`       |

Nested contact defaults (`shadowsOptions.contact`), an optional soft ground pass baked
once under the directional bake:

| Option    | Default |
| --------- | ------- |
| `enabled` | `false` |
| `opacity` | `0.6`   |
| `blur`    | `3`     |
| `scale`   | `1.5`   |
| `reach`   | `0.35`  |

```tsx
<VectrealViewer
	shadowsOptions={{
		enabled: true,
		temporal: true,
		frames: 48,
		opacity: 0.9,
		scale: 2.5,
		resolution: 1024,
		light: {
			amount: 8,
			radius: 0.8,
			ambient: 0.3,
			position: [1, 2.5, 1]
		},
		contact: {
			enabled: true,
			opacity: 0.6,
			blur: 3
		}
	}}
/>
```

---

## Screenshot callbacks

`VectrealViewer` supports two screenshot-related callbacks:

- `onScreenshot(dataUrl)` receives a data URL each time a screenshot is captured.
- `onScreenshotCaptureReady(capture)` gives you a capture function that can be stored and called from external UI.

The callback types are exported from `@vctrl/viewer` as `SceneScreenshotCapture` and `SceneScreenshotOptions`.

`SceneScreenshotOptions`:

| Option     | Type                           | Description                         |
| ---------- | ------------------------------ | ----------------------------------- |
| `width`    | `number`                       | Output width in pixels              |
| `height`   | `number`                       | Output height in pixels             |
| `mimeType` | `'image/jpeg' \| 'image/webp'` | Output format                       |
| `quality`  | `number`                       | Image quality hint for lossy output |
| `mode`     | `'auto-fit' \| 'viewport'`     | Capture strategy                    |

---

## Integration with `@vctrl/hooks`

The viewer is designed to be used alongside [`@vctrl/hooks`](https://vectreal.com/docs/packages/hooks), but it does not read from any hooks context. `VectrealViewer` renders whatever you give it through `model` or `children` and nothing otherwise, so the model always has to be passed explicitly.

`ModelProvider` and `useModelContext` are still the convenient way to share one loader across a component tree. Read the model out of the context and hand it to the viewer:

```tsx
import { ModelProvider, useModelContext } from '@vctrl/hooks/use-load-model'
import { VectrealViewer } from '@vctrl/viewer'
import '@vctrl/viewer/css'

function Scene() {
	const { file } = useModelContext()

	if (!file?.model) return null

	return <VectrealViewer model={file.model} />
}

export default function App() {
	return (
		<ModelProvider>
			<Scene />
		</ModelProvider>
	)
}
```

---

## Development

```bash
pnpm nx build vctrl/viewer
pnpm nx lint vctrl/viewer
pnpm nx typecheck vctrl/viewer
```

The viewer has no unit-test target. Its behavior is covered by the Playwright suite
in `packages/viewer-e2e`.

The viewer's stories live in the workspace-wide Storybook, alongside the shared
design system:

```bash
pnpm nx storybook storybook
```

---

## Notes

- Grid configuration is not currently active in `VectrealViewer` render flow.

---

## Related docs

- [Optimizing & Configuring](https://vectreal.com/docs/guides/optimize)
- [Publishing & Embedding](https://vectreal.com/docs/guides/publish-embed)
- [@vctrl/hooks](https://vectreal.com/docs/packages/hooks)

---

## Source

The full source and README live in [packages/viewer](https://github.com/Vectreal/vectreal-platform/tree/main/packages/viewer).

## License

AGPL-3.0-only. See [LICENSE.md](https://github.com/Vectreal/vectreal-platform/blob/main/packages/viewer/LICENSE.md).
