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
 * The accepted-format set, and the only place it is stated.
 *
 * It had nine statements before this module: the `ModelFileTypes` enum, the
 * switch in `getFileType`, `supportedFileTypes`, `findByExtension`, the
 * `modelFiles` array behind the `multiple_models` guard, the file input's
 * accept attribute, `SUPPORTED_FORMAT_NAMES`, a load-error string, and the
 * converter's capability sets. Nothing kept them in agreement, and they were
 * not in agreement: the accept attribute offered `.usda`, which no loader has
 * ever read, and the marketing carousel advertises FBX and OBJ today.
 *
 * WHY THIS FILE IMPORTS NOTHING, AND MUST KEEP IMPORTING NOTHING.
 * `apps/vectreal-platform/react-router.config.ts` derives the prerendered
 * `/convert/:pair` paths from a manifest that is bound to this set, and a
 * config file is bundled before any alias plugin runs: `@vctrl/core` resolves
 * there through `node_modules`, which points at `build/packages/vctrl/core`
 * (`publishConfig.directory`) - a directory CI has not built at that point,
 * because the app's `build-ci` target declares no `^build`. So the manifest
 * reaches this module as a **type-only** import, which erases, and anything
 * that made this file carry a runtime dependency would break the app build on
 * a clean checkout rather than here.
 *
 * Adding a format is one entry. The consumers derive, so none of them has to
 * be found and edited - which is the failure this module exists to end.
 */

/** A format this library knows about, named by its canonical extension. */
export type ModelFormatId = 'gltf' | 'glb' | 'usdz' | 'stl' | 'fbx' | 'obj'

export interface ModelFormat {
	id: ModelFormatId
	/** Canonical extension, lower case, without the dot. */
	extension: string
	/**
	 * How the format is written in prose, headings and chips.
	 *
	 * Here because the marketing copy kept its own list of these and drifted
	 * three formats behind the loader, which is how a converter page for a
	 * format shipped in the same sitemap as a sentence saying that format does
	 * not load. A name is part of what the owner owns.
	 */
	label: string
	/** Media types a file picker should offer alongside the extension. */
	mimeTypes: readonly string[]
	/** The loader can read it. */
	canImport: boolean
	/** The exporter can write it. */
	canExport: boolean
	/**
	 * The file is a manifest pointing at siblings, so a picker that takes only
	 * the one file hands the loader an incomplete model.
	 */
	isBundle: boolean
	/**
	 * Extensions a bundle's siblings carry. Empty for a self-contained format.
	 * These are not formats: nothing dispatches on them, and a picker offering
	 * them is the only reason they are recorded.
	 */
	siblingExtensions: readonly string[]
}

/**
 * Declaration order is the order a file picker and the `multiple_models` guard
 * see, so `gltf` leads: it is the one whose siblings also match, and a folder
 * holding a `.gltf` beside a `.glb` should be read as the bundle.
 */
export const MODEL_FORMATS: readonly ModelFormat[] = [
	{
		id: 'gltf',
		extension: 'gltf',
		label: 'glTF',
		mimeTypes: ['model/gltf+json'],
		canImport: true,
		canExport: true,
		isBundle: true,
		siblingExtensions: ['bin', 'jpeg', 'jpg', 'png', 'webp']
	},
	{
		id: 'glb',
		extension: 'glb',
		label: 'GLB',
		mimeTypes: ['model/gltf-binary'],
		canImport: true,
		canExport: true,
		isBundle: false,
		siblingExtensions: []
	},
	{
		/*
		  Import is listed because the loader dispatches on it and the product
		  offers it; it is also known to be broken, since `loadFromBuffer` hands a
		  zip archive to a glTF reader. That is tracked on its own and is not this
		  module's to decide - recording the dispatch honestly is.
		*/
		id: 'usdz',
		extension: 'usdz',
		label: 'USDZ',
		mimeTypes: ['model/vnd.usdz+zip'],
		canImport: true,
		canExport: true,
		isBundle: false,
		siblingExtensions: []
	},
	{
		/*
		  Read through three.js rather than by glTF-Transform: an STL is raw
		  triangles with no materials, no scene graph and no textures, so nothing
		  in the glTF family can parse it. `ModelLoader` converts it to GLB before
		  the document pipeline sees it - see `three-source-bridges.ts`.

		  `canExport: false` IS a decision, and the reason recorded here was
		  wrong: three.js does ship `STLExporter`. What it cannot do is carry
		  anything but geometry - an STL has no materials, no textures and no
		  scene graph - so writing one discards most of what a visitor brought,
		  and offering "to STL" would be offering that silently. Revisiting it
		  means deciding whether that trade is worth a page, not waiting on
		  three.js. It is also the first format here whose flags disagree, which is
		  what puts real data behind the exportable/importable split. Not behind
		  the `canImport` skip in `modelAcceptPattern`, which is still
		  unreachable from the real declarations - every format here is
		  importable, as the note on that function says.
		*/
		id: 'stl',
		extension: 'stl',
		label: 'STL',
		mimeTypes: ['model/stl'],
		canImport: true,
		canExport: false,
		isBundle: false,
		siblingExtensions: []
	},
	{
		/*
		  Read through three.js, like STL, and for the same reason: nothing in
		  the glTF family can parse it. `canExport: false` is three.js's limit
		  again - it ships `FBXLoader` and no FBX writer - and it is why the
		  marketing carousel's FBX claim stays false in the other direction
		  until someone converts *to* it, which needs an engine we do not have.

		  `isBundle: false` because an FBX carries its textures inside the file
		  in the overwhelming majority of cases. One that references siblings
		  instead resolves them against the page, finds nothing, and arrives
		  untextured rather than failing - which is the honest outcome for a
		  file that is genuinely incomplete on its own.

		  There is no registered media type for FBX. `model/fbx` is what the
		  tools that name one use; the extension is what actually matches in a
		  file picker, and the media type is the hint beside it.
		*/
		id: 'fbx',
		extension: 'fbx',
		label: 'FBX',
		mimeTypes: ['model/fbx'],
		canImport: true,
		canExport: false,
		isBundle: false,
		siblingExtensions: []
	},
	{
		/*
		  The second bundle, and the first one that is not glTF. An OBJ is
		  geometry only: its materials live in a `.mtl` beside it and its images
		  beside that, so a picker that takes the one file the visitor clicked
		  hands the loader a model with no surfaces at all. That is why
		  `isBundle` is a property of the format rather than a branch in the
		  dispatch - the dispatch now has two answers to it.

		  Read through three.js like STL and FBX, and `canExport: false` for the
		  same reason: `OBJExporter` exists in three but writes geometry without
		  the material library, so a page offering it would hand people a file
		  missing the half of the format that needs a sibling.

		  `model/obj` is not registered either; see the FBX row.
		*/
		id: 'obj',
		extension: 'obj',
		label: 'OBJ',
		mimeTypes: ['model/obj'],
		canImport: true,
		canExport: false,
		isBundle: true,
		/*
		  The material library, and the image formats a browser can actually
		  decode. TGA and BMP appear in older OBJ sets and are deliberately
		  absent: offering them in the picker would accept a file that reaches
		  `ImageLoader` and silently fails to become a texture.
		*/
		siblingExtensions: ['mtl', 'jpeg', 'jpg', 'png', 'webp']
	}
]

const BY_ID = new Map<string, ModelFormat>(
	MODEL_FORMATS.map((format) => [format.id, format])
)

const BY_EXTENSION = new Map<string, ModelFormat>(
	MODEL_FORMATS.map((format) => [format.extension, format])
)

/** Every format id, in declaration order. */
export const MODEL_FORMAT_IDS: readonly ModelFormatId[] = MODEL_FORMATS.map(
	(format) => format.id
)

export function modelFormat(id: ModelFormatId): ModelFormat {
	const format = BY_ID.get(id)
	if (!format) {
		throw new Error(`Unknown model format: ${id}`)
	}
	return format
}

/**
 * How each importable format is written in prose, in declaration order.
 *
 * The one list any copy naming "the formats we accept" should read. The
 * alternative is what was there: a hand-maintained array in `product-copy.ts`
 * carrying three names while the loader read six, feeding the sitewide meta
 * keywords, `/llms.txt`, the home page and a schema.org `featureList`.
 */
export const IMPORTABLE_FORMAT_LABELS: readonly string[] = MODEL_FORMATS.filter(
	(format) => format.canImport
).map((format) => format.label)

/** Ids the loader can read, in declaration order. */
export const IMPORTABLE_FORMAT_IDS: readonly ModelFormatId[] =
	MODEL_FORMATS.filter((format) => format.canImport).map((format) => format.id)

/** Ids the exporter can write, in declaration order. */
export const EXPORTABLE_FORMAT_IDS: readonly ModelFormatId[] =
	MODEL_FORMATS.filter((format) => format.canExport).map((format) => format.id)

/** Ids whose file is a manifest pointing at siblings. */
export const BUNDLE_FORMAT_IDS: readonly ModelFormatId[] = MODEL_FORMATS.filter(
	(format) => format.isBundle
).map((format) => format.id)

/**
 * The file's own name, whether it arrives bare or carrying its folders.
 *
 * Both separators, because the callers disagree about which they use: a
 * `File.name` is bare, a dropped selection key is forward-slashed, and an MTL
 * or a picker on Windows writes backslashes. Splitting on `/` alone made this
 * answer correctly for two of the three and quietly wrongly for the third.
 */
function basenameOf(path: string): string {
	const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
	return path.slice(cut + 1)
}

/**
 * The format a file name names, or `null`.
 *
 * Lower-cases before matching, which is the whole point of routing every
 * dispatch through here: `findByExtension` compared raw with `endsWith` while
 * `getFileType` lower-cased, so `MODEL.GLB` loaded through one path and was
 * rejected as an unsupported format by the other. A case-sensitive matcher
 * extended to six formats multiplies that by six.
 */
export function modelFormatForFileName(fileName: string): ModelFormat | null {
	const lowered = fileName.toLowerCase()

	/*
	  A macOS AppleDouble sidecar is the resource fork of the file it is named
	  after, and it ends in that file's extension - so `._chair.gltf` read as a
	  glTF. `findImportableModels` keeps the *first* file of each format, so a
	  folder off exFAT or out of an unzipped archive could hand the loader a 4 KB
	  metadata blob as the model and fail outright.

	  It reaches further than a dropped folder: a saved scene's glTF is named
	  after the scene's title, so a title starting `._` produced a file this
	  refuses. `sceneGltfFileName` in `@vctrl/hooks` is what keeps a title from
	  landing here.
	*/
	if (basenameOf(lowered).startsWith('._')) {
		return null
	}

	const dot = lowered.lastIndexOf('.')

	/*
	  The dot is required, and that is not pedantry. `split('.').pop()` on a
	  name with no dot returns the whole name, so a file called exactly `glb`
	  read as a GLB - which the `endsWith('.glb')` this replaced did not do. The
	  damaging shape is a stray extension-less file in a dropped folder turning
	  a good model into "Multiple models found".

	  `lastIndexOf` rather than `indexOf`, so `model.tar.glb` is a GLB, and
	  `dot < 0` rather than `dot <= 0`, so a dotfile named `.glb` still matches
	  as it always has.
	*/
	if (dot < 0) {
		return null
	}

	return BY_EXTENSION.get(lowered.slice(dot + 1)) ?? null
}

/** Whether a file name names a format the loader can read. */
export function isImportableFileName(fileName: string): boolean {
	return modelFormatForFileName(fileName)?.canImport === true
}

/**
 * The `accept` attribute for a file input that takes a model.
 *
 * Bundle siblings are included because a `.gltf` selected without its `.bin`
 * and images cannot be loaded, so a picker that filters them out guarantees the
 * failure it is trying to prevent.
 *
 * Takes the format list as an argument only so a test can drive the two rules
 * inside it. The `canImport` skip is not reachable from the real declarations
 * today, because every format is importable, so a test over `MODEL_FORMATS`
 * alone would leave it unprotected. The de-duplication is reachable: two
 * formats carry siblings and their image extensions overlap exactly, because
 * OBJ arrives with an MTL and images that glTF also names.
 */
export function modelAcceptPattern(
	formats: readonly ModelFormat[] = MODEL_FORMATS
): string {
	const parts: string[] = []
	const seen = new Set<string>()

	const push = (value: string) => {
		if (!seen.has(value)) {
			seen.add(value)
			parts.push(value)
		}
	}

	for (const format of formats) {
		if (!format.canImport) continue
		for (const mimeType of format.mimeTypes) push(mimeType)
		push(`.${format.extension}`)
	}

	for (const format of formats) {
		if (!format.canImport) continue
		for (const sibling of format.siblingExtensions) push(`.${sibling}`)
	}

	return parts.join(',')
}
