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
import { readFbxFacts } from './fbx-file-facts'

import type { ModelFormatId } from '../model-formats'
import type { FbxFacts } from './fbx-file-facts'
import type {
	DataTexture,
	DataTextureLoader,
	DataTextureLoaderTexData,
	DirectionalLight,
	Group,
	LoadingManager,
	Material,
	Mesh,
	MeshLambertMaterial,
	MeshPhongMaterial,
	MeshStandardMaterial,
	Object3D,
	PerspectiveCamera,
	SpotLight,
	Texture,
	Vector3
} from 'three'
import type * as Three from 'three'

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
 * Animation comes across because the clips stay on the object this returns:
 * `FBXLoader` leaves them on `object.animations`, and `exportThreeJSGLB` writes
 * whatever clips the object it is handed carries. The root this bridge puts
 * above the loader's object therefore carries them too; `rootFor` says why
 * that root exists at all.
 */
const parseFBX: ThreeSourceBridge = async (bytes, siblings, modelPath) => {
	const [{ FBXLoader }, three] = await Promise.all([
		import('three/examples/jsm/loaders/FBXLoader.js'),
		import('three')
	])

	/*
	  An FBX almost always carries its images inside itself, and those arrive as
	  blob URLs the loader made - passed through untouched.

	  One that names an image instead is resolved against the files that came
	  with it: the owner gives `fbx` sibling extensions without making it a
	  bundle, so a folder dropped with it arrives here and a lone file arrives
	  with nothing. `FBXLoader` reduces a Windows path to its file name first,
	  and the selection lookup matches that name.
	*/
	const { manager, releaseTextures, texturesSettled } =
		await bridgeLoadingManager(three, siblings, modelPath)

	/*
	  `finally`, because a file that fails to parse is an ordinary outcome here -
	  it is the refusal the page reports - and the blob URLs made for its
	  textures would otherwise be held for as long as the tab is open, on a page
	  whose whole purpose is that you try another file.
	*/
	try {
		const root = rootFor(
			new FBXLoader(manager).parse(toArrayBuffer(bytes), ''),
			readFbxFacts(bytes),
			three
		)

		/*
		  `TextureLoader` fills a texture in asynchronously, so `parse` returns
		  with every image still blank. Exporting now writes a GLB whose textures
		  are 1x1 placeholders - a conversion that succeeds, downloads, and is
		  wrong, which is worse than one that fails. A load that errors still
		  ends, so a file naming a texture it does not carry settles rather than
		  hanging.
		*/
		await texturesSettled()
		prepareMaterialsForExport(root, three, fbxShininess(three))

		return root
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
 * The loading manager a bridge parses with, and the two things it must do
 * with it afterwards: wait for its textures, and release what they held.
 *
 * Its own manager, never the default one. Texture loads are tracked on the
 * manager, and `DefaultLoadingManager` is global: two conversions in one tab
 * would settle against each other's counts. Every texture request is resolved
 * against the files that came with the model and nothing else (see
 * `resolveTexturesFromSiblings`), TGA and TIFF reach their decoders, and the
 * wait is installed before the caller parses, which is the order
 * `watchTextureLoads` needs.
 *
 * Exported for its own test, since a texture load needs a DOM and this is how
 * the specs see what a bridge's loaders will be handed. Package-internal; the
 * barrel does not re-export it.
 */
export async function bridgeLoadingManager(
	three: typeof Three,
	siblings: ModelSiblings,
	modelPath: string
): Promise<{
	manager: LoadingManager
	releaseTextures: () => void
	texturesSettled: () => Promise<void>
}> {
	const manager = new three.LoadingManager()
	await addImageDecoders(manager)

	return {
		manager,
		releaseTextures: resolveTexturesFromSiblings(manager, siblings, modelPath),
		texturesSettled: watchTextureLoads(manager)
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
 * The node this bridge puts above the loader's object, carrying every
 * correction the bridge makes to the file as a whole: its unit, its up axis,
 * where its constraint targets sit, and which way its lights and cameras
 * face.
 *
 * WHY A NEW NODE AND NOT THE LOADER'S OBJECT. When a file has a single
 * top-level group `FBXLoader` returns that group, and that group can be
 * animated. A clip writes its values in the file's own space, so a correction
 * made on the group itself is undone by playback: a scale is overwritten
 * outright, a move travels in centimetres under a metre scale, and a rotation
 * replaces the up-axis turn and lays a Z-up model on its back. A node this
 * bridge made is one no clip in the file names. The exception is a track for an
 * FBX model with no name at all, which three binds to whatever root it is
 * exported from, so such a file is wrong whichever node carries the
 * correction.
 *
 * The root carries the clips as well, since it is the object
 * `exportThreeJSGLB` reads them from.
 */
function rootFor(
	object: Object3D,
	facts: FbxFacts,
	three: typeof Three
): Group {
	const root = new three.Group()
	root.animations = object.animations

	/* Read before `add`, which reparents the node the factor may sit on. */
	root.scale.setScalar(takeUnitScale(object))
	if (facts.upAxis === 2) liftUpAxisCorrection(object, root, three)
	root.add(object)

	const byId = modelsById(root)
	releaseLookAtTargets(root, facts, byId)
	root.updateMatrixWorld(true)
	aimLights(root, facts, byId, three)
	aimCameras(root, facts, byId, three)

	return root
}

/**
 * The scale that turns the file's own unit into the metre glTF specifies, and
 * 1 when the file states none.
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
function takeUnitScale(object: Object3D): number {
	const carrier = unitScaleCarrier(object)
	if (!carrier) return 1

	/* Bracketed because `userData` is an index signature, not a shape. */
	const centimetresPerUnit = carrier.userData['unitScaleFactor']

	if (typeof centimetresPerUnit !== 'number') return 1
	if (!Number.isFinite(centimetresPerUnit) || centimetresPerUnit <= 0) return 1

	/*
	  And then stop saying it. `userData` is written straight into the exported
	  file as `extras`, so leaving the factor there ships a GLB whose own
	  metadata declares a unit its coordinates no longer use - an invitation for
	  the next reader to apply it a second time.
	*/
	delete carrier.userData['unitScaleFactor']

	return centimetresPerUnit / 100
}

/**
 * Moves `FBXLoader`'s Z-up turn off the object it returned and onto `root`,
 * and gives that object back the rotation the turn replaced. Called only for a
 * file that declares Z-up.
 *
 * `FBXLoader` acts on Z-up by *setting* the returned object's rotation to -90
 * degrees about X - not composing with it. Two things follow when that object
 * is the file's own top-level group: its own rotation is lost even at rest, and
 * a clip that rotates it overwrites the turn on playback. Both are fixed by the
 * same move.
 *
 * The rotation that was replaced is still on the object, in its `matrix`:
 * `FBXLoader` composes that matrix from the file's transform and then sets the
 * rotation without recomposing it. That is an ordering inside the loader
 * rather than a promise. Were a later three to recompose first, the matrix
 * would hold the turn, the object would be turned twice, and the Z-up specs
 * would go red rather than this going wrong quietly.
 *
 * Never a rotation of our own on top, and that asymmetry with STL is the point:
 * STL states no axis, so its bridge has to choose one, while an FBX states it
 * and the loader has already turned it once.
 */
function liftUpAxisCorrection(
	object: Object3D,
	root: Object3D,
	three: typeof Three
): void {
	const ownRotation = new three.Quaternion()
	object.matrix.decompose(new three.Vector3(), ownRotation, new three.Vector3())

	root.quaternion.copy(object.quaternion)
	object.quaternion.copy(ownRotation)
}

/**
 * Every object `FBXLoader` made from a file model, by that model's ID. The
 * loader writes the ID onto each one, which is what lets a connection read from
 * the file name the object it is about.
 */
function modelsById(root: Object3D): Map<number, Object3D> {
	const byId = new Map<number, Object3D>()
	root.traverse((node) => {
		const id = (node as Object3D & { ID?: unknown }).ID
		if (typeof id === 'number') byId.set(id, node)
	})
	return byId
}

/**
 * Puts every constraint target back under the parent the file gives it.
 *
 * `FBXLoader` parents a model by each of its connections, and a target's
 * `LookAtProperty` connection is one of them, so a light's or camera's target
 * ends up as that light's or camera's child - placed by its own transform
 * relative to the wrong node, and written to the file there. Its real parent is
 * its plain `OO` connection. A target at the top level of the file goes on
 * `root`, whose space is the file's top level once the unit and up axis sit on
 * it.
 */
function releaseLookAtTargets(
	root: Object3D,
	facts: FbxFacts,
	byId: ReadonlyMap<number, Object3D>
): void {
	for (const lookAt of facts.connections) {
		if (lookAt.property !== LOOK_AT) continue

		const target = byId.get(lookAt.child)
		if (!target || target.parent !== byId.get(lookAt.parent)) continue

		const home = facts.connections.find(
			(connection) =>
				connection.child === lookAt.child && connection.property === undefined
		)
		const parent = !home || home.parent === 0 ? root : byId.get(home.parent)
		parent?.add(target)
	}
}

/**
 * Where the file aims a model, when it gives that model a target: the target's
 * position in the world, or null for a model that faces along its own axes.
 */
function aimOf(
	model: Object3D,
	facts: FbxFacts,
	byId: ReadonlyMap<number, Object3D>,
	three: typeof Three
): Vector3 | null {
	const id = (model as Object3D & { ID?: unknown }).ID
	const lookAt = facts.connections.find(
		(connection) => connection.property === LOOK_AT && connection.parent === id
	)
	const target = lookAt ? byId.get(lookAt.child) : undefined
	return target ? target.getWorldPosition(new three.Vector3()) : null
}

const LOOK_AT = 'LookAtProperty'

/**
 * Puts a group in `held`'s place and `held` inside it, at the group's origin,
 * ready to be turned on its own.
 *
 * Why the group: a clip that moves a light or camera names it, and turning that
 * same node to face the glTF way would fight the clip on every frame. The
 * group takes the name, transform, user data and children, so the clip still
 * finds what it moved; `held` keeps its name too, since `GLTFExporter` names a
 * light or camera definition after the object that carries it.
 */
function standIn(held: Object3D, three: typeof Three): Group {
	const node = new three.Group()
	node.name = held.name
	node.position.copy(held.position)
	node.quaternion.copy(held.quaternion)
	node.scale.copy(held.scale)
	node.userData = held.userData
	for (const child of [...held.children]) node.add(child)
	held.parent?.add(node)
	held.removeFromParent()

	held.userData = {}
	held.position.set(0, 0, 0)
	held.quaternion.identity()
	held.scale.set(1, 1, 1)
	node.add(held)

	return node
}

/**
 * Points every directional and spot light the way the FBX meant it.
 *
 * The two formats disagree about which way a light faces. An FBX light shines
 * down its node's -Y axis, or at the node's target where it has one. glTF's
 * `KHR_lights_punctual` shines down -Z, with no target. `FBXLoader` follows
 * neither: it aims a light at the origin unless the file gives it a target, and
 * `GLTFExporter` then writes the node's -Z regardless. A converted sun came out
 * facing sideways.
 *
 * Each light is turned inside a `standIn`. Its target is then a hidden child
 * one unit down -Z: where three aims it, where `GLTFExporter` expects it, and,
 * hidden, not a node of its own in the file.
 *
 * A point light has no direction and is left alone. Brightness is not
 * converted: FBX states intensity as a bare percentage and glTF requires
 * candela or lux, and nothing in the file relates the two.
 */
function aimLights(
	root: Object3D,
	facts: FbxFacts,
	byId: ReadonlyMap<number, Object3D>,
	three: typeof Three
): void {
	const lights: Array<DirectionalLight | SpotLight> = []
	root.traverse((node) => {
		if ((node as DirectionalLight).isDirectionalLight) {
			lights.push(node as DirectionalLight)
		} else if ((node as SpotLight).isSpotLight) {
			lights.push(node as SpotLight)
		}
	})

	for (const light of lights) {
		/* The loader's own target object: replaced below, never written. */
		light.target.removeFromParent()

		/*
		  Less the unit `FBXLoader` adds. Both light classes start at (0, 1, 0)
		  in three, and the loader premultiplies the file's transform onto that
		  instead of replacing it, so every directional and spot light lands one
		  file unit along its own up. A spot light then lights from the wrong
		  place, and a targeted one aims from it.
		*/
		const loaderOffset = new three.Vector3(0, 1, 0)
			.multiply(light.scale)
			.applyQuaternion(light.quaternion)
		const node = standIn(light, three)
		node.position.sub(loaderOffset)

		/*
		  Read after the offset comes off: a target the file hangs under the
		  light itself moves with it.
		*/
		node.updateMatrixWorld(true)
		const aimAt = aimOf(light, facts, byId, three)

		if (aimAt) {
			light.lookAt(aimAt)
		} else {
			/* Turns -Z onto the node's -Y, where an FBX light shines. */
			light.rotation.x = -Math.PI / 2
		}

		light.target = new three.Object3D()
		light.target.position.set(0, 0, -1)
		light.target.visible = false
		light.add(light.target)
	}
}

/**
 * Points every perspective camera the way the FBX meant it.
 *
 * An FBX camera looks down its node's +X axis, or at its target; a glTF camera
 * looks down -Z. `FBXLoader` turns neither kind, so a free camera came out
 * looking 90 degrees to the side. A targeted one it does turn, but before it
 * applies the file's own transform, so that transform then turns it again.
 * Each camera is turned inside a `standIn`, aimed at its target from the
 * file where it has one.
 *
 * The aim is the one at rest, baked as a fixed turn inside the stand-in. glTF
 * has no constraint, so when a clip moves the camera, the light or the target,
 * the turn stays the rest one and stops following the target; the converter
 * note says so.
 *
 * Orthographic cameras are not here because `FBXLoader` makes none: it warns
 * and returns an empty object, which the exporter writes as a plain node.
 */
function aimCameras(
	root: Object3D,
	facts: FbxFacts,
	byId: ReadonlyMap<number, Object3D>,
	three: typeof Three
): void {
	const cameras: PerspectiveCamera[] = []
	root.traverse((node) => {
		if ((node as PerspectiveCamera).isPerspectiveCamera) {
			cameras.push(node as PerspectiveCamera)
		}
	})

	for (const camera of cameras) {
		const node = standIn(camera, three)
		node.updateMatrixWorld(true)
		const aimAt = aimOf(camera, facts, byId, three)

		if (aimAt) {
			camera.lookAt(aimAt)
		} else {
			/* Turns -Z onto the node's +X, where an FBX camera looks. */
			camera.rotation.y = -Math.PI / 2
		}
	}
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
	const [{ OBJLoader }, { MTLLoader }, three] = await Promise.all([
		import('three/examples/jsm/loaders/OBJLoader.js'),
		import('three/examples/jsm/loaders/MTLLoader.js'),
		import('three')
	])

	const { manager, releaseTextures, texturesSettled } =
		await bridgeLoadingManager(three, siblings, modelPath)
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

	/*
	  The materials whose `Ns` the library states. `MTLLoader` copies `Ns` to
	  `shininess` only when it is there, so a material without one carries
	  three's default, and Blender reads a missing `Ns` as fully rough. So does
	  a material the OBJ names that no library defines, which `OBJLoader`
	  makes as a bare Phong under that name.
	*/
	const statedNs = new Set<string>()

	if (materialLibrary.trim()) {
		/*
		  An empty base path, so the URL modifier above is handed the filename
		  exactly as the MTL writes it rather than something prefixed.
		*/
		const materials = new MTLLoader(manager).parse(materialLibrary, '')
		for (const [name, info] of Object.entries(materials.materialsInfo)) {
			if (info.ns !== undefined) statedNs.add(name)
		}
		loader.setMaterials(materials)
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
		prepareMaterialsForExport(object, three, {
			scale: 1000,
			states: (material) => statedNs.has(material.name)
		})

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
				/*
				  An alpha map is the only reason a loader marks an otherwise
				  opaque material transparent, so the mark goes with the map.
				  Left behind, it exports as BLEND with nothing to blend, and the
				  reader turns depth writing off for a solid surface.
				*/
				if (slot === 'alphaMap') material.transparent = material.opacity < 1
				material.needsUpdate = true
			}
		}
	})
}

/**
 * Replaces every Phong and Lambert material with the `MeshStandardMaterial`
 * glTF can describe.
 *
 * `FBXLoader` only makes those two, `MTLLoader` makes Phong, and
 * `GLTFExporter` writes any material that is not Standard or Basic as
 * metalness 0, roughness 1: its shininess is dropped, so every FBX and OBJ
 * converted as chalk. The exporter cannot know what a format meant by
 * shininess, so the conversion is made here, where the format becomes glTF.
 *
 * Roughness follows Blender's importers, `1 - sqrt(shininess / scale)`, where
 * `scale` is the top of the format's exponent range: 100 for FBX (`Shininess`,
 * `import_fbx.py`) and 1000 for MTL (`Ns`, `obj_import_mtl.cc`). Blender's
 * exporters write the inverse, so a Blender round trip lands where it started,
 * and no other formula is used by a tool that writes either format. A Lambert
 * has no specular lobe, so it is fully rough.
 *
 * Metalness stays 0, although Blender reads `ReflectionFactor` as metallic.
 * `FBXLoader` sets `reflectivity` only when the file carries that field, and a
 * Phong material defaults it to 1, so a file without it is indistinguishable
 * from a mirror and would convert as chrome. A missing `Shininess` reads as
 * three's default 30 rather than Blender's 20 for the same reason.
 *
 * The bump map is left behind on purpose. `GLTFExporter` writes one only for a
 * standard material, as `EXT_materials_bump`, which the document read does
 * not register, so the extension is discarded with a warning and the bump
 * never reaches the file anyway. A Phong bump was never exported before
 * either, so nothing is lost that the conversion used to keep.
 *
 * One replacement per material, not per mesh: a material shared across
 * a thousand wheel bolts stays one material in the exported file.
 *
 * Exported for its own test, like the texture rules above. Package-internal;
 * the barrel does not re-export it.
 */
export function standardMaterialsFor(
	object: Object3D,
	three: typeof Three,
	shininess: ShininessReading
): void {
	const replaced = new Map<Material, MeshStandardMaterial>()

	const standardFor = (material: Material): Material => {
		const legacy = material as MeshPhongMaterial | MeshLambertMaterial
		if (
			!(legacy as MeshPhongMaterial).isMeshPhongMaterial &&
			!(legacy as MeshLambertMaterial).isMeshLambertMaterial
		) {
			return material
		}

		const known = replaced.get(material)
		if (known) return known

		/*
		  A material that states no shininess carries only three's default, so
		  it stays fully rough, as it always exported. Which materials state one
		  is the format's question; see `ShininessReading`.
		*/
		const exponent =
			(legacy as MeshPhongMaterial).isMeshPhongMaterial &&
			shininess.states(legacy as MeshPhongMaterial)
				? (legacy as MeshPhongMaterial).shininess
				: 0

		const standard = new three.MeshStandardMaterial({
			name: legacy.name,
			color: legacy.color,
			map: legacy.map,
			normalMap: legacy.normalMap,
			normalMapType: legacy.normalMapType,
			normalScale: legacy.normalScale,
			emissive: legacy.emissive,
			emissiveMap: legacy.emissiveMap,
			emissiveIntensity: legacy.emissiveIntensity,
			aoMap: legacy.aoMap,
			aoMapIntensity: legacy.aoMapIntensity,
			alphaMap: legacy.alphaMap,
			displacementMap: legacy.displacementMap,
			displacementScale: legacy.displacementScale,
			displacementBias: legacy.displacementBias,
			lightMap: legacy.lightMap,
			lightMapIntensity: legacy.lightMapIntensity,
			opacity: legacy.opacity,
			transparent: legacy.transparent,
			alphaTest: legacy.alphaTest,
			side: legacy.side,
			vertexColors: legacy.vertexColors,
			flatShading: legacy.flatShading,
			metalness: 0,
			roughness: roughnessFromShininess(exponent, shininess.scale)
		})
		standard.userData = legacy.userData

		legacy.dispose()
		replaced.set(material, standard)
		return standard
	}

	object.traverse((node) => {
		const mesh = node as Mesh
		if (!mesh.material) return

		mesh.material = Array.isArray(mesh.material)
			? mesh.material.map(standardFor)
			: standardFor(mesh.material)
	})
}

/** Blender's importers' reading of a Phong exponent on a `0..scale` range. */
function roughnessFromShininess(shininess: number, scale: number): number {
	const clamped = Math.min(scale, Math.max(0, shininess))
	return 1 - Math.sqrt(clamped / scale)
}

/**
 * How a format states a Phong exponent: the top of its range, and whether a
 * given material stated one at all rather than carrying three's default 30.
 */
export interface ShininessReading {
	scale: number
	states: (material: MeshPhongMaterial) => boolean
}

/**
 * FBX's reading. `FBXLoader` makes two placeholders that state nothing: one
 * named `DEFAULT_MATERIAL_NAME` for a mesh with no material, and an unnamed
 * one for a face group whose index has no material. Every material read from
 * the file carries its own name, so the name is what tells them apart; a file
 * material with an empty name keeps the old matte export.
 */
export function fbxShininess(three: typeof Three): ShininessReading {
	return {
		scale: 100,
		states: (material) =>
			material.name !== '' &&
			material.name !== three.Loader.DEFAULT_MATERIAL_NAME
	}
}

/**
 * What a bridge's materials need before `GLTFExporter` sees them, in the order
 * each step depends on the one before: a failed texture must be gone before its
 * pixels are read, an alpha map must be folded into the base color while both
 * images still read top-down, every data texture must then face the way the
 * exporter writes it, and only the finished maps are carried onto the standard
 * material.
 *
 * Exported for its own test: each step has one, and this is where their order
 * is checked. Package-internal; the barrel does not re-export it.
 */
export function prepareMaterialsForExport(
	object: Object3D,
	three: typeof Three,
	shininess: ShininessReading
): void {
	dropFailedTextures(object)
	resolveAlphaMaps(object, three)
	bottomUpDataTextures(object)
	standardMaterialsFor(object, three, shininess)
}

/**
 * Lets a bridge's loaders decode TGA and TIFF, the two image formats FBX and
 * OBJ sets carry most often that a browser's `img` cannot.
 *
 * `FBXLoader` and `MTLLoader` both ask the manager for a handler by extension
 * before falling back to `TextureLoader`, so registering one is all either
 * needs: an embedded TGA in an FBX, a `wood.tga` beside it, and an MTL naming
 * one all reach the same decoder. Without it each became a texture whose image
 * never decoded, which `dropFailedTextures` then took off.
 *
 * Dynamic for the reason the loaders themselves are.
 */
async function addImageDecoders(manager: LoadingManager): Promise<void> {
	const [{ TGALoader }, { TIFFLoader }] = await Promise.all([
		import('three/examples/jsm/loaders/TGALoader.js'),
		import('three/examples/jsm/loaders/TIFFLoader.js')
	])

	manager.addHandler(/\.tga$/i, keepingWrap(new TGALoader(manager)))
	manager.addHandler(/\.tiff?$/i, keepingWrap(new TIFFLoader(manager)))
}

/**
 * A decoder that leaves a texture's wrap as its caller set it.
 *
 * `DataTextureLoader` writes clamp-to-edge over the wrap once the file
 * decodes, unless the file names one, and neither TGA nor TIFF does. Both
 * loaders set the wrap the model asks for as soon as `load` returns, before
 * the image arrives, so every tiling TGA or TIFF lost its repeat. The decoded
 * data therefore takes the texture's own wrap as its default.
 *
 * `_applyTexData` is the one step that writes it, and it is not in three's
 * types, so it is named here; the spec loading a TGA is what notices a rename.
 */
function keepingWrap<T extends DataTextureLoader>(decoder: T): T {
	const target = decoder as T & {
		_applyTexData(texture: DataTexture, texData: DataTextureLoaderTexData): void
	}
	const apply = target._applyTexData.bind(target)

	target._applyTexData = (texture, texData) =>
		apply(texture, { wrapS: texture.wrapS, wrapT: texture.wrapT, ...texData })

	return decoder
}

/** An image's pixels as RGBA bytes, top row first. */
interface Rgba {
	data: ArrayLike<number>
	width: number
	height: number
}

/**
 * Folds every alpha map into the base color's alpha channel, and decides from
 * the pixels whether the material is opaque, cut out or blended.
 *
 * An FBX links a texture to `TransparencyFactor` or `TransparentColor` to say
 * "this image's alpha is the surface's alpha", and Blender's importer reads it
 * exactly so. `FBXLoader` instead makes it an `alphaMap` and marks the
 * material transparent, and an MTL's `map_d` does the same through
 * `MTLLoader`. Neither survives: three samples an alpha map's green channel,
 * glTF has no alpha map at all, and `GLTFExporter` drops it while still writing
 * `BLEND`. The reader then turns depth writing off for that material, and a
 * solid body sorts against itself and looks see-through. Blender writes the
 * link for any Alpha socket connection, so a fully opaque image is the common
 * case rather than an edge one.
 *
 * So the alpha the file meant is moved to where glTF reads it: the base color
 * texture. When the alpha map is the base color's own image, which is how
 * Blender writes it, that texture already carries it. Otherwise the two are
 * combined into a new image at the base color's size. The pixels then decide
 * the mode: all opaque becomes opaque, only clear and opaque becomes a cutout,
 * anything between stays blended.
 *
 * Which channel is the alpha: the alpha channel, when the image has one that
 * says anything or is the base color's own picture, as Blender reads a link.
 * Otherwise the image is a grey mask, which is how a 3ds Max opacity map and
 * most MTL `map_d` images are made, and its brightness is the alpha. That is
 * the green channel three itself samples an alpha map by; an image with no
 * alpha channel decodes with alpha 255 everywhere, so reading that channel
 * would call every grey mask opaque and throw the cutout away.
 *
 * A texture whose pixels cannot be read is left as the loader left it, which
 * is what every file got before.
 *
 * Exported for its own test, like the texture rules above. Package-internal;
 * the barrel does not re-export it.
 */
export function resolveAlphaMaps(object: Object3D, three: typeof Three): void {
	const resolved = new Set<Material>()

	object.traverse((node) => {
		const materials = (node as Mesh).material
		if (!materials) return

		for (const material of Array.isArray(materials) ? materials : [materials]) {
			const target = material as MeshPhongMaterial
			if (!target.alphaMap || resolved.has(material)) continue
			resolved.add(material)

			const alpha = rgbaOf(target.alphaMap)
			if (!alpha) continue

			let map = target.map
			const ownImage = sameImage(map, target.alphaMap)
			const channel = ownImage || carriesAlpha(alpha) ? ALPHA : GREEN
			const use = alphaUseOf(alpha, channel)

			if (use !== 'opaque' && !ownImage) {
				const color = map ? rgbaOf(map) : null
				if (map && !color) continue
				map = withAlpha(color, alpha, channel, map, three)
			}

			target.map = map
			target.alphaMap = null
			if (use === 'opaque') {
				target.transparent = target.opacity < 1
			} else if (use === 'mask' && target.opacity >= 1) {
				target.transparent = false
				target.alphaTest = 0.5
			} else {
				target.transparent = true
			}
			target.needsUpdate = true
		}
	})
}

/*
  How far from 0 and 255 a pixel may sit and still count as clear or opaque.
  Images carry a little noise from compression and resampling, and a cutout
  edge read as a blend is the depth-sorting fault this exists to remove.
*/
const CLEAR_ALPHA = 5
const OPAQUE_ALPHA = 250

/** Offsets into an RGBA pixel. */
const GREEN = 1
const ALPHA = 3

/** Whether an image's alpha channel is anything but opaque somewhere. */
function carriesAlpha(rgba: Rgba): boolean {
	for (let index = ALPHA; index < rgba.data.length; index += 4) {
		if (rgba.data[index] < OPAQUE_ALPHA) return true
	}
	return false
}

/** What one channel of an image, read as alpha, asks of the surface. */
export function alphaUseOf(
	rgba: Rgba,
	channel: number
): 'opaque' | 'mask' | 'blend' {
	let anyClear = false

	for (let index = channel; index < rgba.data.length; index += 4) {
		const alpha = rgba.data[index]
		if (alpha >= OPAQUE_ALPHA) continue
		if (alpha > CLEAR_ALPHA) return 'blend'
		anyClear = true
	}

	return anyClear ? 'mask' : 'opaque'
}

/** Whether two textures draw the same picture. */
function sameImage(a: Texture | null, b: Texture): boolean {
	if (!a) return false

	const left = a.image as { src?: string; data?: unknown } | null
	const right = b.image as { src?: string; data?: unknown } | null
	if (!left || !right) return false

	/*
	  `FBXLoader` makes one texture per material link, so a diffuse and an alpha
	  link to one image are two textures, each loading the same URL into its own
	  `img`. A decoder reads that URL into its own array each time, so a decoded
	  picture is compared by its pixels.
	*/
	if (left === right) return true
	if (left.src) return left.src === right.src
	return isTypedArray(left.data) && isTypedArray(right.data)
		? samePixels(left.data, right.data)
		: false
}

function isTypedArray(value: unknown): value is ArrayLike<number> {
	return ArrayBuffer.isView(value)
}

function samePixels(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
	if (a.length !== b.length) return false
	for (let index = 0; index < a.length; index++) {
		if (a[index] !== b[index]) return false
	}
	return true
}

/**
 * A texture's pixels, top row first, or null where they cannot be read.
 *
 * A data texture's bytes are read directly, turned over when they are stored
 * bottom row first. Anything else is drawn onto a canvas, which needs a DOM or
 * `OffscreenCanvas`; where neither exists there is nothing to read.
 */
export function rgbaOf(texture: Texture): Rgba | null {
	const image = texture.image as {
		data?: ArrayLike<number> | null
		width?: number
		height?: number
	} | null
	if (!image?.width || !image.height) return null

	const { width, height } = image

	if (image.data) {
		if (image.data.length !== width * height * 4) return null
		return texture.flipY
			? { data: image.data, width, height }
			: { data: flipRows(image.data, width, height), width, height }
	}

	const context = canvasContext(width, height)
	if (!context) return null

	context.drawImage(image as CanvasImageSource, 0, 0)
	return { data: context.getImageData(0, 0, width, height).data, width, height }
}

function canvasContext(
	width: number,
	height: number
): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null {
	if (typeof OffscreenCanvas !== 'undefined') {
		return new OffscreenCanvas(width, height).getContext('2d')
	}
	if (typeof document === 'undefined') return null

	const canvas = document.createElement('canvas')
	canvas.width = width
	canvas.height = height
	return canvas.getContext('2d')
}

/**
 * A new texture: `color`'s RGB, or white without one, under `alpha`'s alpha,
 * at `color`'s size. The alpha is sampled to fit, since nothing requires the two
 * images to match.
 *
 * Written top row first with `flipY`, like a decoded image, so it reads the
 * same way as everything else until `bottomUpDataTextures` turns it for export.
 */
function withAlpha(
	color: Rgba | null,
	alpha: Rgba,
	channel: number,
	source: Texture | null,
	three: typeof Three
): Texture {
	const width = color?.width ?? alpha.width
	const height = color?.height ?? alpha.height
	const data = new Uint8Array(width * height * 4)

	for (let y = 0; y < height; y++) {
		const alphaRow = Math.floor((y * alpha.height) / height) * alpha.width

		for (let x = 0; x < width; x++) {
			const at = (y * width + x) * 4
			const alphaAt = (alphaRow + Math.floor((x * alpha.width) / width)) * 4

			data[at] = color ? color.data[at] : 255
			data[at + 1] = color ? color.data[at + 1] : 255
			data[at + 2] = color ? color.data[at + 2] : 255
			data[at + 3] = alpha.data[alphaAt + channel]
		}
	}

	const texture = new three.DataTexture(data, width, height, three.RGBAFormat)
	texture.flipY = true
	texture.colorSpace = source?.colorSpace ?? three.SRGBColorSpace
	/*
	  Sampled like the picture it replaces. A data texture starts nearest and
	  without mipmaps, and the exporter writes those filters into the file, so
	  leaving them would pixelate every combined base color.
	*/
	texture.magFilter = source?.magFilter ?? three.LinearFilter
	texture.minFilter = source?.minFilter ?? three.LinearMipmapLinearFilter
	texture.generateMipmaps = source?.generateMipmaps ?? true
	texture.anisotropy = source?.anisotropy ?? 1
	if (source) {
		texture.name = source.name
		texture.wrapS = source.wrapS
		texture.wrapT = source.wrapT
		texture.repeat.copy(source.repeat)
		texture.offset.copy(source.offset)
		texture.center.copy(source.center)
		texture.rotation = source.rotation
		texture.channel = source.channel
	}
	texture.needsUpdate = true
	return texture
}

/**
 * Stores every data texture bottom row first, the way `GLTFExporter` needs it.
 *
 * The exporter turns an ordinary image over when its texture has `flipY`, by
 * drawing it through a flipped canvas. A data texture it writes with
 * `putImageData`, which the canvas transform does not touch, so one decoded top
 * row first with `flipY` (a TGA, a TIFF, an alpha `withAlpha` combined)
 * would land in the file upside down. Turning the bytes and clearing `flipY`
 * draws the same picture in three and writes it the way the exporter writes
 * every other image.
 *
 * Exported for its own test. Package-internal; the barrel does not re-export
 * it.
 */
export function bottomUpDataTextures(object: Object3D): void {
	const turned = new Set<Texture>()

	object.traverse((node) => {
		const materials = (node as Mesh).material
		if (!materials) return

		for (const material of Array.isArray(materials) ? materials : [materials]) {
			for (const value of Object.values(material)) {
				const texture = value as DataTexture
				if (!texture?.isDataTexture || !texture.flipY || turned.has(texture)) {
					continue
				}
				turned.add(texture)

				const { data, width, height } = texture.image
				if (!data) continue
				texture.image.data = flipRows(data, width, height) as typeof data
				texture.flipY = false
				texture.needsUpdate = true
			}
		}
	})
}

/** RGBA rows in the opposite order, as a new array of the same kind. */
function flipRows<T extends ArrayLike<number>>(
	data: T,
	width: number,
	height: number
): T {
	const rows = data as unknown as Uint8Array
	const flipped = new (rows.constructor as Uint8ArrayConstructor)(rows.length)
	const stride = width * 4

	for (let y = 0; y < height; y++) {
		flipped.set(
			rows.subarray(y * stride, (y + 1) * stride),
			(height - 1 - y) * stride
		)
	}

	return flipped as unknown as T
}

/** A texture whose image finished without becoming anything drawable. */
function isFailedTexture(value: unknown): value is Texture {
	if (!value || typeof value !== 'object') return false
	if (!(value as Texture).isTexture) return false

	const image = (value as Texture).image as {
		width?: number
		data?: unknown
	} | null
	if (!image) return true

	/*
	  A data texture whose file never decoded: `DataTextureLoader` hands back
	  three's placeholder, whose image is `{ data: null }`, and the exporter
	  reads that `data` as pixels.
	*/
	if (image.data === null) return true

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
	const urlOf = new Map<Uint8Array, string>()

	/*
	  A blob per file that is actually referenced, made inside the callback:
	  a model with no textures starts no loads, so this never runs, which is what
	  lets a format be read where there is no `URL.createObjectURL` to call.

	  One per file, not per request. `FBXLoader` makes a texture per material
	  link, so a diffuse and an alpha link to one sibling ask for it twice, and
	  the URL is how `resolveAlphaMaps` tells they are the same picture.
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

		const known = urlOf.get(source.bytes)
		if (known) return known

		const objectUrl = URL.createObjectURL(
			new Blob([source.bytes as BlobPart], { type: source.type })
		)
		objectUrls.push(objectUrl)
		urlOf.set(source.bytes, objectUrl)
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
 * decodes. TGA and TIFF are the exception that proves it: they are offered
 * only because `addImageDecoders` decodes them without an `img` at all.
 * `three-source-bridges.spec.ts` asserts the two sets
 * agree, so the gap is a red test rather than a grey model.
 */
export function imageTypeFor(reference: string): string {
	return IMAGE_TYPES[reference.toLowerCase().split('.').pop() ?? ''] ?? FALLBACK
}

const IMAGE_TYPES: Readonly<Record<string, string>> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	/*
	  Never handed to an `img`: `addImageDecoders` routes both to their own
	  decoders, which read the bytes. The type is only what the blob says it is.
	*/
	tga: 'image/x-tga',
	tif: 'image/tiff',
	tiff: 'image/tiff'
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
