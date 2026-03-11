# @vctrl/core

Server-side 3D model loading, optimization, and export utilities used across the Vectreal ecosystem.

## Overview

`@vctrl/core` provides Node-focused building blocks around glTF-Transform and Three.js:

- `ModelLoader` for parsing model inputs
- `ModelOptimizer` for optimization passes
- `ModelExporter` for GLB/GLTF exports
- Scene asset/types utilities re-exported from package root

## Features

- GLTF/GLB loading and GLTF-with-assets reconstruction
- Three.js scene conversion helpers
- Mesh simplification, deduplication, quantization, normal optimization
- Texture compression support (Sharp-backed)
- GLB and GLTF + assets export with optional zip packaging

## Installation

```bash
npm install @vctrl/core
# or
pnpm add @vctrl/core
```

## Public modules

| Module          | Import path                   |
| --------------- | ----------------------------- |
| Model loader    | `@vctrl/core/model-loader`    |
| Model optimizer | `@vctrl/core/model-optimizer` |
| Model exporter  | `@vctrl/core/model-exporter`  |

The package root (`@vctrl/core`) also re-exports all modules and shared types.

## Usage

### ModelOptimizer example

```typescript
import { ModelOptimizer } from '@vctrl/core/model-optimizer'

const optimizer = new ModelOptimizer()
await optimizer.loadFromBuffer(modelBuffer)

// Apply optimizations
await optimizer.simplify({ ratio: 0.5 })
await optimizer.deduplicate()
await optimizer.quantize({ quantizePosition: 14 })
await optimizer.compressTextures({ quality: 80 })

// Get optimized model
const optimizedBuffer = await optimizer.export()
```

### ModelLoader example

```typescript
import { ModelLoader } from '@vctrl/core/model-loader'

const loader = new ModelLoader()
const result = await loader.loadFromFile('model.glb')

// Convert loaded document to Three.js scene
const sceneResult = await loader.documentToThreeJS(result.data)
```

### ModelExporter example

```typescript
import { ModelExporter } from '@vctrl/core/model-exporter'

const exporter = new ModelExporter()

const glb = await exporter.exportThreeJSGLB(scene, {})
const gltf = await exporter.exportThreeJSGLTF(scene)
const zip = await exporter.createZIPArchive(gltf, 'model')
```

## Selected API surface

### ModelLoader

- `loadFromFile(input: string | File)`
- `loadFromBuffer(buffer: Uint8Array, fileName: string)`
- `loadGLTFWithAssets(...)`
- `loadGLTFWithFileAssets(...)`
- `documentToThreeJS(document, modelResult)`
- `loadToThreeJS(input)`
- `loadGLTFWithAssetsToThreeJS(...)`

`documentToThreeJS` requires both the `Document` and original `ModelLoadResult`:

```typescript
const loaded = await loader.loadFromFile('model.glb')
const threeResult = await loader.documentToThreeJS(loaded.data, loaded)
```

### ModelOptimizer

- `loadFromThreeJS(model)`
- `loadFromBuffer(buffer)`
- `loadFromFile(filePath)`
- `loadFromJSON(json)`
- `simplify(options?)`
- `deduplicate(options?)`
- `quantize(options?)`
- `optimizeNormals(options?)`
- `compressTextures(options?)`
- `optimizeAll(options?)`
- `getReport()`
- `export()` / `exportJSON()`

#### Option details

##### `simplify(options?: SimplifyOptions)`

| Option  | Type     | Default | Notes                                  |
| ------- | -------- | ------- | -------------------------------------- |
| `ratio` | `number` | `0.5`   | Target simplification ratio            |
| `error` | `number` | `0.001` | Allowed simplification error threshold |

##### `deduplicate(options?: DedupOptions)`

| Option      | Type      | Notes                                 |
| ----------- | --------- | ------------------------------------- |
| `textures`  | `boolean` | Forwarded to glTF-Transform `dedup()` |
| `materials` | `boolean` | Forwarded to glTF-Transform `dedup()` |
| `meshes`    | `boolean` | Forwarded to glTF-Transform `dedup()` |
| `accessors` | `boolean` | Forwarded to glTF-Transform `dedup()` |

##### `quantize(options?: QuantizeOptions)`

| Option             | Type     | Notes                                    |
| ------------------ | -------- | ---------------------------------------- |
| `quantizePosition` | `number` | Forwarded to glTF-Transform `quantize()` |
| `quantizeNormal`   | `number` | Forwarded to glTF-Transform `quantize()` |
| `quantizeColor`    | `number` | Forwarded to glTF-Transform `quantize()` |
| `quantizeTexcoord` | `number` | Forwarded to glTF-Transform `quantize()` |

##### `optimizeNormals(options?: NormalsOptions)`

| Option      | Type      | Notes                                       |
| ----------- | --------- | ------------------------------------------- |
| `overwrite` | `boolean` | Recompute normals even when already present |

##### `compressTextures(options?: TextureCompressOptions)`

| Option                  | Type                        | Current behavior                                             |
| ----------------------- | --------------------------- | ------------------------------------------------------------ |
| `resize`                | `[number, number]`          | Passed to `compressTexture()`                                |
| `targetFormat`          | `'webp' \| 'jpeg' \| 'png'` | Passed to `compressTexture()`                                |
| `quality`               | `number`                    | Passed to `compressTexture()`                                |
| `requestTimeoutMs`      | `number`                    | Present in type but not consumed by current `ModelOptimizer` |
| `maxTextureUploadBytes` | `number`                    | Present in type but not consumed by current `ModelOptimizer` |
| `maxRetries`            | `number`                    | Present in type but not consumed by current `ModelOptimizer` |
| `maxConcurrentRequests` | `number`                    | Present in type but not consumed by current `ModelOptimizer` |
| `serverOptions`         | `ServerOptions`             | Accepted in type but stripped before local Sharp compression |

When Sharp is unavailable, texture compression falls back to a basic texture optimization path (`dedup` + `prune`).

##### `optimizeAll(options?)`

Execution order:

1. `simplify` (unless `false`)
2. `deduplicate` (unless `false`)
3. `quantize` (unless `false`)
4. `optimizeNormals` (unless `false`)
5. `compressTextures` (only if `textures` is provided)

Calling `optimizeAll()` with no arguments runs simplify, dedup, quantize, and normals. Texture compression is opt-in.

##### `getReport()`

Returns:

- `originalSize`, `optimizedSize`
- `compressionRatio` (`originalSize / optimizedSize`)
- `appliedOptimizations`
- `stats` with before/after metrics for vertices, triangles, materials, textures (size), `texturesCount`, `textureResolutions`, meshes, and nodes

### ModelExporter

- `exportDocumentGLB(document)`
- `exportDocumentGLTF(document)`
- `exportThreeJSGLB(object, options)`
- `exportThreeJSGLTF(object)`
- `createZIPArchive(result, baseName?)`
- `saveToFile(result, filePath)`

`exportThreeJSGLB(object, options)` accepts `modifiedTextureResources` in its options type, but this field is currently ignored for direct Three.js GLB export.

## Requirements

- Node.js 18+
- `sharp` for texture compression flows

## Related app docs

- [Package reference page](https://vectreal.com/docs/packages/core)
- [Deployment guide](https://vectreal.com/docs/operations/deployment)
- [Publishing and embedding guide](https://vectreal.com/docs/guides/publish-embed)

## License

AGPL-3.0-only - See LICENSE.md for details.
