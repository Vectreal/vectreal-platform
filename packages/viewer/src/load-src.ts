import { modelFormatForFileName } from '@vctrl/core/model-formats'
import {
	fetchModelFiles,
	isThreeSourceFormat,
	ModelLoader
} from '@vctrl/core/model-loader'

import type { AnimationClip, Object3D } from 'three'

export interface SrcLoadOptions {
	/** Spread into every request: headers, `credentials`, a `signal`. */
	init?: RequestInit
	/** Where the Draco decoder is served from. Defaults to `/draco/` on the page's origin. */
	dracoDecoderPath?: string
	/** Where the KTX2 transcoder is served from. Defaults to `/basis/` on the page's origin. */
	ktx2TranscoderPath?: string
}

export interface SrcModel {
	model: Object3D
	animations: AnimationClip[]
}

/**
 * Fetches and parses the model a `src` names.
 *
 * The only module in the viewer that imports the loader, and reached only
 * through `import()`, so the parsers land in a chunk of their own and a page
 * that passes `model` never downloads them.
 *
 * Takes the route `useLoadModel` does for the same files: glTF-Transform reads
 * a glTF's own references, and everything else, an OBJ's material library
 * included, goes through `loadToThreeJS`. Asked of the format owner rather than
 * of the extension, so the two cannot disagree about which format is which.
 */
export async function loadSrcModel(
	src: string | URL,
	{ init, dracoDecoderPath, ktx2TranscoderPath }: SrcLoadOptions
): Promise<SrcModel> {
	const [file, ...siblings] = await fetchModelFiles(src, { init })
	const loader = new ModelLoader({ dracoDecoderPath, ktx2TranscoderPath })
	const format = modelFormatForFileName(file.name)

	const result =
		format?.isBundle && !isThreeSourceFormat(format.id)
			? await loader.loadGLTFWithAssetsToThreeJS(file, siblings)
			: await loader.loadToThreeJS(file, siblings)

	return { model: result.scene, animations: result.animations }
}
