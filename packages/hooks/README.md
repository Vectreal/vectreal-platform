# @vctrl/hooks

Browser-side React hooks for loading, optimizing, and exporting 3D models.

## Installation

```bash
npm install @vctrl/hooks
# or
pnpm add @vctrl/hooks
```

## Import paths

`@vctrl/hooks` exposes public entrypoints via subpath imports:

- `@vctrl/hooks/use-load-model`
- `@vctrl/hooks/use-optimize-model`
- `@vctrl/hooks/use-export-model`

From the package root (`@vctrl/hooks`), utility exports are available:

- `ServerCommunicationService`
- `reconstructGltfFiles`
- shared types from `use-load-model/types`

## Hooks

### useLoadModel

```tsx
import { useLoadModel } from '@vctrl/hooks/use-load-model'

function Uploader() {
	const { load, file, isFileLoading, progress } = useLoadModel()

	return (
		<>
			<input
				type="file"
				onChange={(e) => {
					const files = Array.from(e.currentTarget.files ?? [])
					void load(files)
				}}
			/>
			{isFileLoading ? <p>Loading: {progress}%</p> : null}
			{file?.model ? <p>Loaded: {file.name}</p> : null}
		</>
	)
}
```

Primary return API:

- `load(filesOrDirectories)`
- `loadFromData(options)`
- `loadFromServer(options)`
- `file`, `isFileLoading`, `progress`
- `on(event, handler)` / `off(event, handler)`
- `reset()`
- `optimizer` (when initialized with `useOptimizeModel()`)

Supported events via `on`/`off`:

- `multiple-models`
- `not-loaded-files`
- `load-start`
- `load-progress`
- `load-complete`
- `load-reset`
- `load-error`
- `server-load-start`
- `server-load-complete`
- `server-load-error`

Scene loading option types:

- `loadFromServer({ sceneId, serverOptions?, applySettings? })`
- `loadFromData({ sceneId?, sceneData, applySettings? })`

### ModelProvider and useModelContext

`ModelProvider` and `useModelContext` are exported from `@vctrl/hooks/use-load-model`.

```tsx
import { ModelProvider, useModelContext } from '@vctrl/hooks/use-load-model'

function Toolbar() {
	const { reset } = useModelContext()
	return <button onClick={reset}>Reset</button>
}

function App() {
	return (
		<ModelProvider>
			<Toolbar />
		</ModelProvider>
	)
}
```

### useOptimizeModel

```tsx
import { useOptimizeModel } from '@vctrl/hooks/use-optimize-model'

const optimizer = useOptimizeModel()
```

Primary methods/state:

- `load(model)`
- `loadFromServerSceneData(sceneData)`
- `simplifyOptimization(options?)`
- `dedupOptimization(options?)`
- `quantizeOptimization(options?)`
- `normalsOptimization(options?)`
- `texturesOptimization(options?)`
- `getModel()`
- `report`, `info`, `loading`, `error`, `reset`

Optimization option details:

- `simplifyOptimization`: `{ ratio?: number; error?: number }`
- `dedupOptimization`: `{ textures?: boolean; materials?: boolean; meshes?: boolean; accessors?: boolean }`
- `quantizeOptimization`: `{ quantizePosition?: number; quantizeNormal?: number; quantizeColor?: number; quantizeTexcoord?: number }`
- `normalsOptimization`: `{ overwrite?: boolean }`
- `texturesOptimization`: `{ resize?: [number, number]; targetFormat?: 'webp' | 'jpeg' | 'png'; quality?: number; requestTimeoutMs?: number; maxTextureUploadBytes?: number; maxRetries?: number; maxConcurrentRequests?: number; serverOptions?: ServerOptions }`

### useExportModel

```tsx
import { useExportModel } from '@vctrl/hooks/use-export-model'
import type { ModelFile } from '@vctrl/hooks/use-load-model'

function ExportActions({ file }: { file: ModelFile | null }) {
	const { handleThreeGltfExport } = useExportModel()

	return (
		<>
			<button onClick={() => void handleThreeGltfExport(file, true)}>
				Export GLB
			</button>
			<button onClick={() => void handleThreeGltfExport(file, false)}>
				Export GLTF ZIP
			</button>
		</>
	)
}
```

Available methods:

- `handleThreeGltfExport(file, binary)`
- `handleDocumentGltfExport(document, file, binary?, download?)`

`binary = true` exports `.glb`; `binary = false` exports a zipped `.gltf` package.

## ServerCommunicationService

Also exported from `@vctrl/hooks` root:

- `ServerCommunicationService.request(config)`
- `ServerCommunicationService.get(endpoint, serverOptions?)`
- `ServerCommunicationService.post(endpoint, body, serverOptions?)`
- `ServerCommunicationService.postFormData(endpoint, formData, serverOptions?)`

`ServerRequestConfig` fields:

- `endpoint: string`
- `method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'`
- `body?: FormData | Record<string, unknown> | string`
- `serverOptions?: ServerOptions`
- `contentType?: string`

## Supported model formats

- `.gltf`
- `.glb`
- `.usdz`

## Peer dependencies

- `react`
- `three`

## Related app docs

- [Package reference page](https://vectreal.com/docs/packages/hooks)
- [Upload guide](https://vectreal.com/docs/guides/upload)
- [Optimize and configure guide](https://vectreal.com/docs/guides/optimize)

## License

AGPL-3.0-only - See LICENSE.md for details.
