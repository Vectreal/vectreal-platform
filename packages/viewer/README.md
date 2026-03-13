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

| Prop                       | Type                                                | Required | Description                                                                      |
| -------------------------- | --------------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| `model`                    | `Object3D`                                          | No\*     | The Three.js scene to display. Optional when using the `use-load-model` context. |
| `className`                | `string`                                            | No       | Additional CSS classes for the viewer container                                  |
| `theme`                    | `'light' \| 'dark' \| 'system'`                     | No       | Viewer theme, default is `system`                                                |
| `enableViewportRendering`  | `boolean`                                           | No       | Render only while in viewport, default `true`                                    |
| `boundsOptions`            | `BoundsProps`                                       | No       | Scene bounds and framing behavior                                                |
| `cameraOptions`            | `CameraProps`                                       | No       | Perspective camera configuration                                                 |
| `controlsOptions`          | `ControlsProps`                                     | No       | OrbitControls configuration                                                      |
| `envOptions`               | `EnvironmentProps`                                  | No       | Stage and Environment component configuration                                    |
| `shadowsOptions`           | `ShadowsProps`                                      | No       | Shadow behavior configuration                                                    |
| `popover`                  | `React.ReactNode`                                   | No       | Optional info popover slot                                                       |
| `loader`                   | `React.ReactNode`                                   | No       | Custom loading UI                                                                |
| `loadingThumbnail`         | `ViewerLoadingThumbnail`                            | No       | Optional blurred loading thumbnail                                               |
| `onScreenshot`             | `(dataUrl: string) => void`                         | No       | Called when a screenshot is captured                                             |
| `onScreenshotCaptureReady` | `(capture: SceneScreenshotCapture \| null) => void` | No       | Receives a capture function for on-demand screenshots                            |

### Notes on content source

- `model` is optional because you can also render scene content via `children`.
- Grid options are currently typed but not active in render output.

---

## Camera options (`CameraProps`)

`cameraOptions` accepts:

```ts
type CameraProps = {
	cameras?: Array<
		PerspectiveCameraProps & {
			cameraId: string
			name: string
			initial?: boolean
			shouldAnimate?: boolean
			animationConfig?: {
				duration: number
				easing?: (t: number) => number
			}
		}
	>
}
```

Each camera entry extends `PerspectiveCameraProps` from Drei and adds viewer-specific camera switching metadata.

```tsx
<VectrealViewer
	cameraOptions={{
		cameras: [
			{
				cameraId: 'default',
				name: 'Default',
				initial: true,
				shouldAnimate: true,
				animationConfig: { duration: 900 },
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

## Environment options (`EnvironmentProps`)

Configures the [@react-three/drei `Stage`](https://github.com/pmndrs/drei#stage) and [@react-three/drei `Environment`](https://github.com/pmndrs/drei#environment) components.

`envOptions` supports a typed preset system from `@vctrl/core`:

| Option                  | Type                         | Description                                                   |
| ----------------------- | ---------------------------- | ------------------------------------------------------------- |
| `preset`                | `EnvironmentKey`             | Preset key such as `studio-key`, `outdoor-noon`, `night-city` |
| `environmentResolution` | `'1k' \| '4k'`               | Resolution variant for environment assets                     |
| `background`            | `boolean`                    | Render environment as scene background                        |
| `backgroundBlurriness`  | `number`                     | Blur strength when background is enabled                      |
| `backgroundIntensity`   | `number`                     | Background intensity multiplier                               |
| `environmentIntensity`  | `number`                     | Lighting intensity multiplier                                 |
| `ground`                | `EnvironmentProps['ground']` | Ground-projected environment options                          |
| `files`                 | `string \| string[]`         | Custom environment files                                      |

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
| `clip`        | `true`  |
| `margin`      | `1.5`   |
| `maxDuration` | `0`     |

```tsx
<VectrealViewer
	boundsOptions={{
		fit: true,
		clip: true,
		margin: 1.25,
		maxDuration: 300
	}}
/>
```

### shadowsOptions (`ShadowsProps`)

`ShadowsProps` is a discriminated union using `type`.

#### Contact shadows (`type: 'contact'`)

Viewer defaults:

| Option    | Default     |
| --------- | ----------- |
| `type`    | `'contact'` |
| `opacity` | `0.4`       |
| `blur`    | `0.1`       |
| `scale`   | `5`         |
| `color`   | `'#000000'` |
| `smooth`  | `true`      |

Commonly used ContactShadows fields:

| Option       | Type                         |
| ------------ | ---------------------------- |
| `opacity`    | `number`                     |
| `blur`       | `number`                     |
| `scale`      | `number \| [number, number]` |
| `far`        | `number`                     |
| `resolution` | `number`                     |
| `color`      | `string`                     |
| `frames`     | `number`                     |

```tsx
<VectrealViewer
	shadowsOptions={{
		type: 'contact',
		opacity: 0.45,
		blur: 1.8,
		scale: 6,
		far: 12,
		resolution: 1024,
		color: '#111111'
	}}
/>
```

#### Accumulative shadows (`type: 'accumulative'`)

Viewer defaults:

| Option       | Default          |
| ------------ | ---------------- |
| `type`       | `'accumulative'` |
| `temporal`   | `false`          |
| `frames`     | `30`             |
| `alphaTest`  | `0.35`           |
| `opacity`    | `1`              |
| `scale`      | `10`             |
| `resolution` | `1024`           |
| `colorBlend` | `2`              |
| `color`      | `'#000000'`      |

Nested light defaults (`shadowsOptions.light`):

| Option      | Default                                           |
| ----------- | ------------------------------------------------- |
| `intensity` | `1`                                               |
| `amount`    | `5`                                               |
| `radius`    | `7.5`                                             |
| `ambient`   | `0.5`                                             |
| `position`  | `[5, 10, 5]` or auto-calculated from scene bounds |

```tsx
<VectrealViewer
	shadowsOptions={{
		type: 'accumulative',
		temporal: true,
		frames: 40,
		alphaTest: 0.4,
		opacity: 0.95,
		scale: 12,
		resolution: 1024,
		colorBlend: 2,
		color: '#000000',
		light: {
			amount: 6,
			radius: 7,
			ambient: 0.5,
			intensity: 1,
			bias: 0.0001
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
pnpm nx test vctrl/viewer
pnpm nx storybook vctrl/viewer
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
