# @vctrl/viewer

React component package for rendering and interacting with 3D scenes.

## Installation

```bash
npm install @vctrl/viewer
# or
pnpm add @vctrl/viewer
```

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

You must import `@vctrl/viewer/css`.

## VectrealViewer props

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `model` | `Object3D` | No | Model to render. Optional when using children/context-driven scene content. |
| `className` | `string` | No | Additional classes on viewer container |
| `theme` | `'light' \| 'dark' \| 'system'` | No | Viewer theme, default is `system` |
| `enableViewportRendering` | `boolean` | No | Render only when visible in viewport, default `true` |
| `boundsOptions` | `BoundsProps` | No | Scene bounds and framing options |
| `cameraOptions` | `CameraProps` | No | Camera behavior options |
| `controlsOptions` | `ControlsProps` | No | Orbit controls options |
| `envOptions` | `EnvironmentProps` | No | Stage/environment options |
| `shadowsOptions` | `ShadowsProps` | No | Shadow options |
| `popover` | `React.ReactNode` | No | Optional popover slot |
| `loader` | `React.ReactNode` | No | Optional loader UI |
| `loadingThumbnail` | `ViewerLoadingThumbnail` | No | Optional loading thumbnail |
| `onScreenshot` | `(dataUrl: string) => void` | No | Called when screenshot is captured |
| `onScreenshotCaptureReady` | `(capture: SceneScreenshotCapture \| null) => void` | No | Called with a capture function for programmatic screenshots |

## Option details

### cameraOptions

`cameraOptions` uses `CameraProps` from `@vctrl/core`:

```ts
type CameraProps = {
  cameras?: Array<PerspectiveCameraProps & {
    cameraId: string
    name: string
    initial?: boolean
    shouldAnimate?: boolean
    animationConfig?: {
      duration: number
      easing?: (t: number) => number
    }
  }>
}
```

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

### controlsOptions

`controlsOptions` extends Drei `OrbitControlsProps` and adds:

- `controlsTimeout?: number`

### envOptions

`envOptions` supports the following fields:

| Option | Type | Description |
| --- | --- | --- |
| `preset` | `EnvironmentKey` | Preset key such as `studio-key`, `outdoor-noon`, `night-city` |
| `environmentResolution` | `'1k' \| '4k'` | Environment asset resolution |
| `background` | `boolean` | Enable background rendering |
| `backgroundBlurriness` | `number` | Background blur amount |
| `backgroundIntensity` | `number` | Background brightness |
| `environmentIntensity` | `number` | Light intensity |
| `ground` | `EnvironmentProps['ground']` | Ground-projection settings |
| `files` | `string \| string[]` | Custom environment map files |

```tsx
<VectrealViewer
  envOptions={{
    preset: 'studio-key',
    environmentResolution: '1k',
    background: true,
    backgroundBlurriness: 0.2,
    environmentIntensity: 1,
    backgroundIntensity: 1,
  }}
/>
```

### shadowsOptions

`shadowsOptions` supports two modes:

- `type: 'contact'` (contact shadows)
- `type: 'accumulative'` (accumulative shadows with optional randomized light)

#### boundsOptions (`BoundsProps`)

`BoundsProps` is forwarded to Drei `Bounds`. Viewer defaults:

| Option | Default |
| --- | --- |
| `fit` | `true` |
| `clip` | `true` |
| `margin` | `1.5` |
| `maxDuration` | `0` |

```tsx
<VectrealViewer
  boundsOptions={{
    fit: true,
    clip: true,
    margin: 1.25,
    maxDuration: 300,
  }}
/>
```

#### contact shadow options (`type: 'contact'`)

Viewer defaults:

| Option | Default |
| --- | --- |
| `type` | `'contact'` |
| `opacity` | `0.4` |
| `blur` | `0.1` |
| `scale` | `5` |
| `color` | `'#000000'` |
| `smooth` | `true` |

Common fields:

| Option | Type |
| --- | --- |
| `opacity` | `number` |
| `blur` | `number` |
| `scale` | `number \| [number, number]` |
| `far` | `number` |
| `resolution` | `number` |
| `color` | `string` |
| `frames` | `number` |

#### accumulative shadow options (`type: 'accumulative'`)

Viewer defaults:

| Option | Default |
| --- | --- |
| `type` | `'accumulative'` |
| `temporal` | `false` |
| `frames` | `30` |
| `alphaTest` | `0.35` |
| `opacity` | `1` |
| `scale` | `10` |
| `resolution` | `1024` |
| `colorBlend` | `2` |
| `color` | `'#000000'` |

`light` defaults:

| Option | Default |
| --- | --- |
| `intensity` | `1` |
| `amount` | `5` |
| `radius` | `7.5` |
| `ambient` | `0.5` |
| `position` | `[5, 10, 5]` (or auto-calculated from scene bounds) |

### screenshot options

`SceneScreenshotOptions` fields:

- `width?: number`
- `height?: number`
- `mimeType?: 'image/jpeg' | 'image/webp'`
- `quality?: number`
- `mode?: 'auto-fit' | 'viewport'`

## Exported types

- `VectrealViewerProps`
- `SceneScreenshotCapture`
- `SceneScreenshotOptions`
- `ViewerLoadingThumbnail`

## Notes

- Grid configuration is not currently active in `VectrealViewer` render flow.
- For model loading state, pair this package with `@vctrl/hooks/use-load-model`.

## Related app docs

- [Package reference page](https://vectreal.com/docs/packages/viewer)
- [Optimize and configure guide](https://vectreal.com/docs/guides/optimize)
- [Publishing and embedding guide](https://vectreal.com/docs/guides/publish-embed)

## License

AGPL-3.0-only - See LICENSE.md for details.
