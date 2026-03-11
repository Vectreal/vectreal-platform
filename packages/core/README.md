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

| Module | Import path |
|---|---|
| Model loader | `@vctrl/core/model-loader` |
| Model optimizer | `@vctrl/core/model-optimizer` |
| Model exporter | `@vctrl/core/model-exporter` |

The package root (`@vctrl/core`) also re-exports all modules and shared types.

## Usage

### ModelOptimizer

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

### ModelLoader

```typescript
import { ModelLoader } from '@vctrl/core/model-loader'

const loader = new ModelLoader()
const result = await loader.loadFromFile('model.glb')

// Convert loaded document to Three.js scene
const sceneResult = await loader.documentToThreeJS(result.data)
```

### ModelExporter

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
- `documentToThreeJS(document)`
- `loadToThreeJS(input)`
- `loadGLTFWithAssetsToThreeJS(...)`

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

### ModelExporter

- `exportDocumentGLB(document)`
- `exportDocumentGLTF(document)`
- `exportThreeJSGLB(object, options)`
- `exportThreeJSGLTF(object)`
- `createZIPArchive(result, baseName?)`
- `saveToFile(result, filePath)`

## Requirements

- Node.js 18+
- `sharp` for texture compression flows

## Related app docs

- [Package reference page](https://vectreal.com/docs/packages/core)
- [Deployment guide](https://vectreal.com/docs/operations/deployment)
- [Publishing and embedding guide](https://vectreal.com/docs/guides/publish-embed)

## License

AGPL-3.0-only - See LICENSE.md for details.
