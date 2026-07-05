# @vctrl/viewer

[![NPM Downloads](https://img.shields.io/npm/dm/%40vctrl%2Fviewer?logo=npm&logoColor=%23fc6c18&label=%40vctrl%2Fviewer%20%7C%20NPM%20Downloads&color=%23fc6c18)](https://www.npmjs.com/package/@vctrl/viewer)
[![Storybook](https://img.shields.io/badge/Storybook-Docs-fc6c18?logo=storybook&logoColor=%23fc6c18)](https://main--672b9522ee5bda25942a731c.chromatic.com/?path=/docs/vectrealviewer--docs)

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
| `model`                        | `Object3D`                                              | No\*     | The Three.js scene to display. Optional when using the `use-load-model` context. |
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

| Command                | Payload                | Effect                                             |
| ---------------------- | ---------------------- | -------------------------------------------------- |
| `activate_camera`      | `{ cameraId: string }`                        | Transitions to one of the configured scene cameras |
| `set_controls_enabled` | `{ enabled: boolean }`                        | Temporarily enables or disables orbit interaction  |
| `set_transition`       | `{ transitionType: 'none' \| 'linear' \| 'object_avoidance'; duration?: number; easing?: string }` | Overrides the active camera transition |
| `set_auto_rotate`      | `{ enabled: boolean; speed?: number }`        | Toggles and configures auto-rotation               |
| `set_controls_options` | `{ zoom?: boolean; pan?: boolean }`           | Enables or disables zoom/pan interaction at runtime |

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

Configures the [@react-three/drei `Stage`](https://github.com/pmndrs/drei#stage) and [@react-three/drei `Environment`](https://github.com/pmndrs/drei#environment) components.

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
| `shadowsOptions` | `ShadowsProps` | Union of `accumulative` and `contact` shadow configs |

### boundsOptions (`BoundsProps`)

`BoundsProps` is forwarded to Drei `Bounds`. The viewer defaults are:

| Option        | Default |
| ------------- | ------- |
| `fit`         | `true`  |
| `clip`        | `false` |
| `margin`      | `1.5`   |
| `maxDuration` | `0`     |

`clip` defaults to `false` on purpose: the viewer manages camera near/far per frame (dynamic clipping) so Drei should not also write them.

```tsx
<VectrealViewer
	boundsOptions={{
		fit: true,
		clip: false,
		margin: 1.25,
		maxDuration: 300
	}}
/>
```

### shadowsOptions (`ShadowsProps`)

`ShadowsProps` is a discriminated union on `type`:

```ts
type ShadowsProps = AccumulativeShadowsProps | ContactShadowProps
```

The viewer's default configuration is `type: 'accumulative'` (with `enabled: false`, so shadows are off until you opt in). Accumulative shadows bake a high-quality soft shadow into a ground plane from a `RandomizedLight`; because the bake is camera-independent it stays valid while auto-rotate orbits the camera. Numeric controls (`scale`, `light.radius`, `light.position`) are expressed relative to the model's measured size, so they stay proportioned across models.

#### Accumulative shadows (`type: 'accumulative'`) — the default

Viewer defaults:

| Option       | Default          |
| ------------ | ---------------- |
| `type`       | `'accumulative'` |
| `enabled`    | `false`          |
| `temporal`   | `true`           |
| `frames`     | `48`             |
| `alphaTest`  | `3.0`            |
| `cutoffScale`| `1`              |
| `opacity`    | `0.9`            |
| `scale`      | `2.5`            |
| `resolution` | `1024`           |
| `colorBlend` | `2`              |
| `color`      | `'#000000'`      |
| `ao`         | `false`          |
| `aoIntensity`| `1.4`            |

> `alphaTest` here is not a discard threshold — in Drei's `SoftShadowMaterial` it scales the shadow alpha against the lit plane brightness, so the viewer's default sits at `3.0` (just below the measured lit brightness), and shadow depth is driven by `light.ambient` rather than `alphaTest`. `ao` enables screen-space ambient occlusion (N8AO); it reintroduces a postprocessing composer and runs every frame, so it is opt-in.

Nested light defaults (`shadowsOptions.light`, a Drei `RandomizedLight`):

| Option      | Default        | Notes                                                      |
| ----------- | -------------- | ---------------------------------------------------------- |
| `intensity` | `Math.PI * 2`  | Bright bake light, divided by `amount` per sub-light       |
| `amount`    | `8`            | Number of jittered light samples accumulated into the bake |
| `radius`    | `0.8`          | Positional jitter in model-size units (penumbra softness)  |
| `ambient`   | `0.3`          | Hemisphere fill; lower = darker shadow core (UI "Darkness")|
| `position`  | `[0, 2.5, 0]`  | Light direction in model-size units, scaled by model radius|
| `bias`      | `0.001`        | Shadow bias                                                |

Nested contact/ground shadow (`shadowsOptions.contact`, a `ContactShadowConfig`). This is a soft ground shadow layered under the accumulative bake to approximate ground ambient occlusion:

| Option    | Default | Notes                                                  |
| --------- | ------- | ------------------------------------------------------ |
| `enabled` | `false` | Whether the ground shadow is rendered                  |
| `opacity` | `0.6`   | Darkness of the ground shadow (0–1)                    |
| `blur`    | `3`     | Softness; higher is softer                             |
| `scale`   | `1.5`   | Plane size as a multiple of the model footprint        |
| `reach`   | `0.35`  | How far up the model the ground shadow reaches (0–1)   |

```tsx
<VectrealViewer
	shadowsOptions={{
		type: 'accumulative',
		enabled: true,
		temporal: true,
		frames: 48,
		opacity: 0.9,
		scale: 2.5,
		resolution: 1024,
		colorBlend: 2,
		color: '#000000',
		light: {
			amount: 8,
			radius: 0.8,
			ambient: 0.3,
			intensity: Math.PI * 2,
			position: [0, 2.5, 0],
			bias: 0.001
		},
		contact: { enabled: true, opacity: 0.6, blur: 3, scale: 1.5 }
	}}
/>
```

#### Contact shadows (`type: 'contact'`)

`ContactShadowProps` extends Drei's [`ContactShadows`](https://github.com/pmndrs/drei#contactshadows) props with `type: 'contact'`. Selecting this variant forwards your props to Drei `ContactShadows`; the viewer injects no default value set of its own for this variant (unlike the accumulative config above).

```tsx
<VectrealViewer
	shadowsOptions={{
		type: 'contact',
		enabled: true,
		opacity: 0.45,
		blur: 1.8,
		scale: 6,
		far: 12,
		resolution: 1024,
		color: '#111111'
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

The viewer is designed to be used alongside [`@vctrl/hooks`](https://vectreal.com/docs/packages/hooks). When you wrap your app with the `ModelProvider` context from `@vctrl/hooks`, the viewer can render with no explicit `model` prop:

```tsx
import { ModelProvider } from '@vctrl/hooks/use-load-model'
import { VectrealViewer } from '@vctrl/viewer'
import '@vctrl/viewer/css'

function Scene() {
	return <VectrealViewer />
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
pnpm nx storybook vctrl/viewer
pnpm nx test-storybook vctrl/viewer
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
