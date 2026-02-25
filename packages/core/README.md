# @vctrl/core

The foundational package providing server-side 3D model processing capabilities for the Vectreal ecosystem.

## Overview

`@vctrl/core` contains the core classes for loading, optimizing, and exporting 3D models using glTF-Transform and Three.js, designed specifically for Node.js server environments. This package extracts the business logic from React hooks to enable server-side model processing.

## Features

- **ModelLoader**: Server-side 3D model loading and parsing
- **ModelOptimizer**: Advanced model optimization with glTF-Transform
- **ModelExporter**: Flexible model export capabilities
- Full TypeScript support
- Node.js optimized (including Sharp for texture compression)

## Installation

```bash
npm install @vctrl/core
# or
pnpm add @vctrl/core
```

## Usage

### ModelOptimizer

```typescript
import { ModelOptimizer } from '@vctrl/core/model-optimizer'

const optimizer = new ModelOptimizer()
await optimizer.loadFromBuffer(modelBuffer)

// Apply optimizations
await optimizer.simplify({ ratio: 0.5 })
await optimizer.deduplicate()
await optimizer.compressTextures({ quality: 80 })

// Get optimized model
const optimizedBuffer = await optimizer.export()
```

### ModelLoader

```typescript
import { ModelLoader } from '@vctrl/core/model-loader'

const loader = new ModelLoader()
const result = await loader.loadFromFile('model.glb')
```

### ModelExporter

```typescript
import { ModelExporter } from '@vctrl/core/model-exporter'

const exporter = new ModelExporter()
const glbBuffer = await exporter.exportGLB(scene)
const gltfData = await exporter.exportGLTF(scene, { binary: false })
```

## License

AGPL-3.0-only - See LICENSE.md for details.
