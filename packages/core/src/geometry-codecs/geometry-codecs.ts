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
 * Registers the geometry codecs on one WebIO, each once: the decoders before
 * the first read, the Draco encoder only when a Draco step first needs it.
 * `ModelLoader`, `ModelExporter` and `ModelOptimizer` each hold one for their
 * own WebIO.
 */
export class GeometryCodecs {
	private io: WebIO
	private dracoPath: string
	private dracoEncoderRegistration: Promise<void> | null = null
	private dracoDecoderRegistration: Promise<void> | null = null
	private meshoptRegistration: Promise<void> | null = null

	constructor(io: WebIO, dracoPath: string) {
		this.io = io
		this.dracoPath = dracoPath
	}

	/**
	 * So `writeBinary`/`writeJSON` can encode `KHR_draco_mesh_compression`
	 * primitives after `document.transform(draco(...))`.
	 */
	registerDracoEncoder(): Promise<void> {
		if (!this.dracoEncoderRegistration) {
			this.dracoEncoderRegistration = canLoadDracoInBrowser()
				? loadDracoModule('encoder', this.dracoPath).then((encoderModule) => {
						this.io.registerDependencies({
							'draco3d.encoder': encoderModule
						})
					})
				: Promise.reject(
						new Error(
							'Draco encoding requires a browser (window or worker) environment'
						)
					)
		}
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
	 * Outside a browser or worker there is no Draco decoder to load, and
	 * meshopt's can fail to compile where WebAssembly is blocked. Either way
	 * other content is unaffected, and content needing the missing decoder
	 * throws glTF-Transform's own "install extension dependency" error.
	 */
	registerDecoders(extensionsUsed: readonly string[] | null): Promise<void> {
		this.meshoptRegistration ??= registerMeshoptDecoder(this.io).catch(() => {})
		const needsDraco =
			extensionsUsed === null || extensionsUsed.includes(DRACO_EXTENSION)
		if (needsDraco && canLoadDracoInBrowser()) {
			this.dracoDecoderRegistration ??= loadDracoModule(
				'decoder',
				this.dracoPath
			).then((decoderModule) => {
				this.io.registerDependencies({ 'draco3d.decoder': decoderModule })
			})
			return Promise.all([
				this.meshoptRegistration,
				this.dracoDecoderRegistration
			]).then(() => undefined)
		}
		return this.meshoptRegistration
	}
}
