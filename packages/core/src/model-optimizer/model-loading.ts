/* vectreal-core | @vctrl/core
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>. */

/**
 * Load method implementations for ModelOptimizer.
 *
 * Each function returns `{ document, originalSize }` so the class can keep its
 * private state clean without knowing how the data arrived.
 */

import { Document, JSONDocument, WebIO } from '@gltf-transform/core'
import { inspect, InspectReport } from '@gltf-transform/functions'
import { Object3D } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

import { stripDecodedDracoExtension } from '../draco/strip-decoded-draco-extension'

type LoadResult = {
	document: Document
	originalSize: number
	originalReport: InspectReport
}

type ProgressEmitter = (operation: string, progress: number) => void
type NormalizeURIs = (document: Document) => void

// ---------------------------------------------------------------------------
// loadFromThreeJS
// ---------------------------------------------------------------------------

export async function loadFromThreeJS(
	model: Object3D,
	io: WebIO,
	exporter: GLTFExporter,
	emitProgress: ProgressEmitter,
	normalizeURIs: NormalizeURIs
): Promise<LoadResult> {
	emitProgress('Loading model from Three.js object', 0)

	try {
		const parseOptions = { binary: true }
		const binary = await exporter.parseAsync(model, parseOptions)
		const modelBuffer = new Uint8Array(binary as ArrayBuffer)
		const result = await loadFromBuffer(
			modelBuffer,
			io,
			emitProgress,
			normalizeURIs
		)
		emitProgress('Model loaded successfully', 100)
		return result
	} catch (error) {
		throw new Error(`Failed to load Three.js model: ${error}`, { cause: error })
	}
}

// ---------------------------------------------------------------------------
// loadFromBuffer
// ---------------------------------------------------------------------------

export async function loadFromBuffer(
	buffer: Uint8Array,
	io: WebIO,
	emitProgress: ProgressEmitter,
	normalizeURIs: NormalizeURIs
): Promise<LoadResult> {
	emitProgress('Loading model from buffer', 0)

	try {
		if (buffer.byteLength === 0) {
			throw new Error('Buffer is empty')
		}

		const magicBytes = buffer.slice(0, 4)
		const magic = String.fromCharCode(...magicBytes)

		if (magic !== 'glTF') {
			console.error('Invalid buffer format:', {
				byteLength: buffer.byteLength,
				firstBytes: Array.from(buffer.slice(0, 16)),
				magicString: magic
			})
			throw new Error(
				`Invalid glTF 2.0 binary. Expected 'glTF' magic bytes, got '${magic}'`
			)
		}

		const document = await io.readBinary(buffer)
		stripDecodedDracoExtension(document)
		const originalSize = buffer.byteLength
		const originalReport = inspect(document)
		normalizeURIs(document)
		emitProgress('Model loaded successfully', 100)

		return { document, originalSize, originalReport }
	} catch (error) {
		throw new Error(`Failed to load model from buffer: ${error}`, {
			cause: error
		})
	}
}

// ---------------------------------------------------------------------------
// loadFromFile
// ---------------------------------------------------------------------------

export async function loadFromFile(
	filePath: string,
	io: WebIO,
	emitProgress: ProgressEmitter,
	normalizeURIs: NormalizeURIs
): Promise<LoadResult> {
	emitProgress('Loading model from file', 0)

	try {
		const fs = await import(/* @vite-ignore */ 'fs/promises')
		const buffer = await fs.readFile(filePath)
		return await loadFromBuffer(
			new Uint8Array(buffer),
			io,
			emitProgress,
			normalizeURIs
		)
	} catch (error) {
		throw new Error(`Failed to load model from file: ${error}`, {
			cause: error
		})
	}
}

// ---------------------------------------------------------------------------
// loadFromJSON
// ---------------------------------------------------------------------------

export async function loadFromJSON(
	json: JSONDocument,
	io: WebIO,
	emitProgress: ProgressEmitter,
	normalizeURIs: NormalizeURIs,
	exportFn: () => Promise<Uint8Array>
): Promise<LoadResult> {
	emitProgress('Loading model from JSON document', 0)

	try {
		const document = await io.readJSON(json)
		stripDecodedDracoExtension(document)
		const originalReport = inspect(document)
		normalizeURIs(document)
		const binary = await exportFn()
		const originalSize = binary.byteLength

		return { document, originalSize, originalReport }
	} catch (error) {
		throw new Error(`Failed to load model from JSON document: ${error}`, {
			cause: error
		})
	}
}

// ---------------------------------------------------------------------------
// loadFromGLTFWithAssets
// ---------------------------------------------------------------------------

export async function loadFromGLTFWithAssets(
	gltfBytes: Uint8Array,
	assets: Map<string, Uint8Array>,
	io: WebIO,
	emitProgress: ProgressEmitter,
	normalizeURIs: NormalizeURIs,
	exportFn: () => Promise<Uint8Array>
): Promise<LoadResult> {
	emitProgress('Loading model from GLTF with assets', 0)

	try {
		const gltfText = new TextDecoder().decode(gltfBytes)
		const gltfJson = JSON.parse(gltfText) as JSONDocument['json']

		const resources: JSONDocument['resources'] = {}
		for (const [uri, data] of assets.entries()) {
			resources[uri] = data as Uint8Array<ArrayBuffer>
		}

		const jsonDocument: JSONDocument = { json: gltfJson, resources }
		return await loadFromJSON(
			jsonDocument,
			io,
			emitProgress,
			normalizeURIs,
			exportFn
		)
	} catch (error) {
		throw new Error(`Failed to load GLTF with assets: ${error}`, {
			cause: error
		})
	}
}
