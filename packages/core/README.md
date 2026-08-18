# @vctrl/core

Isomorphic 3D model processing for Node.js and the browser. This package provides the shared loading, optimization, and export pipeline used by other Vectreal packages.

---

## Installation

```bash
npm install @vctrl/core
# or
pnpm add @vctrl/core
```

> **Texture compression is encoder-injectable.** In Node.js, [Sharp](https://sharp.pixelplumbing.com) is used by default. In browser environments, pass your own `TextureCompressOptions.encoder` (anything matching the sharp constructor API: `(buffer) => { resize, webp, jpeg, png, toBuffer, metadata }`) so sharp is never imported. `@vctrl/hooks` ships an `OffscreenCanvas`-based encoder as `createBrowserTextureEncoder()`, injects it for you inside `useOptimizeModel`, and exports it for direct use.

---

## Module overview

| Module              | Import path                   | Description                                                                                       |
| ------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `ModelLoader`       | `@vctrl/core/model-loader`    | Load model files into glTF-Transform `Document` or Three.js scenes                                |
| `ModelOptimizer`    | `@vctrl/core/model-optimizer` | Run optimization passes and export optimized output                                               |
| `ModelExporter`     | `@vctrl/core/model-exporter`  | Export `Document` or Three.js objects to GLB or GLTF                                              |
| Scene asset helpers | `@vctrl/core`                 | Free functions for asset URI, MIME type and base64 handling, plus the shared server payload types |

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

### `ModelLoader` methods

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

### Loading

| Method                                      | Description                                                                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `loadFromThreeJS(model)`                    | Load a Three.js `Object3D`                                                                                |
| `loadFromBuffer(buffer)`                    | Load GLB binary data                                                                                      |
| `loadFromFile(path)`                        | Load a GLB from a file path (Node)                                                                        |
| `loadFromJSON(json)`                        | Load a glTF `JSONDocument` with its resources                                                             |
| `loadFromGLTFWithAssets(gltfBytes, assets)` | Load `.gltf` bytes plus a URI-to-bytes asset map, bypassing Three.js so the original texture URIs survive |

### Optimization passes

| Method                   | Options                  | Description                                                                                                |
| ------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `simplify(opts)`         | `SimplifyOptions`        | Mesh simplification                                                                                        |
| `deduplicate(opts)`      | `DedupOptions`           | Remove duplicate accessors, meshes, textures and materials                                                 |
| `quantize(opts)`         | `QuantizeOptions`        | Reduce vertex attribute precision                                                                          |
| `optimizeNormals(opts)`  | `NormalsOptions`         | Recompute or normalize normal data                                                                         |
| `compressTextures(opts)` | `TextureCompressOptions` | Texture compression via injected encoder (Sharp in Node.js, OffscreenCanvas in browser via `@vctrl/hooks`) |
| `compressGeometry(opts)` | `DracoOptions`           | Replace the loaded document with a Draco-compressed copy                                                   |
| `optimizeAll(opts)`      | see below                | Run every pass above except Draco, in a fixed order                                                        |

### Draco measurement

| Method                          | Description                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `measureDracoCompression(opts)` | Draco-encode a throwaway clone and return a `DracoCompressionReport`, leaving the loaded document untouched |
| `setDracoReport(report)`        | Adopt a measurement produced elsewhere, for example inside the geometry Web Worker. `null` clears it        |

`compressGeometry` skips the swap and warns when the measurement's `isWorthApplying` is
false, which happens on small or texture-dominated models where Draco produces a larger
GLB than leaving the geometry uncompressed.

### Textures

| Method                                                     | Description                                                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `listTextureDescriptors()`                                 | `TextureDescriptor[]`: index, canonical file name, name, MIME type, byte length              |
| `getTexturePayload(index)`                                 | `TextureBinaryPayload`: the descriptor plus the image bytes                                  |
| `replaceTexturePayload(index, image, mimeType, fileName?)` | Swap one texture's bytes and re-sync its URI and name                                        |
| `normalizeAllTextureURIs(doc?)`                            | Canonicalize every texture URI and name. Passing a document also adopts it as the loaded one |

### Report and state

| Method                                                                                          | Description                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getReport()`                                                                                   | Before and after optimization metrics                                                                                                                                       |
| `getBaseline()` / `setBaseline(baseline)`                                                       | Read or restore the load-time baseline the report is measured against. Restoring matters after a worker hands back optimized bytes, so the baseline is not re-taken on them |
| `getAppliedOptimizations()` / `addAppliedOptimization(name)` / `setAppliedOptimizations(names)` | The list of applied steps carried in the report                                                                                                                             |
| `export()` / `exportJSON()`                                                                     | Export the optimized GLB or glTF JSON document                                                                                                                              |
| `hasModel()` / `reset()`                                                                        | Model state utilities                                                                                                                                                       |
| `document`                                                                                      | The loaded glTF-Transform `Document`. Throws if nothing is loaded                                                                                                           |
| `onProgress(callback)`                                                                          | Receive `OperationProgress` updates from every pass                                                                                                                         |

### Optimization options reference

#### `simplify(options?: SimplifyOptions)`

| Option  | Type     | Default | Notes                                                          |
| ------- | -------- | ------- | -------------------------------------------------------------- |
| `ratio` | `number` | `0.5`   | Target simplification ratio. Lower values are more aggressive. |
| `error` | `number` | `0.001` | Allowed geometric error threshold for simplification.          |

#### `deduplicate(options?: DedupOptions)`

Removes duplicate accessors, meshes, textures and materials via glTF-Transform `dedup()`.

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

#### `compressGeometry(options?: DracoOptions)` and `measureDracoCompression(options?: DracoOptions)`

| Option             | Type                            | Default         | Notes                                            |
| ------------------ | ------------------------------- | --------------- | ------------------------------------------------ |
| `method`           | `'edgebreaker' \| 'sequential'` | `'edgebreaker'` | Draco encoding method                            |
| `encodeSpeed`      | `number`                        | `5`             | 0 to 10. Slower encoding produces smaller output |
| `decodeSpeed`      | `number`                        | `5`             | 0 to 10                                          |
| `quantizePosition` | `number`                        | `14`            | Position quantization bits                       |
| `quantizeNormal`   | `number`                        | `10`            | Normal quantization bits                         |
| `quantizeColor`    | `number`                        | `8`             | Color quantization bits                          |
| `quantizeTexcoord` | `number`                        | `12`            | Texture coordinate quantization bits             |
| `quantizeGeneric`  | `number`                        | `12`            | Generic attribute quantization bits              |

Defaults come from glTF-Transform's `draco()`. Draco encoding requires a browser or Web
Worker environment.

#### `compressTextures(options?: TextureCompressOptions)`

| Option         | Type                        | Current behavior                                                           |
| -------------- | --------------------------- | -------------------------------------------------------------------------- |
| `resize`       | `[number, number]`          | Target dimensions for texture resize                                       |
| `targetFormat` | `'webp' \| 'jpeg' \| 'png'` | Output encoding format                                                     |
| `quality`      | `number`                    | Encoder quality 0 to 100                                                   |
| `encoder`      | `unknown`                   | Custom encoder; defaults to Sharp in Node.js. See the shape required below |

`encoder` is typed `unknown` so the package does not force a Sharp type dependency on
browser and edge callers. It must match the part of the Sharp constructor API that
glTF-Transform uses: `(buffer) => { resize, webp, jpeg, png, toBuffer, metadata }`.
`createBrowserTextureEncoder()` from `@vctrl/hooks` returns exactly that.

When no encoder is available, `compressTextures` falls back to basic texture optimization using `dedup` and `prune` instead of throwing.

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
5. `compressTextures` unless `false`

Every pass runs with its own defaults unless you set it to `false`, so `optimizeAll()`
with no arguments runs all five. Draco is not part of `optimizeAll`: call
`compressGeometry` for it.

Texture compression needs an encoder. Outside Node.js, pass one as `textures.encoder` or
set `textures: false`; without one the pass warns and falls back to a dedup and prune of
the texture set.

### `getReport()` return structure

`getReport()` includes:

- `originalSize`, `optimizedSize`
- `compressionRatio` as `originalSize / optimizedSize`
- `appliedOptimizations`
- `stats` before and after metrics for vertices, triangles, materials, texture size in bytes (`textures`), texture asset count (`texturesCount`), `textureResolutions`, and mesh payload size in bytes (`meshes`)
- `draco`, a `DracoCompressionReport`, only when a Draco measurement has been recorded. Draco compression is deferred until write time, so `stats.meshes` always reflects uncompressed geometry

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

const glb = await exporter.exportThreeJSGLB(scene)
const gltf = await exporter.exportThreeJSGLTF(scene)
const zip = await exporter.createZIPArchive(gltf, 'model')
```

### Primary methods

| Method                                       | Description                                                |
| -------------------------------------------- | ---------------------------------------------------------- |
| `exportDocumentGLB(document)`                | Export a glTF-Transform `Document` to GLB                  |
| `exportDocumentGLBDraco(document, options?)` | Export a `Document` to GLB with Draco geometry compression |
| `exportDocumentGLTF(document)`               | Export a `Document` to GLTF JSON and assets                |
| `exportThreeJSGLB(object)`                   | Export a Three.js object to GLB                            |
| `exportThreeJSUSDZ(object)`                  | Export a Three.js object to USDZ                           |
| `exportThreeJSGLTF(object)`                  | Export a Three.js object to GLTF JSON and assets           |
| `createZIPArchive(result, baseName?)`        | Bundle GLTF and assets into a zip                          |
| `saveToFile(result, filePath)`               | Persist any export result on the Node filesystem           |

---

## Use in API routes

The Vectreal Platform itself runs this pipeline in a browser Web Worker, not on the server; its server modules import only types and constants from `@vctrl/core`. The package works the same way in a Node.js route if that suits your app better. A minimal API route example:

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

`@vctrl/core` declares no `engines` field. The Vectreal workspace it is developed in
requires Node.js 22.22 or later.

`sharp` is an **optional** dependency, not a hard requirement. Install it yourself (`npm install sharp`; this workspace tracks `^0.35.3`) to enable native server-side texture compression. When `sharp` is not installed, `compressTextures()` falls back to basic glTF-Transform optimization (deduplication and pruning). In the browser, supply your own `encoder` instead.

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
