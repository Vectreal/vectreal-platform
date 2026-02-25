# @vctrl/hooks

[![Version and release packages to NPM](https://img.shields.io/github/actions/workflow/status/vectreal/vectreal-core/version-release.yaml?logo=github&logoColor=%23fc6c18&label=CI/CD&color=%23fc6c18)](https://github.com/Vectreal/vectreal-core/actions/workflows/version-release.yaml)
[![NPM Downloads](https://img.shields.io/npm/dm/%40vctrl%2Fhooks?logo=npm&logoColor=%23fc6c18&label=downloads&color=%23fc6c18)](https://www.npmjs.com/package/@vctrl/hooks)
[![NPM Version](https://img.shields.io/npm/v/%40vctrl%2Fhooks?logo=npm&logoColor=%23fc6c18&label=version&color=%23fc6c18)](https://www.npmjs.com/package/@vctrl/hooks)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

**Powerful React hooks for 3D model loading, optimization, and export**

> **⚠️ Development Notice**: This library is under active development. Breaking changes may occur before v1.0.0.

## 📖 Overview

`@vctrl/hooks` is a comprehensive React hooks library for working with 3D models in web applications. Built on top of Three.js and glTF-Transform, it provides production-ready solutions for loading, optimizing, and exporting 3D assets. It's part of the [vectreal-core](https://github.com/vectreal/vectreal-core) ecosystem and powers the [official Vectreal platform](https://core.vectreal.com).

### ✨ Key Features

- 🎯 **Simple API** - Intuitive hooks that follow React best practices
- 📦 **Multiple Formats** - Support for GLTF, GLB, and USDZ files
- ⚡ **Advanced Optimization** - Mesh simplification, deduplication, and compression
- 🔄 **Server Integration** - Load complete scenes from your backend with settings
- 📤 **Export** - Export optimized models back to GLTF/GLB formats
- 🎨 **Type-Safe** - Full TypeScript support with comprehensive types
- 🔌 **Extensible** - Modular architecture for custom workflows
- 📊 **Progress Tracking** - Real-time loading and optimization progress
- 🎭 **Event System** - Subscribe to lifecycle events for fine-grained control
- 🌐 **Server Communication** - Unified service for API interactions

### 🎯 Use Cases

- **3D Model Viewers** - Build interactive model viewers for e-commerce, real estate, or product showcases
- **Asset Management** - Create tools for managing and optimizing 3D asset pipelines
- **Content Creation** - Build editors and tools for 3D content workflows
- **AR/VR Applications** - Prepare and optimize models for immersive experiences
- **Game Development** - Manage and optimize game assets in React-based tools
- **Digital Twins** - Load and manage complex 3D scenes with server-side state

## 📚 Table of Contents

- [@vctrl/hooks](#vctrlhooks)
  - [📖 Overview](#-overview)
    - [✨ Key Features](#-key-features)
    - [🎯 Use Cases](#-use-cases)
  - [📚 Table of Contents](#-table-of-contents)
  - [📦 Installation](#-installation)
    - [Peer Dependencies](#peer-dependencies)
  - [🚀 Quick Start](#-quick-start)
    - [Basic Model Loading](#basic-model-loading)
    - [With Optimization](#with-optimization)
    - [Load Scene from Server](#load-scene-from-server)
  - [Core Hooks](#core-hooks)
    - [useLoadModel](#useloadmodel)
    - [useOptimizeModel](#useoptimizemodel)
    - [useExportModel](#useexportmodel)
  - [Advanced Features](#advanced-features)
    - [Server Scene Loading](#server-scene-loading)
    - [Event System](#event-system)
    - [Model Context](#model-context)
    - [Server Communication Service](#server-communication-service)
  - [Supported File Types](#supported-file-types)
  - [Integration Guides](#integration-guides)
    - [With @vctrl/viewer](#with-vctrlviewer)
    - [With React Three Fiber](#with-react-three-fiber)
    - [With State Management Libraries](#with-state-management-libraries)
  - [Real-World Examples](#real-world-examples)
    - [E-Commerce Product Viewer](#e-commerce-product-viewer)
    - [Asset Manager with Batch Optimization](#asset-manager-with-batch-optimization)
    - [Progressive Loading with Quality Levels](#progressive-loading-with-quality-levels)
  - [API Reference](#api-reference)
    - [Types](#types)
      - [ModelFile](#modelfile)
      - [SceneLoadOptions](#sceneloadoptions)
      - [ServerOptions](#serveroptions)
      - [OptimizationReport](#optimizationreport)
      - [SceneLoadResult](#sceneloadresult)
    - [Hook Return Values](#hook-return-values)
  - [Development](#development)
    - [Setup](#setup)
    - [Project Structure](#project-structure)
    - [Testing](#testing)
    - [Building](#building)
  - [Contributing](#contributing)
    - [Guidelines](#guidelines)
    - [Code Style](#code-style)
    - [Reporting Issues](#reporting-issues)
  - [License](#license)
  - [Support](#support)
    - [Documentation](#documentation)
    - [Community](#community)
    - [Getting Help](#getting-help)
    - [Commercial Support](#commercial-support)
  - [Acknowledgments](#acknowledgments)

## 📦 Installation

```bash
# npm
npm install @vctrl/hooks

# yarn
yarn add @vctrl/hooks

# pnpm
pnpm add @vctrl/hooks
```

### Peer Dependencies

The package requires React and Three.js as peer dependencies:

```bash
npm install react react-dom three
```

## 🚀 Quick Start

### Basic Model Loading

```tsx
import { useLoadModel } from '@vctrl/hooks'

function ModelViewer() {
	const { load, file, isFileLoading, progress } = useLoadModel()

	const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.target.files || [])
		load(files)
	}

	return (
		<div>
			<input type="file" onChange={handleFileUpload} accept=".glb,.gltf" />
			{isFileLoading && <p>Loading: {progress}%</p>}
			{file && <p>✅ Model loaded: {file.name}</p>}
		</div>
	)
}
```

### With Optimization

```tsx
import { useLoadModel, useOptimizeModel } from '@vctrl/hooks'

function OptimizedModelViewer() {
	const optimizer = useOptimizeModel()
	const {
		load,
		file,
		optimizer: optimizerIntegration
	} = useLoadModel(optimizer)

	const handleOptimize = async () => {
		// Simplify to 50% of original triangles
		await optimizerIntegration.applyOptimization(
			optimizerIntegration.simplifyOptimization,
			{ ratio: 0.5 }
		)

		// Compress textures
		await optimizerIntegration.applyOptimization(
			optimizerIntegration.texturesOptimization,
			{ quality: 80, targetFormat: 'webp' }
		)
	}

	return (
		<div>
			{file && (
				<>
					<button onClick={handleOptimize}>Optimize Model</button>
					<p>Original: {optimizer.report?.originalSize} bytes</p>
					<p>Optimized: {optimizer.report?.optimizedSize} bytes</p>
				</>
			)}
		</div>
	)
}
```

### Load Scene from Server

```tsx
import { useLoadModel } from '@vctrl/hooks'
import { useEffect } from 'react'

function ServerSceneViewer({ sceneId }: { sceneId: string }) {
	const model = useLoadModel()

	useEffect(() => {
		const loadScene = async () => {
			try {
				const scene = await model.loadFromServer({
					sceneId,
					serverOptions: {
						endpoint: '/api/load-scene'
					}
				})
				console.log('Loaded scene with settings:', scene.settings)
			} catch (error) {
				console.error('Failed to load scene:', error)
			}
		}

		loadScene()
	}, [sceneId])

	return model.file?.model ? (
		<VectrealViewer model={model.file.model} />
	) : (
		<LoadingSpinner />
	)
}
```

## Core Hooks

### useLoadModel

The primary hook for loading 3D models into your React application.

**Key Capabilities:**

- ✅ Supports GLTF, GLB, and USDZ formats
- ✅ Handles multi-file uploads (GLTF + textures + bins)
- ✅ Drag-and-drop directory support
- ✅ Progress tracking with events
- ✅ Three.js integration
- ✅ Server-side scene loading
- ✅ Automatic optimizer integration

**Basic API:**

```tsx
import { useLoadModel } from '@vctrl/hooks'

const {
	load, // Function to load files
	loadFromServer, // Function to load from server
	file, // Loaded model data
	isFileLoading, // Loading state
	progress, // Progress percentage (0-100)
	reset, // Reset to initial state
	on, // Subscribe to events
	off // Unsubscribe from events
} = useLoadModel()
```

**Loading Files:**

```tsx
// From file input
const handleFiles = (event) => {
	const files = Array.from(event.target.files)
	load(files)
}

// From drag and drop
const handleDrop = (event) => {
	event.preventDefault()
	const items = Array.from(event.dataTransfer.items)
	const entries = items.map((item) => item.webkitGetAsEntry())
	load(entries) // Supports directories
}
```

**Event Subscription:**

```tsx
useEffect(() => {
	const handleLoadComplete = (file) => {
		console.log('Model loaded:', file.name)
	}

	const handleLoadError = (error) => {
		console.error('Load failed:', error)
	}

	model.on('load-complete', handleLoadComplete)
	model.on('load-error', handleLoadError)

	return () => {
		model.off('load-complete', handleLoadComplete)
		model.off('load-error', handleLoadError)
	}
}, [])
```

**Available Events:**

| Event                  | Data Type         | Description                            |
| ---------------------- | ----------------- | -------------------------------------- |
| `load-start`           | `null`            | File loading has started               |
| `load-progress`        | `number`          | Loading progress (0-100)               |
| `load-complete`        | `ModelFile`       | File loaded successfully               |
| `load-error`           | `Error`           | Loading failed                         |
| `load-reset`           | `null`            | State was reset                        |
| `multiple-models`      | `File[]`          | Multiple model files detected          |
| `not-loaded-files`     | `File[]`          | Unsupported files detected             |
| `server-load-start`    | `string`          | Server scene loading started (sceneId) |
| `server-load-complete` | `SceneLoadResult` | Server scene loaded                    |
| `server-load-error`    | `Error`           | Server scene loading failed            |

**Optimization Integration:**

If you pass an instance of `useOptimizeModel` to `useLoadModel`, it integrates optimization functions:

```tsx
const optimizer = useOptimizeModel()
const { load, file, optimizer: optimizerIntegration } = useLoadModel(optimizer)

const handleSimplify = async () => {
	await optimizerIntegration.applyOptimization(
		optimizerIntegration.simplifyOptimization,
		{ ratio: 0.5 }
	)
	// The optimized model is now in file.model
}
```

The `optimizer` object includes:

- `simplifyOptimization(options)`: Simplifies the model using mesh simplification
- `dedupOptimization(options)`: Removes duplicate vertices and meshes
- `quantizeOptimization(options)`: Reduces the precision of vertex attributes
- `normalsOptimization(options)`: Overrides the normals of each object
- `texturesOptimization(options)`: Compresses textures (requires server endpoint)
- `applyOptimization(fn, options)`: Applies optimization and updates the model

### useOptimizeModel

Hook for optimizing 3D models with various techniques.

**Key Capabilities:**

- 🔧 Mesh simplification using MeshoptSimplifier
- 🔧 Geometry deduplication
- 🔧 Vertex quantization
- 🔧 Normal optimization
- 🔧 Texture compression (server-side)
- 📊 Before/after reports
- 📈 Size reduction metrics

**Basic API:**

```tsx
import { useOptimizeModel } from '@vctrl/hooks'

const {
	load, // Load a Three.js Object3D
	getModel, // Get optimized model as Uint8Array
	simplifyOptimization, // Reduce polygon count
	dedupOptimization, // Remove duplicates
	quantizeOptimization, // Reduce precision
	normalsOptimization, // Optimize normals
	texturesOptimization, // Compress textures
	reset, // Reset optimizer
	report, // Optimization report
	error, // Error state
	loading // Loading state
} = useOptimizeModel()
```

**Optimization Techniques:**

**1. Mesh Simplification**

Reduces triangle count while preserving visual quality.

```tsx
await simplifyOptimization({
	ratio: 0.5, // Keep 50% of triangles
	error: 0.01 // Error threshold
})
```

**2. Deduplication**

Removes duplicate vertices, meshes, and materials.

```tsx
await dedupOptimization({
	textures: true,
	materials: true,
	meshes: true,
	accessors: true
})
```

**3. Quantization**

Reduces precision of vertex attributes to save space.

```tsx
await quantizeOptimization({
	quantizePosition: 14, // Position bits
	quantizeNormal: 10, // Normal bits
	quantizeTexcoord: 12, // UV bits
	quantizeColor: 8 // Color bits
})
```

**4. Texture Compression**

Compresses textures (requires server endpoint).

```tsx
await texturesOptimization({
	targetFormat: 'webp',
	quality: 80,
	resize: [2048, 2048],
	serverOptions: {
		endpoint: '/api/optimize-textures',
		apiKey: 'your-api-key'
	}
})
```

**Optimization Report:**

```tsx
const { report } = useOptimizeModel()

if (report) {
	console.log({
		originalSize: report.originalSize,
		optimizedSize: report.optimizedSize,
		compressionRatio: report.compressionRatio,
		appliedOptimizations: report.appliedOptimizations,
		stats: {
			vertices: report.stats.vertices,
			triangles: report.stats.triangles,
			materials: report.stats.materials,
			textures: report.stats.textures
		}
	})
}
```

**Direct Usage:**

```tsx
const optimizer = useOptimizeModel()

// Load a Three.js model
optimizer.load(threeJsModel)

// Apply optimizations
await optimizer.simplifyOptimization({ ratio: 0.5 })
await optimizer.dedupOptimization()
await optimizer.quantizeOptimization()

// Get the optimized model
const optimizedModel = await optimizer.getModel() // Uint8Array
```

**Integrated Usage with useLoadModel:**

```tsx
const optimizer = useOptimizeModel()
const { file, optimizer: optimizerIntegration } = useLoadModel(optimizer)

// Apply optimization and update loaded model
await optimizerIntegration.applyOptimization(
	optimizerIntegration.simplifyOptimization,
	{ ratio: 0.5 }
)

// Model is automatically updated in file.model
```

### useExportModel

Export Three.js scenes to GLTF or GLB format.

**Basic API:**

```tsx
import { useExportModel } from '@vctrl/hooks'

const { handleGltfExport } = useExportModel(
	() => console.log('Export complete'),
	(error) => console.error('Export error:', error)
)

// Export as GLB (binary)
handleGltfExport(file, true)

// Export as GLTF (JSON + separate resources)
handleGltfExport(file, false)
```

**Complete Example:**

```tsx
function ExportButton({ file }: { file: ModelFile }) {
	const { handleGltfExport } = useExportModel(
		() => toast.success('Model exported successfully'),
		(error) => toast.error(`Export failed: ${error.message}`)
	)

	return (
		<div>
			<button onClick={() => handleGltfExport(file, true)}>
				Export as GLB
			</button>
			<button onClick={() => handleGltfExport(file, false)}>
				Export as GLTF
			</button>
		</div>
	)
}
```

## Advanced Features

### Server Scene Loading

Load complete scenes from your backend, including model and settings.

**Server Response Format:**

The hook expects a server endpoint that returns:

```typescript
interface ServerSceneData {
	model: Uint8Array // GLB binary as number array
	settings: {
		// Scene settings
		environment: {}
		toneMapping: {}
		controls: {}
		shadows: {}
		meta: {}
	}
	sceneId: string
	sceneName?: string
	thumbnailUrl?: string | null
}
```

**Client Usage:**

```tsx
const model = useLoadModel()

const scene = await model.loadFromServer({
	sceneId: 'abc-123',
	serverOptions: {
		endpoint: '/api/load-scene',
		apiKey: 'optional-token',
		headers: {
			'X-Custom-Header': 'value'
		}
	}
})

// scene.file - Loaded Three.js model
// scene.settings - Scene configuration
// scene.sceneId - Scene identifier
```

**Complete Example:**

```tsx
function SceneLoader({ sceneId }: { sceneId: string }) {
	const model = useLoadModel()
	const [settings, setSettings] = useState(null)

	useEffect(() => {
		const loadScene = async () => {
			try {
				const result = await model.loadFromServer({
					sceneId,
					serverOptions: {
						endpoint: '/api/load-scene',
						apiKey: process.env.API_KEY
					},
					applySettings: true
				})

				setSettings(result.settings)
				console.log('Scene loaded:', result.sceneName)
			} catch (error) {
				console.error('Failed to load scene:', error)
			}
		}

		loadScene()
	}, [sceneId])

	return (
		<div>
			{model.file && settings && (
				<VectrealViewer
					model={model.file.model}
					environment={settings.environment}
					controls={settings.controls}
				/>
			)}
		</div>
	)
}
```

For detailed server implementation guidance, see [SERVER_SCENE_LOADING.md](./SERVER_SCENE_LOADING.md).

### Event System

Subscribe to events for fine-grained control over the loading and optimization lifecycle.

**Basic Event Subscription:**

```tsx
const model = useLoadModel()

useEffect(() => {
	const handleLoadComplete = (file) => {
		console.log('Model loaded:', file.name)
		toast.success(`Loaded ${file.name}`)
	}

	const handleLoadError = (error) => {
		console.error('Load failed:', error)
		toast.error(error.message)
	}

	model.on('load-complete', handleLoadComplete)
	model.on('load-error', handleLoadError)

	return () => {
		model.off('load-complete', handleLoadComplete)
		model.off('load-error', handleLoadError)
	}
}, [])
```

**Multiple Event Handlers:**

```tsx
const model = useLoadModel()

useEffect(() => {
	const handlers = {
		'load-start': () => setLoading(true),
		'load-progress': (progress) => setProgress(progress),
		'load-complete': (file) => {
			setLoading(false)
			setModel(file.model)
		},
		'load-error': (error) => {
			setLoading(false)
			setError(error.message)
		},
		'server-load-start': (sceneId) => {
			console.log('Loading scene:', sceneId)
		},
		'server-load-complete': (result) => {
			console.log('Scene loaded with settings:', result.settings)
		}
	}

	// Subscribe to all events
	Object.entries(handlers).forEach(([event, handler]) => {
		model.on(event, handler)
	})

	// Cleanup on unmount
	return () => {
		Object.entries(handlers).forEach(([event, handler]) => {
			model.off(event, handler)
		})
	}
}, [])
```

### Model Context

Share model state across components using React Context.

**Setup with ModelProvider:**

```tsx
import { ModelProvider } from '@vctrl/hooks/use-load-model'
import { useOptimizeModel } from '@vctrl/hooks'

function App() {
	const optimizer = useOptimizeModel()

	return (
		<ModelProvider optimizer={optimizer}>
			<ModelUploader />
			<ModelViewer />
			<ModelTools />
		</ModelProvider>
	)
}
```

**Consume Context in Components:**

```tsx
import { useModelContext } from '@vctrl/hooks/use-load-model'

function ModelUploader() {
	const { load, isFileLoading, progress } = useModelContext()

	return (
		<div>
			<input
				type="file"
				onChange={(e) => load(Array.from(e.target.files || []))}
				accept=".glb,.gltf"
			/>
			{isFileLoading && (
				<ProgressBar value={progress} label={`Loading: ${progress}%`} />
			)}
		</div>
	)
}

function ModelViewer() {
	const { file } = useModelContext()

	return file?.model ? (
		<VectrealViewer model={file.model} />
	) : (
		<EmptyState message="No model loaded" />
	)
}

function ModelTools() {
	const { file, optimizer } = useModelContext()

	if (!file) return null

	return (
		<div>
			<button onClick={() => optimizer.simplifyOptimization({ ratio: 0.5 })}>
				Simplify (50%)
			</button>
			<button onClick={() => optimizer.dedupOptimization()}>Deduplicate</button>
			<button onClick={() => optimizer.quantizeOptimization()}>Quantize</button>
		</div>
	)
}
```

### Server Communication Service

For custom API calls beyond scene loading, use the included `ServerCommunicationService`:

**Import:**

```tsx
import { ServerCommunicationService } from '@vctrl/hooks'
```

**GET Request:**

```tsx
const data = await ServerCommunicationService.get<MyDataType>('/api/models', {
	endpoint: '/api',
	apiKey: 'your-token',
	searchParams: {
		category: '3d-models',
		limit: '10'
	}
})
```

**POST with JSON:**

```tsx
const result = await ServerCommunicationService.post(
	'/api/save-scene',
	{
		sceneId: '123',
		settings: {
			/* ... */
		},
		metadata: {
			/* ... */
		}
	},
	{
		endpoint: '/api',
		apiKey: 'your-token',
		headers: {
			'X-Custom-Header': 'value'
		}
	}
)
```

**POST with FormData:**

```tsx
const formData = new FormData()
formData.append('file', modelBlob, 'model.glb')
formData.append('metadata', JSON.stringify({ name: 'My Model' }))

const response = await ServerCommunicationService.postFormData(
	'/api/upload-model',
	formData,
	{
		endpoint: '/api',
		apiKey: 'your-token'
	}
)
```

**Error Handling:**

```tsx
try {
	const data = await ServerCommunicationService.get('/api/data', options)
} catch (error) {
	console.error('Request failed:', error.message)
	// Error message is automatically extracted from response
}
```

## Supported File Types

The package currently supports the following 3D model file formats:

| Format   | Extension | Description                                        |
| -------- | --------- | -------------------------------------------------- |
| **GLTF** | `.gltf`   | JSON-based 3D model format with external resources |
| **GLB**  | `.glb`    | Binary GLTF format with embedded resources         |
| **USDZ** | `.usdz`   | Apple's Universal Scene Description (for AR/iOS)   |

**Multi-File Support:**

When loading GLTF files, the hook automatically handles associated files:

- `.bin` - Binary buffers
- `.jpg`, `.jpeg`, `.png`, `.webp` - Texture images
- Entire directories via drag-and-drop

**Example:**

```tsx
// Single GLB file
load([glbFile])

// GLTF with external resources
load([gltfFile, binFile, texture1, texture2])

// Directory drop (automatically finds all related files)
const handleDrop = (event) => {
	const items = Array.from(event.dataTransfer.items)
	const entries = items.map((item) => item.webkitGetAsEntry())
	load(entries) // Handles nested directories
}
```

## Integration Guides

### With @vctrl/viewer

Integrate with the official Vectreal viewer component:

```tsx
import { useLoadModel, useOptimizeModel } from '@vctrl/hooks'
import { VectrealViewer } from '@vctrl/viewer'

function ModelViewerApp() {
	const optimizer = useOptimizeModel()
	const model = useLoadModel(optimizer)

	return (
		<div>
			<FileUpload onLoad={(files) => model.load(files)} />

			{model.file?.model && (
				<VectrealViewer
					model={model.file.model}
					onReady={() => console.log('Viewer ready')}
				/>
			)}

			{optimizer.report && <OptimizationStats report={optimizer.report} />}
		</div>
	)
}
```

### With React Three Fiber

Use the loaded models directly in R3F scenes:

```tsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useLoadModel } from '@vctrl/hooks'
import { useEffect, useRef } from 'react'

function Model() {
	const model = useLoadModel()
	const groupRef = useRef()

	useEffect(() => {
		if (model.file?.model && groupRef.current) {
			groupRef.current.add(model.file.model.clone())
		}
	}, [model.file])

	return <group ref={groupRef} />
}

function App() {
	return (
		<Canvas>
			<ambientLight intensity={0.5} />
			<Model />
			<OrbitControls />
		</Canvas>
	)
}
```

### With State Management Libraries

**With Zustand:**

```tsx
import create from 'zustand'
import { useLoadModel, useOptimizeModel } from '@vctrl/hooks'

const useModelStore = create((set) => ({
	model: null,
	setModel: (model) => set({ model }),
	reset: () => set({ model: null })
}))

function ModelManager() {
	const optimizer = useOptimizeModel()
	const loader = useLoadModel(optimizer)
	const setModel = useModelStore((state) => state.setModel)

	useEffect(() => {
		if (loader.file) {
			setModel(loader.file)
		}
	}, [loader.file])

	return <FileUpload onLoad={loader.load} />
}
```

## Real-World Examples

### E-Commerce Product Viewer

```tsx
function ProductViewer({ productId }: { productId: string }) {
	const optimizer = useOptimizeModel()
	const model = useLoadModel(optimizer)
	const [variant, setVariant] = useState('default')

	useEffect(() => {
		const loadProduct = async () => {
			const scene = await model.loadFromServer({
				sceneId: `${productId}-${variant}`,
				serverOptions: { endpoint: '/api/products/load-scene' }
			})

			// Optimize for web viewing
			await model.optimizer.applyOptimization(
				model.optimizer.simplifyOptimization,
				{ ratio: 0.7 }
			)
		}

		loadProduct()
	}, [productId, variant])

	return (
		<div className="product-viewer">
			<VariantSelector value={variant} onChange={setVariant} />
			{model.file && <VectrealViewer model={model.file.model} />}
			{optimizer.report && (
				<div className="stats">
					<p>Size: {(optimizer.report.optimizedSize / 1024).toFixed(2)} KB</p>
					<p>
						Triangles: {optimizer.report.stats.triangles.after.toLocaleString()}
					</p>
				</div>
			)}
		</div>
	)
}
```

### Asset Manager with Batch Optimization

```tsx
function AssetManager() {
	const optimizer = useOptimizeModel()
	const model = useLoadModel(optimizer)
	const [assets, setAssets] = useState<ModelFile[]>([])

	const optimizeAll = async () => {
		const pipeline = [
			{ fn: optimizer.dedupOptimization, options: {} },
			{ fn: optimizer.quantizeOptimization, options: { quantizePosition: 14 } },
			{ fn: optimizer.simplifyOptimization, options: { ratio: 0.6 } }
		]

		for (const step of pipeline) {
			await step.fn(step.options)
		}

		const optimized = await optimizer.getModel()
		// Save or download optimized model
		downloadModel(optimized, 'optimized.glb')
	}

	const downloadModel = (data: Uint8Array, filename: string) => {
		const blob = new Blob([data], { type: 'model/gltf-binary' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = filename
		a.click()
		URL.revokeObjectURL(url)
	}

	return (
		<div className="asset-manager">
			<FileUpload
				onUpload={(files) => {
					model.load(files)
					if (model.file) setAssets([...assets, model.file])
				}}
			/>
			<AssetList assets={assets} />
			<button onClick={optimizeAll}>Optimize All</button>
		</div>
	)
}
```

### Progressive Loading with Quality Levels

```tsx
function ProgressiveModelViewer({ sceneId }: { sceneId: string }) {
	const optimizer = useOptimizeModel()
	const model = useLoadModel(optimizer)
	const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('low')

	useEffect(() => {
		const loadWithQuality = async () => {
			const scene = await model.loadFromServer({
				sceneId,
				serverOptions: { endpoint: '/api/load-scene' }
			})

			// Apply quality-based optimization
			const qualitySettings = {
				low: { ratio: 0.3, quantizePosition: 12 },
				medium: { ratio: 0.6, quantizePosition: 14 },
				high: { ratio: 1.0, quantizePosition: 16 }
			}

			const settings = qualitySettings[quality]

			if (quality !== 'high') {
				await model.optimizer.applyOptimization(
					model.optimizer.simplifyOptimization,
					{ ratio: settings.ratio }
				)
			}

			await model.optimizer.applyOptimization(
				model.optimizer.quantizeOptimization,
				{ quantizePosition: settings.quantizePosition }
			)
		}

		loadWithQuality()
	}, [sceneId, quality])

	return (
		<div>
			<QualitySelector value={quality} onChange={setQuality} />
			{model.file && <VectrealViewer model={model.file.model} />}
		</div>
	)
}
```

## API Reference

### Types

#### ModelFile

```typescript
interface ModelFile {
	model: Object3D // Three.js scene
	type: ModelFileTypes // 'gltf' | 'glb' | 'usdz'
	name: string // Filename
}
```

#### SceneLoadOptions

```typescript
interface SceneLoadOptions {
	sceneId: string
	serverOptions?: ServerOptions
	applySettings?: boolean
}
```

#### ServerOptions

```typescript
interface ServerOptions {
	enabled?: boolean
	endpoint?: string
	apiKey?: string
	searchParams?: Record<string, string>
	headers?: Record<string, string>
}
```

#### OptimizationReport

```typescript
interface OptimizationReport {
	originalSize: number
	optimizedSize: number
	compressionRatio: number
	appliedOptimizations: string[]
	stats: {
		vertices: { before: number; after: number }
		triangles: { before: number; after: number }
		materials: { before: number; after: number }
		textures: { before: number; after: number }
		meshes: { before: number; after: number }
		nodes: { before: number; after: number }
	}
}
```

#### SceneLoadResult

```typescript
interface SceneLoadResult {
	file: ModelFile
	settings: SceneSettings
	sceneId: string
	sceneName?: string
	thumbnailUrl?: string | null
}
```

### Hook Return Values

**useLoadModel:**

```typescript
{
  file: ModelFile | null
  isFileLoading: boolean
  progress: number
  load: (files: File[] | FileSystemEntry[]) => void
  loadFromServer: (options: SceneLoadOptions) => Promise<SceneLoadResult>
  reset: () => void
  on: (event: string, handler: Function) => void
  off: (event: string, handler: Function) => void
  optimizer: {
    simplifyOptimization: (options?) => Promise<void>
    dedupOptimization: (options?) => Promise<void>
    quantizeOptimization: (options?) => Promise<void>
    normalsOptimization: (options?) => Promise<void>
    texturesOptimization: (options?) => Promise<void>
    applyOptimization: (fn, options) => Promise<void>
  }
}
```

**useOptimizeModel:**

```typescript
{
  load: (model: Object3D) => void
  getModel: () => Promise<Uint8Array>
  simplifyOptimization: (options?) => Promise<void>
  dedupOptimization: (options?) => Promise<void>
  quantizeOptimization: (options?) => Promise<void>
  normalsOptimization: (options?) => Promise<void>
  texturesOptimization: (options?) => Promise<void>
  getSize: () => { bytes: number; megabytes: string }
  reset: () => void
  report: OptimizationReport | null
  error: Error | null
  loading: boolean
}
```

**useExportModel:**

```typescript
{
  handleGltfExport: (file: ModelFile, binary: boolean) => void
}
```

## Development

This package is part of an Nx monorepo workspace. To contribute or modify the package:

### Setup

```bash
# Clone the repository
git clone https://github.com/vectreal/vectreal-core.git
cd vectreal-core

# Install dependencies
pnpm install

# Build the package
pnpm nx build vctrl/hooks

# Run tests
pnpm nx test vctrl/hooks

# Type checking
pnpm nx typecheck vctrl/hooks

# Lint
pnpm nx lint vctrl/hooks
```

### Project Structure

```
packages/hooks/
├── src/
│   ├── use-load-model/       # Model loading hook
│   │   ├── use-load-model.ts
│   │   ├── types.ts
│   │   ├── reducer.ts
│   │   └── utils/
│   ├── use-optimize-model/   # Optimization hook
│   │   ├── use-optimize-model.ts
│   │   ├── types.ts
│   │   └── utils/
│   ├── use-export-model/     # Export hook
│   │   └── use-export-model.ts
│   ├── utils/                # Shared utilities
│   │   └── server-communication.ts
│   └── index.ts              # Public exports
├── README.md
├── package.json
└── tsconfig.json
```

### Testing

Write tests for new features:

```tsx
// use-load-model.spec.ts
import { renderHook, act } from '@testing-library/react'
import { useLoadModel } from './use-load-model'

describe('useLoadModel', () => {
	it('should load a GLB file', async () => {
		const { result } = renderHook(() => useLoadModel())

		await act(async () => {
			await result.current.load([mockGlbFile])
		})

		expect(result.current.file).toBeDefined()
		expect(result.current.file?.type).toBe('glb')
	})
})
```

### Building

The package is built using Vite and outputs ESM modules:

```bash
# Development build
pnpm nx build vctrl/hooks

# Production build
pnpm nx build vctrl/hooks --configuration=production
```

## Contributing

We welcome contributions! Please follow these guidelines:

### Guidelines

1. **Fork the repository** and create a feature branch
2. **Write meaningful commit messages** using conventional commits:
   - `feat:` - New features
   - `fix:` - Bug fixes
   - `docs:` - Documentation changes
   - `refactor:` - Code refactoring
   - `test:` - Adding tests
   - `chore:` - Maintenance tasks

3. **Add tests** for new functionality
4. **Update documentation** in README and code comments
5. **Ensure all tests pass** before submitting:

```bash
pnpm nx test vctrl/hooks
pnpm nx typecheck vctrl/hooks
pnpm nx lint vctrl/hooks
```

6. **Submit a Pull Request** with:
   - Clear description of changes
   - Link to related issues
   - Screenshots/videos if UI changes

### Code Style

- Use TypeScript for type safety
- Follow existing code patterns
- Add JSDoc comments for public APIs
- Keep functions small and focused
- Prefer composition over inheritance

### Reporting Issues

When reporting bugs, include:

- Package version
- Node.js version
- Browser version (if applicable)
- Minimal reproduction example
- Expected vs actual behavior
- Error messages and stack traces

See our [Contributing Guide](https://github.com/vectreal/vectreal-core/blob/main/CONTRIBUTING.md) for more details.

## License

This project is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0).

**Key Points:**

- ✅ Free to use, modify, and distribute
- ✅ Must disclose source code
- ✅ Must license derivatives under AGPL-3.0
- ✅ Network use is considered distribution
- ❌ Cannot be used in proprietary software without releasing source

See the [LICENSE](https://github.com/vectreal/vectreal-core/blob/main/LICENSE) file for full details.

For commercial licensing options, please contact [Vectreal](https://vectreal.com).

## Support

### Documentation

- 📖 [Full Documentation](https://core.vectreal.com/docs)
- 📖 [Server Scene Loading Guide](./SERVER_SCENE_LOADING.md)
- 📖 [API Reference](#api-reference)
- 📖 [Examples](#real-world-examples)

### Community

- 💬 [GitHub Discussions](https://github.com/vectreal/vectreal-core/discussions) - Ask questions and share ideas
- 🐛 [Issue Tracker](https://github.com/vectreal/vectreal-core/issues) - Report bugs and request features
- 🌐 [Website](https://core.vectreal.com) - Official documentation and demos
- 🐦 [Twitter](https://twitter.com/vectreal) - Updates and announcements

### Getting Help

1. **Check the documentation** - Most questions are answered here
2. **Search existing issues** - Someone may have had the same problem
3. **Create a discussion** - For questions and general help
4. **File an issue** - For bugs and feature requests

### Commercial Support

For enterprise support, custom development, or consulting:

- 📧 Email: support@vectreal.com
- 🌐 Website: https://vectreal.com/enterprise

---

## Acknowledgments

Built with and inspired by:

- [Three.js](https://threejs.org/) - 3D library
- [glTF-Transform](https://gltf-transform.dev/) - glTF optimization
- [React](https://react.dev/) - UI library
- [meshoptimizer](https://github.com/zeux/meshoptimizer) - Mesh optimization algorithms

---

**Made with ❤️ by the [Vectreal](https://github.com/Vectreal) team**

[⬆ Back to Top](#vctrlhooks)
