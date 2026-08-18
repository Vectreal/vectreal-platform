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
import { useLoadModel } from '@vctrl/hooks/use-load-model'

function Uploader() {
	const { load, status, file, error } = useLoadModel()

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault()
		void load({ kind: 'files', files: Array.from(e.dataTransfer.files) })
	}

	if (status === 'loading') return <p>Loading...</p>
	if (status === 'error') return <p>{error.message}</p>
	if (status === 'ready') return <p>Model loaded: {file.name}</p>

	return (
		<div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
			Drop a file
		</div>
	)
}
```

`useLoadModel` holds its own model. To share one across a tree, mount
`ModelProvider` and read it with `useModelContext`; see below.

### One entry point, one state

`load(source)` handles every way a model arrives, and the hook's state is a
discriminated union on `status`. `status === 'ready'` and a non-null `file` are
the same fact, so there is no separate loading flag to fall out of step with
what is on screen.

`load` never rejects. It resolves to the terminal state, and for every source
but `files` that is also the state you are rendering from.

A rejected `files` load is the exception, on purpose: it leaves the model
already on screen exactly as it was, so dropping the wrong file does not cost
the user their scene, and reports the failure only through the resolved value.
Branch on what `load` returns to react to an upload that did not take.
`reset()` is how you clear a model deliberately.

A newer `load` supersedes an older one, so a slow response can never overwrite
the load that replaced it.

### Sources

| `kind`       | Fields                                                        | Use                                                                                              |
| ------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `files`      | `files: (File \| FileSystemDirectoryHandle)[]`                 | A user upload: GLB, USDZ, or glTF with its sibling assets                                        |
| `scene-data` | `sceneData: ServerScenePayload`, `sceneId?`, `parseMode?`      | A payload you already hold. Binary assets may be referenced rather than inlined; the loader fetches them |
| `server`     | `sceneId: string`, `serverOptions?`, `parseMode?`              | Fetch a scene from an API endpoint by id                                                         |

`parseMode: 'direct'` parses the glTF JSON with its assets in memory and skips
the optimizer: the read-only fast path for viewers. The default reconstructs
files so the optimizer can ingest exactly what the viewer renders.

### Context and direct usage

`useLoadModel` can be used in two ways:

1. Context mode: wrap your app with `ModelProvider`, then consume with `useModelContext()` anywhere in that tree.
2. Direct mode: call `useLoadModel()` outside a provider to manage a local model state.

### Return values

| Value          | Type                                              | Description                                                       |
| -------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| `status`       | `'empty' \| 'loading' \| 'ready' \| 'error'`      | The load, as one value                                            |
| `file`         | `ModelFile \| null`                               | Loaded file metadata and Three.js model. Non-null exactly when `status` is `'ready'` |
| `error`        | `StructuredLoadError \| null`                     | Non-null exactly when `status` is `'error'`                       |
| `sceneData`    | `ServerSceneData \| undefined`                    | The resolved payload, for scene sources                           |
| `progress`     | `number`                                          | Progress value from 0 to 100                                      |
| `source`       | `'files' \| 'scene-data' \| 'server' \| null`     | What the current state came from                                  |
| `load(source)` | `Promise<ModelState>`                             | Load a model; resolves to the terminal state                      |
| `reset`        | `() => void`                                      | Clear the current model and retire any load in flight             |
| `optimizer`    | `OptimizerIntegrationReturn<true> \| null`        | Populated when the hook is called with `useOptimizeModel()`       |

### Error codes

`error.code` is one of `unsupported_format`, `multiple_models`,
`binary_load_failed`, `gltf_load_failed`, `missing_assets`,
`server_load_failed`, `not_found`, `quota_exceeded`, `unknown`. Optimizer
ingest is deliberately not among them: the model is already on screen by then,
so a failure there costs the optimize step and is reported on
`optimizer.error`.

---

## `useOptimizeModel`

Runs mesh simplification, deduplication, quantization, and normals optimization using [glTF-Transform](https://gltf-transform.dev), plus texture compression via browser-native OffscreenCanvas encoding. Every pass runs on the calling thread: this package spawns no Web Worker. If you need the work off the main thread, run the hook inside a worker you own, as the Vectreal Platform does.

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
| `simplifyOptimization(options?)`     | `Promise<void>`                                                    | Simplify mesh geometry                                                 |
| `dedupOptimization(options?)`        | `Promise<void>`                                                    | Deduplicate model data                                                 |
| `quantizeOptimization(options?)`     | `Promise<void>`                                                    | Quantize vertex attributes                                             |
| `normalsOptimization(options?)`      | `Promise<void>`                                                    | Recompute or normalize normals                                         |
| `texturesOptimization(options?)`     | `Promise<void>`                                                    | Run texture compression flow                                           |
| `getModel()`                         | `Promise<Uint8Array \| null>`                                      | Export the current optimized model as GLB binary                       |
| `report` / `info`                    | Objects                                                            | Optimization metrics and derived stats                                 |
| `loading` / `error`                  | State                                                              | Optimization status                                                    |

> `applyOptimization(fn, opts?)` is **not** returned by `useOptimizeModel` directly. It becomes available on the `optimizer` object returned by `useLoadModel(optimizer)` when you pass an optimizer instance in; it runs an optimization step and syncs the result back into loader state (see the example above).

### Optimization option types

`useOptimizeModel` methods map directly to `@vctrl/core/model-optimizer` option types:

| Method                 | Option fields                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `simplifyOptimization` | `ratio?: number`, `error?: number`                                                                            |
| `dedupOptimization`    | `textures?: boolean`, `materials?: boolean`, `meshes?: boolean`, `accessors?: boolean`                        |
| `quantizeOptimization` | `quantizePosition?: number`, `quantizeNormal?: number`, `quantizeColor?: number`, `quantizeTexcoord?: number` |
| `normalsOptimization`  | `overwrite?: boolean`                                                                                         |
| `texturesOptimization` | `resize?: [number, number]`, `targetFormat?: 'webp' \| 'jpeg' \| 'png'`, `quality?: number`                   |

Texture compression runs browser-native via `OffscreenCanvas`. No server call is made.

---

## `useExportModel`

Exports a `ModelFile` to a downloadable file. The hook takes optional `onSaved` and `onError` callbacks; the model itself is passed to the export method as an argument, not read from `ModelProvider` context.

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

| Method                                                         | Description                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `handleThreeGltfExport(file, binary)`                          | Export a loaded Three.js model to `.glb` or a zipped `.gltf` bundle    |
| `handleThreeUsdzExport(file)`                                  | Export a loaded Three.js model to `.usdz` for AR QuickLook             |
| `handleDocumentGltfExport(document, file, binary?, download?)` | Export from a glTF-Transform `Document`                                |
| `handleDocumentGlbDracoExport(document, file)`                 | Export a `Document` to `.glb` with Draco geometry compression          |

`binary = true` writes `.glb`; `binary = false` writes a zipped `.gltf` package. Pass
`download = false` to `handleDocumentGltfExport` to get the `GLTFExportResult` back
instead of saving a file.

---

## Additional exports

- `reconstructGltfFiles` and `createBrowserTextureEncoder` from `@vctrl/hooks`
- `ModelProvider` and `useModelContext` from `@vctrl/hooks/use-load-model`
- Shared types such as `ModelFile`, `SceneLoadResult`, `ServerSceneData`, and `OptimizerIntegrationReturn`

`createBrowserTextureEncoder()` returns the `OffscreenCanvas` encoder the hook injects
into `texturesOptimization`. Pass it as `ModelOptimizer#compressTextures`'s
`encoder` option when driving the optimizer directly.

---

## Peer dependencies

| Package | Version        |
| ------- | -------------- |
| `react` | `^18 \|\| ^19` |
| `three` | see below      |

Install `three` yourself and declare it explicitly in your own `package.json`, so your
project resolves exactly one copy: Three.js uses global singletons internally and
duplicate instances produce subtle rendering bugs. Let your package manager resolve the
version against the declared peer range rather than pinning one from this document.

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
