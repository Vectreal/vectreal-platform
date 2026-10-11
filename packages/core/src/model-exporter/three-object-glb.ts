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

import type { Object3D } from 'three'
import type { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

/**
 * A three.js object as GLB bytes, with the animation clips it carries.
 *
 * The one place an `Object3D` becomes a GLB, because the rule it states was
 * broken at every place that did it separately. `GLTFExporter` writes only the
 * clips handed to it as `options.animations` and defaults that to none, while
 * an object's clips live on `object.animations` - where `FBXLoader` leaves
 * them, and where `model-loader.ts` copies `GLTFLoader`'s, since that loader
 * returns its clips beside the scene rather than on it. Three callers each
 * passed `{ binary: true }` and nothing else, so an animated FBX converted to a
 * still one.
 *
 * Its own module rather than a method of `ModelExporter`: the optimizer needs
 * it too, and importing the exporter would pull JSZip and the Draco encoder
 * into a bundle that reads models. Package-internal; the barrel does not
 * re-export it.
 */
export async function threeObjectToGLB(
	exporter: GLTFExporter,
	object: Object3D
): Promise<Uint8Array> {
	const result = await exporter.parseAsync(object, {
		binary: true,
		animations: object.animations
	})

	if (!(result instanceof ArrayBuffer)) {
		throw new Error('Expected binary GLB output from GLTFExporter')
	}

	return new Uint8Array(result)
}
