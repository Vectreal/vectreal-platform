# @vctrl/embed

[![npm](https://img.shields.io/npm/v/@vctrl/embed)](https://www.npmjs.com/package/@vctrl/embed)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-orange.svg)](https://www.gnu.org/licenses/agpl-3.0)

Framework-agnostic JavaScript SDK for controlling Vectreal embedded 3D scene previews from any web page.

## Installation

```bash
npm install @vctrl/embed
```

**Module format:** ES modules, plus the script-tag build below. Import it from any bundler, browser or Node.js; `require()` also loads it on Node.js 20.19, 22.12 and later.

**CDN (script tag, no bundler needed):** the package also ships a classic script that any npm CDN can serve. It defines one global, `VectrealEmbed`, a namespace object holding the entry point's named exports, so the class is `VectrealEmbed.VectrealEmbed`. The file keeps the name `vectreal-embed.umd.js` from when it was a UMD build, so existing snippets keep working.

```html
<script src="https://unpkg.com/@vctrl/embed/vectreal-embed.umd.js"></script>
<script>
	const embed = new VectrealEmbed.VectrealEmbed(
		document.getElementById('vectreal-scene')
	)
</script>
```

For production, pin a version (`@vctrl/embed@<version>`) and add a [Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) hash for it.

## Quick start

```html
<div style="width: 100%; height: 400px;">
	<iframe
		id="vectreal-scene"
		src="https://vectreal.com/embed/<projectId>/<sceneId>?token=YOUR_PREVIEW_API_KEY"
		style="width: 100%; height: 100%; border: 0;"
		allow="autoplay; xr-spatial-tracking"
		allowfullscreen
	></iframe>
</div>
```

Then, in your app code (a bundler such as Vite or webpack resolves the package name):

```ts
import { VectrealEmbed } from '@vctrl/embed'

const iframe = document.getElementById('vectreal-scene') as HTMLIFrameElement
const embed = new VectrealEmbed(iframe)

const { cameras, hotspots } = await embed.ready()
console.log('Available cameras:', cameras)
console.log('Hotspots a visitor can see:', hotspots)

embed.on('camera_changed', ({ cameraId }) => {
	console.log('Camera changed to:', cameraId)
})

embed.activateCamera('detail')
```

A browser cannot resolve `'@vctrl/embed'` on its own, so without a bundler, load the
script-tag build from [Installation](#installation) and create the SDK with
`new VectrealEmbed.VectrealEmbed(...)` instead of the `import`.

## API

### `new VectrealEmbed(iframe, options?)`

| Option         | Type     | Default                         | Description                                      |
| -------------- | -------- | ------------------------------- | ------------------------------------------------ |
| `iframeOrigin` | `string` | Auto-detected from `iframe.src` | Expected iframe origin for postMessage security. |
| `readyTimeout` | `number` | `15000` | ms before `ready()` rejects if the scene has not loaded. Queued commands still run once it does. |

### What you can control

Cameras and transitions, orbit/zoom/pan, animation playback, hotspots, scroll-driven
interactions, and named host messages - plus events for each. The full method and event
tables live in one place, the
[Embed SDK guide](https://vectreal.com/docs/guides/embed-sdk#api-reference), rather than
being repeated here where the two copies drift apart.

Two behaviours worth knowing before you read it:

The camera, controls, hotspot and animation methods are queued and flushed once the
viewer reports ready, so you can call them immediately after constructing the SDK.
`sendScrollProgress` and `sendMessage` are not queued: they post straight to the iframe,
and a call made before the viewer is ready is silently dropped. Await `ready()` before
wiring a scroll handler or sending a host message. `destroy()` discards anything still
queued.

The constructor throws when it cannot determine a target origin, which happens when
`iframeOrigin` is omitted and the iframe's `src` is empty or unparseable. Construct the
SDK after the `src` is set, or pass `iframeOrigin` explicitly.

## URL parameter shorthand

Opening state, color scheme and hotspot presentation can be set with query parameters on the iframe
`src`, no JavaScript required — `?camera`, `?autoRotate`, `?transition`, `?theme`,
`?hotspots`, `?hotspotContent` and `?hotspotColor`. Values and behaviour are tabled once, in the
[Embed SDK guide](https://vectreal.com/docs/guides/embed-sdk#url-parameters).

## Documentation

Full guide and examples: [vectreal.com/docs/guides/embed-sdk](https://vectreal.com/docs/guides/embed-sdk)

## License

AGPL-3.0-only. See [LICENSE.md](https://github.com/Vectreal/vectreal-platform/blob/main/LICENSE.md).

Part of the [Vectreal Platform](https://github.com/vectreal/vectreal-platform) monorepo.
