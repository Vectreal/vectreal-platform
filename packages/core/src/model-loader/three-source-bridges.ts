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

import { referenceIn } from './dropped-selection'

import type { ModelFormatId } from '../model-formats'
import type { LoadingManager, Mesh, Object3D, Texture } from 'three'

/**
 * Formats that reach this pipeline through a three.js loader rather than
 * through glTF-Transform.
 *
 * WHY A BRIDGE AND NOT A SECOND PIPELINE. Everything downstream of loading -
 * the optimizer, every export, the before/after measurement, the viewer's own
 * re-parse - operates on a glTF-Transform `Document`. A format three.js can
 * read is therefore parsed into an `Object3D` here and re-serialized as GLB
 * once, and the existing GLB path carries it from there untouched. The
 * alternative, teaching each pass about each format, is how a converter
 * becomes six converters.
 *
 * WHY THE LOADERS ARE IMPORTED DYNAMICALLY. `FBXLoader` alone is about a
 * megabyte, and a visitor who opens a GLB page should not download the parser
 * for a format they did not bring. `exportThreeJSUSDZ` establishes the same
 * pattern for the same reason.
 *
 * The map is the one statement of which formats take this route. A format that
 * declares `canImport` in `MODEL_FORMATS` and has no entry here is read as
 * glTF, which is correct for the glTF family and a parse error for anything
 * else - so `three-source-bridges.spec.ts` asserts the two agree in *both*
 * directions rather than leaving it to a visitor to discover. The reverse half
 * is the one that matters when a format is added: without it, a new row in the
 * owner with no bridge here compiles, ships, prerenders three pages and fails
 * on the first file anyone drops.
 *
 * The map itself is `BRIDGES`, declared near the bottom of this file beside the
 * parsers it names; this sits at the top because it is the argument for the
 * whole module rather than for one constant.
 */

/**
 * Files that arrived beside the model, keyed by the name the model refers to
 * them by: the lower-cased file name, and its path inside a dropped folder
 * where there is one. Empty for a format that carries everything itself.
 */
export type ModelSiblings = ReadonlyMap<string, Uint8Array>

export type ThreeSourceBridge = (
	bytes: Uint8Array,
	siblings: ModelSiblings,
	/**
	 * Where the model itself sits in the selection, in the same spelling the
	 * siblings are keyed by. A reference inside a model is written relative to
	 * the model, so without this there is nothing to resolve it *against* and
	 * every lookup is a guess between same-named files in unrelated folders.
	 */
	modelPath: string
) => Promise<Object3D>

/**
 * An STL is a bag of triangles: no scene graph, no materials, no textures, no
 * units. `STLLoader` reads both the binary and the ASCII spelling and returns
 * geometry, so the mesh and its material are made here.
 */
const parseSTL: ThreeSourceBridge = async (bytes) => {
	const [{ STLLoader }, { Mesh, MeshStandardMaterial }] = await Promise.all([
		import('three/examples/jsm/loaders/STLLoader.js'),
		import('three')
	])

	const geometry = new STLLoader().parse(toArrayBuffer(bytes))

	/*
	  STL to glTF is a change of up axis, and skipping it writes a broken file
	  rather than an oddly framed preview.

	  An STL declares no axes at all - it is triangles and a header - but every
	  producer of one is a CAD package or a slicer, and those are Z-up because a
	  print bed is. glTF *mandates* Y-up (spec 3.4: "the Y axis is up"), so
	  handing the exporter raw STL coordinates produces a GLB that our viewer,
	  model-viewer, Blender and Quick Look all lay on its side. A tall part comes
	  out pointing at the camera, which reads as the controls being inverted when
	  you drag: the model tumbles where it should turn.

	  `rotateX(-90deg)` maps (x, y, z) to (x, z, -y), and it transforms the
	  normals with the positions. The cost is the rare Y-up STL, which this lays
	  down instead - unavoidable, since nothing in the file says which it is, and
	  the convention it follows is the one nearly every STL was written with.
	*/
	geometry.rotateX(-Math.PI / 2)

	/*
	  An explicit material rather than three's default, because this one is
	  written into the exported GLB and every downstream reader sees it. Matte
	  white is what a print preview should look like and what every STL viewer
	  shows; a default that later changed upstream would silently change the
	  file people download.
	*/
	return new Mesh(
		geometry,
		new MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 1 })
	)
}

/**
 * An FBX, as three.js reads it.
 *
 * Unlike STL this is a whole scene: a graph, materials, textures the file
 * usually carries inside itself, and often skinning and animation.
 *
 * ANIMATION DOES NOT SURVIVE THE ROUND TRIP, and it is not glTF's fault.
 * `FBXLoader` leaves its clips on `object.animations`, while three's
 * `GLTFExporter` writes only the clips handed to it as `options.animations` and
 * defaults that to none - so `exportThreeJSGLB` drops every clip. Skinning does
 * survive, which is what made this easy to state the other way round.
 */
const parseFBX: ThreeSourceBridge = async (bytes, siblings, modelPath) => {
	const [{ FBXLoader }, { LoadingManager }] = await Promise.all([
		import('three/examples/jsm/loaders/FBXLoader.js'),
		import('three')
	])

	/*
	  Its own manager, never the default one. Texture loads are tracked on the
	  manager, and `DefaultLoadingManager` is global: two conversions in one tab
	  would settle against each other's counts.
	*/
	const manager = new LoadingManager()
	/*
	  An FBX almost always carries its images inside itself, and those arrive as
	  blob URLs the loader made - passed through untouched.

	  One that names a sibling instead is *blocked*, not resolved, and that is
	  worth stating plainly because the call below reads as though it could go
	  either way: `fbx` is `isBundle: false` in the owner, and the dispatch only
	  gathers siblings for a bundle, so this map is always empty here today. The
	  half that runs is the half that matters - without it the page asks the site
	  for the texture and then waits on an answer a dev server gives as the app
	  shell, which never resolves and never errors. The resolving half is shared
	  with OBJ, where the siblings do arrive, and starts working for FBX the day
	  the owner's row says it is a bundle.
	*/
	const releaseTextures = resolveTexturesFromSiblings(
		manager,
		siblings,
		modelPath
	)
	const texturesSettled = watchTextureLoads(manager)

	/*
	  `finally`, because a file that fails to parse is an ordinary outcome here -
	  it is the refusal the page reports - and the blob URLs made for its
	  textures would otherwise be held for as long as the tab is open, on a page
	  whose whole purpose is that you try another file.
	*/
	try {
		const object = new FBXLoader(manager).parse(toArrayBuffer(bytes), '')

		/*
		  The up axis needs nothing here, and that asymmetry with STL is the
		  point: an FBX *states* its axis in `GlobalSettings.UpAxis`, and
		  `FBXLoader` already rotates the root when it reads Z-up. Adding our own
		  rotation would lay every Z-up FBX on its side - the exact defect we
		  fixed for STL, reintroduced by copying its fix.
		*/
		applyUnitScale(object)

		/*
		  `TextureLoader` fills a texture in asynchronously, so `parse` returns
		  with every image still blank. Exporting now writes a GLB whose textures
		  are 1x1 placeholders - a conversion that succeeds, downloads, and is
		  wrong, which is worse than one that fails. A load that errors still
		  ends, so a file naming a texture it does not carry settles rather than
		  hanging.
		*/
		await texturesSettled()
		dropFailedTextures(object)

		return object
	} finally {
		/*
		  Safe here, and only here: an image that has finished loading keeps its
		  decoded bitmap, so the exporter can still draw it. Releasing before the
		  wait would cancel a load that has not happened yet.
		*/
		releaseTextures()
	}
}

/**
 * Watches a manager for texture loads, and hands back the wait for them.
 *
 * Two calls rather than one promise, because the order is the whole mechanism:
 * the handlers have to be installed *before* parsing, since `itemStart` runs
 * synchronously inside `parse`, and the wait can only be evaluated *after* it,
 * once it is known whether anything started at all. A single promise would have
 * to infer that boundary from microtask timing, which works and reads like an
 * accident.
 *
 * `onStart` fires only for the first item of a batch, which is exactly the
 * signal needed: no item means nothing to wait for, and waiting anyway would
 * hang every file that carries no textures on an `onLoad` that never comes.
 *
 * Exported for its own test rather than only through a parse: both branches
 * turn on a manager's callbacks, and the one that matters - a file with no
 * textures at all - cannot be reached from a fixture without a DOM to load an
 * image with. It is package-internal; the barrel does not re-export it.
 */
export function watchTextureLoads(
	manager: LoadingManager
): () => Promise<void> {
	let started = false
	let finished: () => void

	const settled = new Promise<void>((resolve) => {
		finished = resolve
	})

	manager.onStart = () => {
		started = true
	}
	/* A load that fails still ends, so `onLoad` runs for a missing texture. */
	manager.onLoad = () => finished()

	return () => (started ? settled : Promise.resolve())
}

/**
 * The scale that turns the file's own unit into the metre glTF specifies.
 *
 * glTF 2.0 states its linear unit is the metre. FBX does not have one: it
 * records `UnitScaleFactor`, the number of centimetres one unit represents, and
 * `FBXLoader` copies it to `userData` without acting on it. Maya and 3ds Max
 * both default to centimetres, so the common case is a file whose numbers are
 * 100x the metres they mean - and a 1.8 m character exports as a 180 m one.
 *
 * Our own viewer hides this, because it frames whatever it is given. The
 * downloaded file does not, and `fbx-to-usdz` is where it shows: AR Quick Look
 * places a model at real-world size, so the wrong factor puts a building-sized
 * chair in someone's room.
 *
 * The cost is a file that misdeclares its unit, which this scales by the lie it
 * told. That is narrower than the alternative, which is ignoring a number the
 * format exists to state. An absent factor is left alone rather than assumed:
 * nothing is known about that file's unit, and guessing centimetres there would
 * shrink a correct model by 100.
 */
function applyUnitScale(object: Object3D): void {
	const carrier = unitScaleCarrier(object)
	if (!carrier) return

	/* Bracketed because `userData` is an index signature, not a shape. */
	const centimetresPerUnit = carrier.userData['unitScaleFactor']

	if (typeof centimetresPerUnit !== 'number') return
	if (!Number.isFinite(centimetresPerUnit) || centimetresPerUnit <= 0) return

	const metresPerUnit = centimetresPerUnit / 100
	object.scale.multiplyScalar(metresPerUnit)

	/*
	  And then stop saying it. `userData` is written straight into the exported
	  file as `extras`, so leaving the factor there ships a GLB whose own
	  metadata declares a unit its coordinates no longer use - an invitation for
	  the next reader to apply it a second time.
	*/
	delete carrier.userData['unitScaleFactor']
}

/**
 * The object `FBXLoader` wrote `unitScaleFactor` on, which is not always the
 * one it hands back.
 *
 * `addGlobalSceneSettings` writes the factor onto the scene root it built, and
 * runs *before* the collapse that replaces that root with its only child when
 * the file has a single top-level group - the shape a default Maya, 3ds Max or
 * Blender export takes, so it is the common case rather than an edge one. The
 * returned object is then the child, carrying no factor of its own.
 *
 * The parent is still reachable: the collapse reassigns a local variable and
 * unparents nothing. So this walks up rather than reading one object, and the
 * factor is deleted from whichever node actually held it - leaving it on a
 * discarded parent would be harmless, but leaving it on a node that is still in
 * the graph ships it to `extras` for the next reader to apply twice.
 */
function unitScaleCarrier(object: Object3D): Object3D | null {
	for (let node: Object3D | null = object; node; node = node.parent) {
		if (typeof node.userData['unitScaleFactor'] === 'number') return node
	}

	return null
}

/**
 * An OBJ, with the material library and images that arrived beside it.
 *
 * `OBJLoader.parse` takes text and does no I/O at all: it records the `mtllib`
 * name and nothing else, so resolving the sibling is the caller's job. That is
 * the whole of why this format needed the bridge to widen - an OBJ on its own
 * is untextured grey by construction, not by failure.
 */
const parseOBJ: ThreeSourceBridge = async (bytes, siblings, modelPath) => {
	const [{ OBJLoader }, { MTLLoader }, { LoadingManager }] = await Promise.all([
		import('three/examples/jsm/loaders/OBJLoader.js'),
		import('three/examples/jsm/loaders/MTLLoader.js'),
		import('three')
	])

	const manager = new LoadingManager()
	const releaseTextures = resolveTexturesFromSiblings(
		manager,
		siblings,
		modelPath
	)

	const texturesSettled = watchTextureLoads(manager)
	const loader = new OBJLoader(manager)

	/*
	  Every `.mtl` that came along, concatenated. MTL is line-based, so joining
	  them parses as one library - which is both how an OBJ naming several
	  `mtllib` files works and, more usefully, what makes a renamed material
	  library still apply. Matching on the name the OBJ writes would refuse the
	  common case of a folder whose files were tidied after export. Materials are
	  looked up by name, so anything unused is simply never created.
	*/
	const libraries = [...siblings]
		.filter(([path]) => path.endsWith('.mtl'))
		.map(([, content]) => content)

	const materialLibrary = withoutMissingMaps(
		libraries.map(decodeText).join('\n'),
		siblings,
		modelPath
	)

	if (materialLibrary.trim()) {
		/*
		  An empty base path, so the URL modifier above is handed the filename
		  exactly as the MTL writes it rather than something prefixed.
		*/
		loader.setMaterials(new MTLLoader(manager).parse(materialLibrary, ''))
	}

	/* `finally` for the reason `parseFBX` gives: a refused file is ordinary. */
	try {
		const object = loader.parse(decodeText(bytes))

		/*
		  No axis correction, and the asymmetry with STL is deliberate. An STL
		  says nothing about its axes but every tool that writes one is a CAD
		  package or a slicer, so Z-up is a safe read. OBJ says nothing either
		  and its writers do not agree - Maya and Blender export Y-up, some CAD
		  exports Z-up - so a rotation here would be a coin flip applied to every
		  file. Y-up is both the common case and what glTF wants, so the honest
		  move is to change nothing.
		*/

		await texturesSettled()
		dropFailedTextures(object)

		return object
	} finally {
		releaseTextures()
	}
}

/**
 * What a texture reference resolves to, as a decision separate from acting on
 * it.
 *
 * Split out so the rule can be tested: acting on it needs `URL.createObjectURL`
 * and an `img`, and neither exists where these specs run - so the branch that
 * refuses to fetch would otherwise be the one line here with no way to check
 * it, which is exactly the line that matters.
 */
export type TextureSource =
	| { kind: 'inline'; url: string }
	| { kind: 'bytes'; bytes: Uint8Array; type: string }
	| { kind: 'blocked' }

export function textureSourceFor(
	siblings: ModelSiblings,
	url: string,
	modelPath = ''
): TextureSource {
	/* Already inline - an FBX's own embedded images arrive this way. */
	if (url.startsWith('data:') || url.startsWith('blob:')) {
		return { kind: 'inline', url }
	}

	const bytes = siblingFor(siblings, url, modelPath)
	if (!bytes) return { kind: 'blocked' }

	return { kind: 'bytes', bytes, type: imageTypeFor(url) }
}

/**
 * A URL that a browser resolves without asking anyone for it.
 *
 * An empty data URL, so an `img` pointed at it fails immediately and locally:
 * the load ends, the wait for it finishes, and nothing is requested.
 */
export const BLOCKED_TEXTURE_URL = 'data:,'

/**
 * Takes off every map whose image never arrived.
 *
 * The rule is that a material must not carry a texture that failed to load, and
 * until now only the OBJ path could state it - `withoutMissingMaps` edits the
 * material library before anything parses it. An FBX has no equivalent: its
 * materials are binary records, so a reference to an image the visitor did not
 * bring survives the parse and reaches the exporter, which draws
 * `texture.image` onto a canvas. A zero-sized image there is not a blank
 * texture, it is a canvas of no size, so the whole conversion fails on a file
 * that was merely missing a picture.
 *
 * Run after the texture wait, so "not loaded" means finished and failed rather
 * than still going. A map that is genuinely absent is the honest result: the
 * material keeps its colour, which is what the page promises.
 *
 * Exported for its own test, like the rest of this file's texture rules: the
 * state it acts on is a load that finished without an image, and every texture
 * path in three needs a DOM to make an `img` with. Package-internal; the barrel
 * does not re-export it.
 */
export function dropFailedTextures(object: Object3D): void {
	object.traverse((node) => {
		const materials = (node as Mesh).material
		if (!materials) return

		for (const material of Array.isArray(materials) ? materials : [materials]) {
			for (const [slot, value] of Object.entries(material)) {
				if (!isFailedTexture(value)) continue

				;(material as unknown as Record<string, unknown>)[slot] = null
				material.needsUpdate = true
			}
		}
	})
}

/** A texture whose image finished without becoming anything drawable. */
function isFailedTexture(value: unknown): value is Texture {
	if (!value || typeof value !== 'object') return false
	if (!(value as Texture).isTexture) return false

	const image = (value as Texture).image as { width?: number } | null
	if (!image) return true

	/*
	  `width` is absent on a source this cannot judge - a data texture, a
	  compressed one - and those are left alone rather than guessed at.
	*/
	return typeof image.width === 'number' && image.width === 0
}

/**
 * Points every texture a loader asks for at the bytes that arrived with the
 * model, and points everything else at nothing. Returns the release.
 *
 * WHY THIS IS A RULE RATHER THAN A FALLBACK. A converted file's texture
 * references are only meaningful against the files the visitor handed us. The
 * first version of this let an unresolved name through unchanged, and three
 * then asked the *site* for it - `map_Kd checker.png` became a request for
 * `/checker.png`. Two things were wrong with that, and the second is the one
 * that showed:
 *
 *  - it is a request for a file the visitor believes never left their machine;
 *  - the conversion then waits on a response. Against a dev server that answers
 *    every unknown path with the app shell, the image never loaded and never
 *    errored, and the page sat on "loading" forever with no way out.
 *
 * A request that cannot be made cannot hang. So nothing here reaches the
 * network, by construction rather than by timeout.
 *
 * Exported for its own test, like the rest of this file's texture rules: it is
 * only ever driven by a loader asking for an image, which needs a DOM.
 * Package-internal; the barrel does not re-export it.
 */
export function resolveTexturesFromSiblings(
	manager: LoadingManager,
	siblings: ModelSiblings,
	modelPath = ''
): () => void {
	const objectUrls: string[] = []

	/*
	  A blob per texture that is actually referenced, made inside the callback:
	  a model with no textures starts no loads, so this never runs, which is what
	  lets a format be read where there is no `URL.createObjectURL` to call.
	*/
	manager.setURLModifier((url) => {
		const source = textureSourceFor(siblings, url, modelPath)

		if (source.kind === 'inline') {
			/*
			  Including the ones we did not make. `FBXLoader` creates a blob URL
			  per embedded image and never revokes any of them, so releasing
			  only our own left the common FBX - the one that carries its
			  textures inside itself - holding every image for the life of the
			  tab, on a page whose whole purpose is that you try another file.
			  Whoever called `createObjectURL`, this parse is what the URL is
			  for, so this is where it ends.
			*/
			if (source.url.startsWith('blob:')) objectUrls.push(source.url)
			return source.url
		}

		if (source.kind === 'blocked') return BLOCKED_TEXTURE_URL

		const objectUrl = URL.createObjectURL(
			new Blob([source.bytes as BlobPart], { type: source.type })
		)
		objectUrls.push(objectUrl)
		return objectUrl
	})

	return () => {
		for (const objectUrl of objectUrls) URL.revokeObjectURL(objectUrl)
	}
}

/**
 * The material library, with every map pointing at a file that did not arrive
 * removed.
 *
 * Blocking the request is what stops the hang; this is what makes the result
 * right. A dropped `map_Kd` leaves the material its `Kd` colour, which is what
 * the page promises someone who brings the `.obj` without its images - "correct
 * but grey" - instead of a material carrying a texture that failed to load, and
 * an exporter writing whatever a zero-sized image encodes to.
 *
 * A map line carries options before its filename - `map_Kd -s 1 1 1 wood.png`
 * is legal - so the reference is read the way `MTLLoader` reads it rather than
 * by taking the last field. Those two disagree whenever a filename contains a
 * space, which is ordinary on a desktop: `MTLLoader` rejoins what is left after
 * the options with a space, so it resolves `map_Kd my texture.png`, while the
 * last field alone is `texture.png` and matches nothing. Reading it the other
 * way would delete a map whose image did arrive.
 */
export function withoutMissingMaps(
	materialLibrary: string,
	siblings: ModelSiblings,
	modelPath = ''
): string {
	return materialLibrary
		.split(/\r?\n/)
		.filter((line) => {
			const [keyword, ...rest] = line.trim().split(/\s+/)
			if (!MAP_KEYWORDS.test(keyword ?? '')) return true

			const reference = mapReference(rest)
			return Boolean(reference && siblingFor(siblings, reference, modelPath))
		})
		.join('\n')
}

/**
 * The filename a map line names, with the options `MTLLoader` understands taken
 * off it exactly as `getTextureParams` takes them off: each by name, each with
 * its own argument count, and whatever remains joined back with spaces.
 */
function mapReference(fields: readonly string[]): string {
	const rest = [...fields]

	for (const [option, width] of MAP_OPTIONS) {
		const at = rest.indexOf(option)
		if (at >= 0) rest.splice(at, width)
	}

	return rest.join(' ').trim()
}

/** Each map option `MTLLoader` strips, and the field count it strips with it. */
const MAP_OPTIONS: ReadonlyArray<readonly [string, number]> = [
	['-bm', 2],
	['-mm', 3],
	['-s', 4],
	['-o', 4]
]

/**
 * Every MTL statement whose value is a file name.
 *
 * `norm` is the one that is not spelled `map_*`: `MTLLoader` reads it as the
 * normal map, so leaving it out let a line naming an absent image through, and
 * the blocked texture it built is the failed load this filter exists to
 * prevent. `disp` is the same case and just as load-bearing: `MTLLoader` maps
 * it to `displacementMap`, so a `disp` line naming an absent image builds the
 * same blocked texture. `decal` and `refl` really are absent from its switch and
 * are here anyway - dropping a line it never reads costs nothing, and the day it
 * reads one this is already right.
 */
const MAP_KEYWORDS = /^(map_\w+|bump|norm|disp|decal|refl)$/i

/**
 * The bytes a texture reference names, resolved against the dropped selection.
 *
 * A thin wrapper, deliberately. The rule it states is not about textures or
 * about three.js - it is what a reference inside any model means given where
 * that model sits - so it lives in `dropped-selection.ts`, where the glTF path
 * reads the same one. The name stays because `textureSourceFor` and
 * `withoutMissingMaps` are asking about siblings, and so is their spec.
 *
 * Exported for its own test: it only ever runs from the URL modifier, which
 * only runs when a texture actually loads, which needs a DOM to make an `img`
 * with. Package-internal; the barrel does not re-export it.
 */
export function siblingFor(
	siblings: ModelSiblings,
	reference: string,
	modelPath = ''
): Uint8Array | undefined {
	return referenceIn(siblings, reference, modelPath)
}

/**
 * What a browser needs told to decode a blob it cannot sniff a name from.
 *
 * This is the second place that knows which images we accept - the owner's
 * `siblingExtensions` is the first, and it is the one the file picker and the
 * sibling lookup read. The two agreeing is not automatic: an extension added
 * there and missing here is offered in the picker, found beside the model, and
 * handed to an `img` as `application/octet-stream`, which silently never
 * decodes. That is exactly the outcome the owner's own comment says it avoided
 * by leaving TGA out. `three-source-bridges.spec.ts` asserts the two sets
 * agree, so the gap is a red test rather than a grey model.
 */
export function imageTypeFor(reference: string): string {
	return IMAGE_TYPES[reference.toLowerCase().split('.').pop() ?? ''] ?? FALLBACK
}

const IMAGE_TYPES: Readonly<Record<string, string>> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp'
}

const FALLBACK = 'application/octet-stream'

/**
 * Sibling extensions that are not images, so the check above has something to
 * exempt. They are read as bytes by whatever names them - a material library as
 * text, a glTF buffer as binary - and never become a texture.
 */
export const NON_IMAGE_SIBLING_EXTENSIONS: readonly string[] = ['bin', 'mtl']

function decodeText(bytes: Uint8Array): string {
	return new TextDecoder().decode(bytes)
}

const BRIDGES = new Map<ModelFormatId, ThreeSourceBridge>([
	['stl', parseSTL],
	['fbx', parseFBX],
	['obj', parseOBJ]
])

/** Ids read through a three.js loader, in insertion order. */
export const THREE_SOURCE_FORMAT_IDS: readonly ModelFormatId[] = [
	...BRIDGES.keys()
]

/**
 * Whether this format reaches the pipeline through a three.js loader.
 *
 * The question the drop-zone dispatch asks, so that it can route a bundle
 * without naming a format: glTF's siblings are resolved by glTF-Transform and
 * an OBJ's by the bridge, and `format.id === 'gltf'` written at that branch
 * would be exactly the second statement of the set the owner exists to end.
 */
export function isThreeSourceFormat(id: ModelFormatId): boolean {
	return BRIDGES.has(id)
}

/** How to parse this format, or `null` when glTF-Transform reads it directly. */
export function threeSourceBridge(id: ModelFormatId): ThreeSourceBridge | null {
	return BRIDGES.get(id) ?? null
}

/**
 * The exact bytes, as their own buffer.
 *
 * `loadFromBuffer` is public, so the view it is handed may sit inside a larger
 * buffer - passing `.buffer` straight through would parse whatever else is in
 * there and produce a model nobody sent.
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(
		bytes.byteOffset,
		bytes.byteOffset + bytes.byteLength
	) as ArrayBuffer
}
