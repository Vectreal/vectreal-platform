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

/**
 * Registers the geometry codecs on one WebIO the first time each is needed,
 * so a model that uses neither never loads them.
 */
export class GeometryCodecs {
	private io: WebIO
	private dracoPath: string
	private dracoEncoderRegistration: Promise<void> | null = null
	private decoderRegistration: Promise<void> | null = null

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
	 * `EXT_meshopt_compression` primitives — needed both for loading
	 * pre-compressed input and for reloading the optimizer's own
	 * Draco-compressed output (e.g. syncing the worker's compressed buffer back
	 * to the main-thread optimizer via `loadFromBuffer`). Draco no-ops outside a
	 * browser.
	 */
	registerDecoders(): Promise<void> {
		if (!this.decoderRegistration) {
			const draco = canLoadDracoInBrowser()
				? loadDracoModule('decoder', this.dracoPath).then((decoderModule) => {
						this.io.registerDependencies({
							'draco3d.decoder': decoderModule
						})
					})
				: Promise.resolve()
			this.decoderRegistration = Promise.all([
				draco,
				// Tolerated for the reason ModelLoader tolerates it: only meshopt
				// content needs it, and that content then fails with its own error.
				registerMeshoptDecoder(this.io).catch(() => {})
			]).then(() => undefined)
		}
		return this.decoderRegistration
	}
}
