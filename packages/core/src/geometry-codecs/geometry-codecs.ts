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

import { WebIO } from '@gltf-transform/core'

import {
	canLoadDracoInBrowser,
	loadDracoModule
} from '../draco/load-draco-module'
import { registerMeshoptDecoder } from '../meshopt/meshopt-codec'
import { DRACO_EXTENSION } from '../model-loader/glb-extensions'

/**
 * Draco's Emscripten modules, from wherever the caller can load them: in Node,
 * the `draco3d` package. Each is asked for once, when first needed.
 *
 * Each must resolve to the module with no `then` of its own. An Emscripten
 * module that keeps one resolves with itself, and the promise chain
 * re-assimilates it forever.
 */
export interface DracoModules {
	encoder: () => Promise<unknown>
	decoder: () => Promise<unknown>
}

/**
 * Registers the geometry codecs on one WebIO, each once: the decoders before
 * the first read, the Draco encoder only when a Draco step first needs it.
 * `ModelLoader`, `ModelExporter` and `ModelOptimizer` each hold one for their
 * own WebIO.
 *
 * Draco comes from `dracoModules` when given, and otherwise from the scripts
 * at `dracoPath`, which only a browser or worker can load.
 */
export class GeometryCodecs {
	private io: WebIO
	private dracoPath: string
	private dracoModules: DracoModules | undefined
	private dracoEncoderRegistration: Promise<void> | null = null
	private dracoDecoderRegistration: Promise<void> | null = null
	private meshoptRegistration: Promise<void> | null = null

	constructor(io: WebIO, dracoPath: string, dracoModules?: DracoModules) {
		this.io = io
		this.dracoPath = dracoPath
		this.dracoModules = dracoModules
	}

	/** The Draco module of `kind`, or a refusal saying why there is none. */
	private loadDraco(kind: 'encoder' | 'decoder'): Promise<unknown> {
		if (this.dracoModules) return this.dracoModules[kind]()
		return canLoadDracoInBrowser()
			? loadDracoModule(kind, this.dracoPath)
			: Promise.reject(
					new Error(
						`Draco ${kind === 'encoder' ? 'encoding' : 'decoding'} needs a browser (window or worker), or Draco modules passed in`
					)
				)
	}

	/**
	 * So `writeBinary`/`writeJSON` can encode `KHR_draco_mesh_compression`
	 * primitives after `document.transform(draco(...))`.
	 */
	registerDracoEncoder(): Promise<void> {
		this.dracoEncoderRegistration ??= this.loadDraco('encoder').then(
			(encoderModule) => {
				this.io.registerDependencies({ 'draco3d.encoder': encoderModule })
			}
		)
		return this.dracoEncoderRegistration
	}

	/**
	 * So `readBinary`/`readJSON` can decode `KHR_draco_mesh_compression` and
	 * `EXT_meshopt_compression` primitives in pre-compressed input.
	 *
	 * The Draco decoder is fetched only for a model that declares it, or one
	 * whose extensions the caller could not read: it is a separate download from
	 * `dracoPath`, which a page that never serves Draco content has no reason to
	 * host. Its failure is the model's failure, and names the path it tried.
	 *
	 * Outside a browser or worker, without `dracoModules`, there is no Draco
	 * decoder to load, and meshopt's can fail to compile where WebAssembly is
	 * blocked. Either way other content is unaffected. Content needing the
	 * missing decoder fails to read: glTF-Transform's own "install extension
	 * dependency" error for meshopt, and for Draco a TypeError from inside its
	 * reader.
	 */
	registerDecoders(extensionsUsed: readonly string[] | null): Promise<void> {
		this.meshoptRegistration ??= registerMeshoptDecoder(this.io).catch(() => {})
		const needsDraco =
			extensionsUsed === null || extensionsUsed.includes(DRACO_EXTENSION)
		if (needsDraco && (this.dracoModules || canLoadDracoInBrowser())) {
			this.dracoDecoderRegistration ??= this.loadDraco('decoder').then(
				(decoderModule) => {
					this.io.registerDependencies({ 'draco3d.decoder': decoderModule })
				}
			)
			return Promise.all([
				this.meshoptRegistration,
				this.dracoDecoderRegistration
			]).then(() => undefined)
		}
		return this.meshoptRegistration
	}
}
