# @vctrl/hooks

[![NPM Downloads](https://img.shields.io/npm/dm/%40vctrl%2Fhooks?logo=npm&logoColor=%23fc6c18&label=%40vctrl%2Fhooks%20%7C%20NPM%20Downloads&color=%23fc6c18)](https://www.npmjs.com/package/@vctrl/hooks)

Browser-side React hooks for loading, optimizing, and exporting 3D models. The runtime counterpart to [`@vctrl/core`](https://vectreal.com/docs/packages/core), built for React apps that need to handle 3D files directly in the browser.

---

## Installation

```bash
npm install @vctrl/hooks
# or
pnpm add @vctrl/hooks
```

---

## Hooks overview

| Hook               | Import path                       | Description                                                                     |
| ------------------ | --------------------------------- | ------------------------------------------------------------------------------- |
| `useLoadModel`     | `@vctrl/hooks/use-load-model`     | Load and parse GLTF, GLB, and USDZ files from file lists or dropped directories |
| `useOptimizeModel` | `@vctrl/hooks/use-optimize-model` | Run glTF-Transform optimizations on loaded models                               |
| `useExportModel`   | `@vctrl/hooks/use-export-model`   | Export the current scene to GLB or glTF                                         |

---

## `useLoadModel`

Loads 3D files and exposes the parsed Three.js `Object3D` scene.

```tsx
import { ModelProvider, useLoadModel } from '@vctrl/hooks/use-load-model'

function Uploader() {
	const { load, file, isFileLoading } = useLoadModel()

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault()
		void load(Array.from(e.dataTransfer.files))
	}

	if (isFileLoading) return <p>Loading...</p>
	if (file?.model) return <p>Model loaded: {file.name}</p>

	return (
		<div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
			Drop a file
		</div>
	)
}

export default function App() {
	return (
		<ModelProvider>
			<Uploader />
		</ModelProvider>
	)
}
```

### Context and direct usage

`useLoadModel` can be used in two ways:

1. Context mode: wrap your app with `ModelProvider`, then consume with `useModelContext()` anywhere in that tree.
2. Direct mode: call `useLoadModel()` outside a provider to manage a local model state.

### Return values

| Value                      | Type                                 | Description                                                 |
| -------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| `file`                     | `ModelFile \| null`                  | Loaded file metadata and Three.js model                     |
| `isFileLoading`            | `boolean`                            | True while loading and parsing                              |
| `progress`                 | `number`                             | Progress value from 0 to 100                                |
| `load(filesOrDirectories)` | `Promise<void>`                      | Load files or dropped `FileSystemDirectoryHandle` entries   |
| `loadFromData(options)`    | `Promise<SceneLoadResult>`           | Load already-resolved server scene payload                  |
| `loadFromServer(options)`  | `Promise<SceneLoadResult>`           | Fetch and load scene from an API endpoint                   |
| `reset`                    | `() => void`                         | Clear the current model                                     |
| `on` / `off`               | Event helpers                        | Subscribe and unsubscribe to loader lifecycle events        |
| `optimizer`                | `OptimizerIntegrationReturn \| null` | Populated when the hook is called with `useOptimizeModel()` |

### `useLoadModel` events

`on` and `off` support these typed events:

| Event                  | Payload             |
| ---------------------- | ------------------- |
| `multiple-models`      | `File[]`            |
| `not-loaded-files`     | `File[]`            |
| `load-start`           | `null`              |
| `load-progress`        | `number`            |
| `load-complete`        | `ModelFile \| null` |
| `load-reset`           | `null`              |
| `load-error`           | `Error \| unknown`  |
| `server-load-start`    | `string`            |
| `server-load-complete` | `SceneLoadResult`   |
| `server-load-error`    | `Error \| unknown`  |

### Scene loading option types

`loadFromServer(options)` uses:

| Field           | Type            | Description                                   |
| --------------- | --------------- | --------------------------------------------- |
| `sceneId`       | `string`        | Scene identifier to fetch                     |
| `serverOptions` | `ServerOptions` | Endpoint, auth, and header configuration      |
| `applySettings` | `boolean`       | Whether scene settings are applied after load |

`loadFromData(options)` uses:

| Field           | Type                  | Description                                                    |
| --------------- | --------------------- | -------------------------------------------------------------- |
| `sceneId`       | `string \| undefined` | Optional scene identifier                                      |
| `sceneData`     | `ServerSceneData`     | Already-resolved payload containing glTF, settings, and assets |
| `applySettings` | `boolean`             | Whether scene settings are applied after load                  |

---

## `useOptimizeModel`

Runs mesh simplification and texture compression using [glTF-Transform](https://gltf-transform.dev) in a Web Worker.

```tsx
import { useOptimizeModel } from '@vctrl/hooks/use-optimize-model'
import { useLoadModel } from '@vctrl/hooks/use-load-model'

function Optimizer() {
	const optimizer = useOptimizeModel()
	const { file, optimizer: integrated } = useLoadModel(optimizer)

	const handleOptimize = async () => {
		if (!file?.model || !integrated) return
		await integrated.applyOptimization(integrated.simplifyOptimization, {
			ratio: 0.6,
			error: 0.001
		})
	}

	return (
		<button onClick={handleOptimize} disabled={optimizer.loading}>
			{optimizer.loading ? 'Optimizing...' : 'Optimize model'}
		</button>
	)
}
```

### Key API surface

| Method / State                       | Type                                                               | Description                                                            |
| ------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `load(model)`                        | `(model: Object3D) => Promise<void>`                               | Load a Three.js scene into the optimizer                               |
| `loadFromServerSceneData(sceneData)` | `Promise<void>`                                                    | Initialize optimizer from a server scene payload                       |
| `applyOptimization(fn, opts?)`       | `<T>(fn?: (opts?: T) => Promise<void>, opts?: T) => Promise<void>` | Apply optimization and sync the optimized model back into loader state |
| `simplifyOptimization(options?)`     | `Promise<void>`                                                    | Simplify mesh geometry                                                 |
| `dedupOptimization(options?)`        | `Promise<void>`                                                    | Deduplicate model data                                                 |
| `quantizeOptimization(options?)`     | `Promise<void>`                                                    | Quantize vertex attributes                                             |
| `normalsOptimization(options?)`      | `Promise<void>`                                                    | Recompute or normalize normals                                         |
| `texturesOptimization(options?)`     | `Promise<void>`                                                    | Run texture compression flow                                           |
| `getModel()`                         | `Promise<Uint8Array \| null>`                                      | Export the current optimized model as GLB binary                       |
| `report` / `info`                    | Objects                                                            | Optimization metrics and derived stats                                 |
| `loading` / `error`                  | State                                                              | Optimization status                                                    |

### Optimization option types

`useOptimizeModel` methods map directly to `@vctrl/core/model-optimizer` option types:

| Method                 | Option fields                                                                                                                                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `simplifyOptimization` | `ratio?: number`, `error?: number`                                                                                                                                                                                                                   |
| `dedupOptimization`    | `textures?: boolean`, `materials?: boolean`, `meshes?: boolean`, `accessors?: boolean`                                                                                                                                                               |
| `quantizeOptimization` | `quantizePosition?: number`, `quantizeNormal?: number`, `quantizeColor?: number`, `quantizeTexcoord?: number`                                                                                                                                        |
| `normalsOptimization`  | `overwrite?: boolean`                                                                                                                                                                                                                                |
| `texturesOptimization` | `resize?: [number, number]`, `targetFormat?: 'webp' \| 'jpeg' \| 'png'`, `quality?: number`, `requestTimeoutMs?: number`, `maxTextureUploadBytes?: number`, `maxRetries?: number`, `maxConcurrentRequests?: number`, `serverOptions?: ServerOptions` |

`serverOptions` is provided by `@vctrl/core` and supports endpoint, API key, and headers.

---

## `useExportModel`

Exports the current scene from `ModelProvider` context to a downloadable file.

```tsx
import { useExportModel } from '@vctrl/hooks/use-export-model'
import type { ModelFile } from '@vctrl/hooks/use-load-model'

function ExportButton({ file }: { file: ModelFile | null }) {
	const { handleThreeGltfExport } = useExportModel()

	return (
		<button onClick={() => void handleThreeGltfExport(file, true)}>
			Download GLB
		</button>
	)
}
```

### Methods

| Method                                                         | Description                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `handleThreeGltfExport(file, binary)`                          | Export a loaded Three.js model to `.glb` or a zipped `.gltf` bundle |
| `handleDocumentGltfExport(document, file, binary?, download?)` | Export from a glTF-Transform `Document`                             |

`binary = true` writes `.glb`; `binary = false` writes a zipped `.gltf` package.

---

## Additional exports

- `ServerCommunicationService` from `@vctrl/hooks`
- `reconstructGltfFiles` from `@vctrl/hooks`
- `ModelProvider` and `useModelContext` from `@vctrl/hooks/use-load-model`
- Shared types such as `ModelFile`, `SceneLoadResult`, and `ServerSceneData`

`ServerCommunicationService` methods:

| Method                                             | Description               |
| -------------------------------------------------- | ------------------------- |
| `request(config)`                                  | Generic request helper    |
| `get(endpoint, serverOptions?)`                    | Convenience GET           |
| `post(endpoint, body, serverOptions?)`             | Convenience JSON POST     |
| `postFormData(endpoint, formData, serverOptions?)` | Convenience FormData POST |

`ServerRequestConfig` fields:

| Field           | Type                                              |
| --------------- | ------------------------------------------------- |
| `endpoint`      | `string`                                          |
| `method`        | `'GET' \| 'POST' \| 'PUT' \| 'DELETE' \| 'PATCH'` |
| `body`          | `FormData \| Record<string, unknown> \| string`   |
| `serverOptions` | `ServerOptions`                                   |
| `contentType`   | `string`                                          |

---

## Peer dependencies

| Package              | Version        |
| -------------------- | -------------- |
| `react`              | `^18 \|\| ^19` |
| `three`              | `^0.170`       |
| `@react-three/fiber` | `^9`           |

---

## Related docs

- [Uploading Models](https://vectreal.com/docs/guides/upload)
- [Optimizing & Configuring](https://vectreal.com/docs/guides/optimize)
- [@vctrl/viewer](https://vectreal.com/docs/packages/viewer)

---

## Source

The full source and README live in [packages/hooks](https://github.com/Vectreal/vectreal-platform/tree/main/packages/hooks).

## License

AGPL-3.0-only. See [LICENSE.md](https://github.com/Vectreal/vectreal-platform/blob/main/packages/hooks/LICENSE.md).
