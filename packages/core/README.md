# @vctrl/core

Server-side 3D model processing for Node.js. This package provides the shared loading, optimization, and export pipeline used by other Vectreal packages.

---

## Installation

```bash
npm install @vctrl/core
# or
pnpm add @vctrl/core
```

> `@vctrl/core` targets Node.js only. It uses [Sharp](https://sharp.pixelplumbing.com) for server-side texture compression, which requires a native build.

---

## Module overview

| Module           | Import path                   | Description                                                        |
| ---------------- | ----------------------------- | ------------------------------------------------------------------ |
| `ModelLoader`    | `@vctrl/core/model-loader`    | Load model files into glTF-Transform `Document` or Three.js scenes |
| `ModelOptimizer` | `@vctrl/core/model-optimizer` | Run optimization passes and export optimized output                |
| `ModelExporter`  | `@vctrl/core/model-exporter`  | Export `Document` or Three.js objects to GLB or GLTF               |
| `SceneAsset`     | `@vctrl/core`                 | Scene asset serialization helpers and shared server payload types  |

---

## `ModelLoader`

```ts
import { ModelLoader } from '@vctrl/core/model-loader'
import { readFile } from 'node:fs/promises'

const loader = new ModelLoader()

const result = await loader.loadFromFile('model.glb')

const buffer = await readFile('model.glb')
const resultFromBuffer = await loader.loadFromBuffer(
	new Uint8Array(buffer),
	'model.glb'
)

const sceneResult = await loader.loadToThreeJS('model.glb')
```

### Export methods

| Method                                                    | Description                                           |
| --------------------------------------------------------- | ----------------------------------------------------- |
| `loadFromFile(input)`                                     | Load from file path in Node or browser `File`         |
| `loadFromBuffer(buffer, fileName)`                        | Load from `Uint8Array` data                           |
| `loadGLTFWithAssets(...)` / `loadGLTFWithFileAssets(...)` | Load GLTF with external resources                     |
| `documentToThreeJS(document, modelResult)`                | Convert glTF-Transform `Document` to a Three.js scene |
| `loadToThreeJS(input)`                                    | Load and convert to Three.js scene                    |
| `loadGLTFWithAssetsToThreeJS(...)`                        | GLTF plus assets directly to Three.js                 |
| `isSupportedFormat(fileName)`                             | Validate extension support                            |
| `getSupportedExtensions()`                                | Return supported extensions                           |

`documentToThreeJS` requires both the `Document` and the original `ModelLoadResult` metadata object:

```ts
const loaded = await loader.loadFromFile('model.glb')
const threeResult = await loader.documentToThreeJS(loaded.data, loaded)
```

---

## `ModelOptimizer`

```ts
import { ModelOptimizer } from '@vctrl/core/model-optimizer'

const optimizer = new ModelOptimizer()

await optimizer.loadFromBuffer(modelBuffer)
await optimizer.simplify({ ratio: 0.5 })
await optimizer.deduplicate()
await optimizer.quantize({ quantizePosition: 14 })
await optimizer.compressTextures({ quality: 80 })

const optimizedBuffer = await optimizer.export()
```

### Methods

| Method                      | Options                                                 | Description                                  |
| --------------------------- | ------------------------------------------------------- | -------------------------------------------- |
| `loadFromThreeJS(model)`    | -                                                       | Load a Three.js scene into the optimizer     |
| `loadFromBuffer(buf)`       | -                                                       | Load GLB binary data                         |
| `loadFromFile(path)`        | -                                                       | Load from file path                          |
| `loadFromJSON(json)`        | -                                                       | Load serialized glTF JSON and resources      |
| `simplify(opts)`            | `{ ratio: number }`                                     | Mesh simplification from 0.0 to 1.0          |
| `deduplicate(opts)`         | `DedupOptions`                                          | Remove duplicate geometry and material data  |
| `quantize(opts)`            | `QuantizeOptions`                                       | Reduce precision to reduce size              |
| `optimizeNormals(opts)`     | `NormalsOptions`                                        | Recompute or normalize normal data           |
| `compressTextures(opts)`    | `TextureCompressOptions`                                | Server-side texture compression              |
| `optimizeAll(opts)`         | `{ simplify?, dedup?, quantize?, normals?, textures? }` | Run batch optimization passes                |
| `getReport()`               | -                                                       | Return before and after optimization metrics |
| `export()` / `exportJSON()` | -                                                       | Export optimized GLB or JSON glTF document   |
| `hasModel()` / `reset()`    | -                                                       | Model state utilities                        |

### Optimization options reference

#### `simplify(options?: SimplifyOptions)`

| Option  | Type     | Default | Notes                                                          |
| ------- | -------- | ------- | -------------------------------------------------------------- |
| `ratio` | `number` | `0.5`   | Target simplification ratio. Lower values are more aggressive. |
| `error` | `number` | `0.001` | Allowed geometric error threshold for simplification.          |

#### `deduplicate(options?: DedupOptions)`

| Option      | Type      | Notes                                 |
| ----------- | --------- | ------------------------------------- |
| `textures`  | `boolean` | Forwarded to glTF-Transform `dedup()` |
| `materials` | `boolean` | Forwarded to glTF-Transform `dedup()` |
| `meshes`    | `boolean` | Forwarded to glTF-Transform `dedup()` |
| `accessors` | `boolean` | Forwarded to glTF-Transform `dedup()` |

#### `quantize(options?: QuantizeOptions)`

| Option             | Type     | Notes                                    |
| ------------------ | -------- | ---------------------------------------- |
| `quantizePosition` | `number` | Forwarded to glTF-Transform `quantize()` |
| `quantizeNormal`   | `number` | Forwarded to glTF-Transform `quantize()` |
| `quantizeColor`    | `number` | Forwarded to glTF-Transform `quantize()` |
| `quantizeTexcoord` | `number` | Forwarded to glTF-Transform `quantize()` |

#### `optimizeNormals(options?: NormalsOptions)`

| Option      | Type      | Notes                                             |
| ----------- | --------- | ------------------------------------------------- |
| `overwrite` | `boolean` | Recompute normals even when normals already exist |

#### `compressTextures(options?: TextureCompressOptions)`

| Option                  | Type                        | Current behavior                                                                |
| ----------------------- | --------------------------- | ------------------------------------------------------------------------------- |
| `resize`                | `[number, number]`          | Passed to `compressTexture()`                                                   |
| `targetFormat`          | `'webp' \| 'jpeg' \| 'png'` | Passed to `compressTexture()`                                                   |
| `quality`               | `number`                    | Passed to `compressTexture()`                                                   |
| `requestTimeoutMs`      | `number`                    | Present in type but not consumed by the current `ModelOptimizer` implementation |
| `maxTextureUploadBytes` | `number`                    | Present in type but not consumed by the current `ModelOptimizer` implementation |
| `maxRetries`            | `number`                    | Present in type but not consumed by the current `ModelOptimizer` implementation |
| `maxConcurrentRequests` | `number`                    | Present in type but not consumed by the current `ModelOptimizer` implementation |
| `serverOptions`         | `ServerOptions`             | Accepted in type but stripped before local Sharp compression                    |

When Sharp is unavailable, `compressTextures` falls back to basic texture optimization using `dedup` and `prune` instead of throwing.

#### `optimizeAll(options?)`

```ts
await optimizer.optimizeAll({
	simplify: { ratio: 0.6 },
	dedup: {},
	quantize: { quantizePosition: 14 },
	normals: { overwrite: false },
	textures: { targetFormat: 'webp', quality: 80 }
})
```

Execution order is fixed:

1. `simplify` unless `false`
2. `deduplicate` unless `false`
3. `quantize` unless `false`
4. `optimizeNormals` unless `false`
5. `compressTextures` only when `textures` is provided

Calling `optimizeAll()` with no arguments runs simplify, dedup, quantize, and normals. Texture compression is opt-in.

### `getReport()` return structure

`getReport()` includes:

- `originalSize`, `optimizedSize`
- `compressionRatio` as `originalSize / optimizedSize`
- `appliedOptimizations`
- `stats` before and after metrics for vertices, triangles, materials, textures size, `texturesCount`, `textureResolutions`, meshes, and nodes

```ts
const report = await optimizer.getReport()
console.log(report.stats.textureResolutions.before)
console.log(report.stats.textureResolutions.after)
```

---

## `ModelExporter`

```ts
import { ModelExporter } from '@vctrl/core/model-exporter'

const exporter = new ModelExporter()

const glb = await exporter.exportThreeJSGLB(scene, {})
const gltf = await exporter.exportThreeJSGLTF(scene)
const zip = await exporter.createZIPArchive(gltf, 'model')
```

### Primary methods

| Method                                | Description                                      |
| ------------------------------------- | ------------------------------------------------ |
| `exportDocumentGLB(document)`         | Export a glTF-Transform `Document` to GLB        |
| `exportDocumentGLTF(document)`        | Export a `Document` to GLTF JSON and assets      |
| `exportThreeJSGLB(object, options)`   | Export a Three.js object to GLB                  |
| `exportThreeJSGLTF(object)`           | Export a Three.js object to GLTF JSON and assets |
| `createZIPArchive(result, baseName?)` | Bundle GLTF and assets into a zip                |
| `saveToFile(result, filePath)`        | Persist export result on the Node filesystem     |

`exportThreeJSGLB(object, options)` accepts `modifiedTextureResources` in its options type, but that field is currently ignored for direct Three.js GLB export.

---

## Use in API routes

`@vctrl/core` is used by the Vectreal Platform server-side optimization endpoint. A minimal API route example:

```ts
import { ModelOptimizer } from '@vctrl/core/model-optimizer'

export async function POST(request: Request) {
	const formData = await request.formData()
	const file = formData.get('file') as File

	const buffer = Buffer.from(await file.arrayBuffer())

	const optimizer = new ModelOptimizer()
	await optimizer.loadFromBuffer(new Uint8Array(buffer))
	await optimizer.simplify({ ratio: 0.7 })
	await optimizer.compressTextures({ quality: 80 })

	const optimized = await optimizer.export()

	return new Response(optimized, {
		headers: { 'Content-Type': 'model/gltf-binary' }
	})
}
```

---

## Requirements

| Requirement | Version     |
| ----------- | ----------- |
| Node.js     | 18 or later |
| `sharp`     | `^0.34`     |

---

## Related docs

- [Deployment](https://vectreal.com/docs/operations/deployment)
- [Publishing & Embedding](https://vectreal.com/docs/guides/publish-embed)
- [@vctrl/hooks](https://vectreal.com/docs/packages/hooks)

---

## Source

The full source and README live in [packages/core](https://github.com/Vectreal/vectreal-platform/tree/main/packages/core).

## License

AGPL-3.0-only. See [LICENSE.md](https://github.com/Vectreal/vectreal-platform/blob/main/LICENSE.md).
