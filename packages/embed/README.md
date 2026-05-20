# @vctrl/embed

[![npm](https://img.shields.io/npm/v/@vctrl/embed)](https://www.npmjs.com/package/@vctrl/embed)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-orange.svg)](https://www.gnu.org/licenses/agpl-3.0)

Framework-agnostic JavaScript SDK for controlling Vectreal embedded 3D scene previews from any web page.

## Installation

```bash
npm install @vctrl/embed
```

**CDN (UMD — no bundler needed):**

```html
<script src="https://cdn.vectreal.com/embed/latest/vectreal-embed.umd.js"></script>
```

## Quick start

```html
<div style="width: 100%; height: 400px;">
  <iframe
    id="vectreal-scene"
    src="https://vectreal.com/preview/fullscreen/<projectId>/<sceneId>?token=YOUR_PREVIEW_API_KEY"
    style="width: 100%; height: 100%; border: 0;"
    allow="autoplay; xr-spatial-tracking"
    allowfullscreen
  ></iframe>
</div>

<script type="module">
  import { VectrealEmbed } from '@vctrl/embed'

  const embed = new VectrealEmbed(
    document.getElementById('vectreal-scene')
  )

  const { cameras } = await embed.ready()
  console.log('Available cameras:', cameras)

  embed.on('camera_changed', ({ cameraId }) => {
    console.log('Camera changed to:', cameraId)
  })

  embed.activateCamera('detail')
</script>
```

## API

### `new VectrealEmbed(iframe, options?)`

| Option | Type | Default | Description |
|---|---|---|---|
| `iframeOrigin` | `string` | Auto-detected from `iframe.src` | Expected iframe origin for postMessage security. |
| `readyTimeout` | `number` | `15000` | ms before `ready()` rejects. |

### Methods

| Method | Description |
|---|---|
| `ready()` | Resolves with `{ sceneId, cameras }` when the viewer is ready. |
| `activateCamera(cameraId)` | Switch to a named camera. |
| `setTransition(options)` | Override transition type, duration, and easing. |
| `setControlsEnabled(enabled)` | Enable or disable orbit controls. |
| `setAutoRotate(enabled, speed?)` | Toggle auto-rotate. |
| `setZoomEnabled(enabled)` | Toggle scroll-zoom. |
| `setPanEnabled(enabled)` | Toggle right-click pan. |
| `sendScrollProgress(progress)` | Drive scroll-triggered interactions (0–1). |
| `sendMessage(message, payload?)` | Trigger a named `host_message` interaction. |
| `on(type, handler)` | Subscribe to a viewer event. Returns unsubscribe. |
| `off(type, handler)` | Remove a specific handler. |
| `destroy()` | Remove all listeners and stop processing messages. |

### Events

| Type | Payload | When |
|---|---|---|
| `viewer_ready` | `void` | Viewer command surface is registered. |
| `model_loaded` | `void` | Model finished loading and initial framing is complete. |
| `camera_changed` | `{ cameraId }` | Active camera changed. |
| `auto_rotate_changed` | `{ enabled }` | Auto-rotate state changed. |
| `interaction_event` | `{ eventName, interactionId?, payload? }` | Publisher custom event fired. |

## URL parameter shorthand

For static initial configuration without JavaScript, add query parameters to the iframe `src`:

| Parameter | Example | Effect |
|---|---|---|
| `?camera=<id>` | `?camera=hero` | Activates a camera on `viewer_ready`. |
| `?autoRotate=0` | `?autoRotate=1` | Overrides stored auto-rotate state. |
| `?transition=<type>` | `?transition=linear` | Overrides stored transition type. |

## Documentation

Full guide and examples: [vectreal.com/docs/guides/embed-sdk](https://vectreal.com/docs/guides/embed-sdk)

## License

AGPL-3.0-only — see [LICENSE](https://github.com/vectreal/vectreal-platform/blob/main/LICENSE).

Part of the [Vectreal Platform](https://github.com/vectreal/vectreal-platform) monorepo.
