/**
 * The format pairs that have a page, and the capability sets that bound them.
 *
 * Every pair is one indexable URL, because the queries people type are literal
 * pairs - "fbx to glb", "stl to glb" - and a single converter page answers none
 * of them. The pair is also the measurement: which page someone lands on says
 * which format they arrived with, and that is the segment signal the roadmap is
 * waiting on. Route traffic answers it without consent, which is why the page
 * exists per pair rather than one page with a dropdown.
 *
 * This module is imported by `react-router.config.ts` at config-load time, so it
 * must stay plain TypeScript: no route imports, no browser globals, no `.tsx`.
 * Same discipline as `docs-manifest.ts`.
 *
 * ON THE CAPABILITY SETS
 * ----------------------
 * They were declared here, as a deliberate placeholder for an owner that did
 * not exist. It exists now - `MODEL_FORMATS` in `@vctrl/core/model-formats` -
 * and the sets moved to `convert-capabilities.ts`, which reads it.
 *
 * They are in a sibling module rather than in this one because of the
 * config-load rule above: a runtime `@vctrl/core` import here would resolve
 * through `node_modules` to a build directory CI has not produced, and break
 * the app build. `ConvertFormat` arrives as a type, which erases.
 *
 * The ratchet they buy is unchanged: a pair whose endpoints are outside the
 * sets fails a test, so a page for a conversion we cannot perform is impossible
 * to publish. That is what lets pages and pipeline ship independently.
 */

import type { ModelFormatId } from '@vctrl/core/model-formats'

/** Where the converter family lives. Every other path is built from this one. */
export const CONVERT_INDEX_PATH = '/convert'

/**
 * The index page's own copy.
 *
 * It lives beside the pairs because the layout, the index route and /llms.txt
 * each need it, and a page title restated in three files is how the sitemap and
 * the static page list already drifted apart elsewhere in this repo.
 */
export const CONVERT_INDEX_COPY = {
	title: '3D format converters',
	description:
		'Convert a 3D model from one format to another in your browser. No account, no upload, no watermark.'
} as const

/**
 * Targets whose output size cannot be read from the source, so a page for one
 * has to say why before the reader wonders whether the conversion broke.
 *
 * USDZ is the only member today. Its writer re-encodes every texture as a PNG
 * or JPEG no more than `USDZ_MAX_TEXTURE_SIZE` across and stores geometry
 * uncompressed, so the result moves both ways: a 13 MB GLB with many small
 * textures came back as 40 MB, and the 18 MB camera sample, nine 4K textures,
 * as 4.4 MB. This rule once read "materially larger", and the note it produced
 * said two to three times - true of the first file, false of the second.
 */
export const TARGETS_WITH_UNREADABLE_SIZE = ['usdz'] as const

/**
 * What every USDZ result carries, said once so the pages cannot drift apart.
 *
 * The 1024 is `USDZ_MAX_TEXTURE_SIZE` in `@vctrl/core`, restated because this
 * module is reachable from the build config and must not import `@vctrl/*`;
 * `convert-pairs.spec.ts` fails if the two disagree.
 */
export const USDZ_RESULT_NOTE =
	'USDZ carries each texture as a PNG or JPEG at most 1024 pixels across, and its geometry uncompressed, so the result can be much smaller or much larger than what you dropped in.'

/**
 * A format id, as it appears in a URL slug.
 *
 * The owner's union, not a wider one of our own. It used to list `obj`, `stl`
 * and `fbx` as well, so a pair could name a format nothing could read - the
 * type said the manifest was sound and only a test disagreed. Now a slug for a
 * format the loader does not have does not compile.
 */
export type ConvertFormat = ModelFormatId

/**
 * A pass that changes what gets written, without changing the format it is
 * written as.
 *
 * These are not separate pairs. Nobody searches "gltf to glb draco"; they search
 * "gltf to glb" and then want the result to be small. A mode is therefore an
 * option on a conversion, and the slug stays the query.
 */
export type ConvertOption = 'draco' | 'webp'

export const CONVERT_OPTIONS: Record<
	ConvertOption,
	{ label: string; description: string }
> = {
	draco: {
		label: 'Compress geometry (Draco)',
		description:
			'Shrinks meshes, often by most of the file. Needs a viewer from the last few years.'
	},
	webp: {
		label: 'Recompress textures as WebP',
		description:
			'Usually the biggest saving, and every texture keeps its resolution.'
	}
}

/**
 * Which options a target can carry, and the reason each exclusion is real
 * rather than caution.
 *
 * `draco` belongs to every glTF-family target, and was wrongly confined to GLB.
 * `KHR_draco_mesh_compression` is a document extension, so the compressed
 * document serializes as either GLB or glTF-plus-ZIP; the only GLB-specific
 * thing about `exportDocumentGLBDraco` is the `writeBinary` at the end of it.
 * Reading the exporter's shape as the format's rule left three of the four
 * pages without the pass that shrinks a model most.
 *
 * `usdz` carries neither, and this is the important one. USDZ is exported from
 * the three.js scene (`exportThreeJSUSDZ`), not from the glTF-Transform
 * document these passes operate on, so a pass would run, appear to succeed and
 * change nothing in the downloaded file. An option that silently does nothing
 * is worse than an absent one.
 *
 * `stl`, `fbx` and `obj` carry neither for a simpler reason: three.js writes
 * none of them in a form we would ship, so none is a target at all. Their rows exist because the type
 * is total over every format the loader knows, which is what makes adding one a
 * compile error here rather than an `undefined` discovered on a page.
 */
export const OPTIONS_BY_TARGET: Record<
	ConvertFormat,
	readonly ConvertOption[]
> = {
	glb: ['draco', 'webp'],
	gltf: ['draco', 'webp'],
	usdz: [],
	stl: [],
	fbx: [],
	obj: []
}

/**
 * The one line saying why anyone wants each format the converter writes.
 *
 * WHY THIS IS KEYED ON THE FORMAT AND NOT THE PAIR. It answers "why would I
 * want this output", which is a property of the format rather than of the
 * conversion - so when a per-pair `rationale` carried it, the moment a second
 * source could reach USDZ the same sentence appeared on the index twice, word
 * for word. Four rows of two-line prose with half of it duplicated is a page to
 * read rather than a chooser to scan.
 *
 * That per-pair field is gone. Grouping the index by destination left it with
 * no render site at all, and it sat for two passes as thirteen unused sentences
 * with two comments - one here, one on the pair route - still describing where
 * they appeared.
 *
 * `Partial` for the reason `BUNDLE_SOURCE_COPY` is partial: a total
 * `Record<ConvertFormat, string>` would restate the format union outside the
 * owner, which `format-owner.spec.ts` forbids. It was `Record<string, string>`,
 * which is the same shape with the key check given away as well - a misspelled
 * format here was neither a build error nor a failing test, it was a heading
 * with nothing under it. That a *missing* target is caught was already true and
 * stays true: `convert-pairs.spec.ts` walks the rendered groups and fails on a
 * blank reason.
 */
export const CONVERT_TARGET_COPY: Partial<Record<ConvertFormat, string>> = {
	glb: 'One self-contained file, so it cannot arrive somewhere with its textures missing.',
	gltf: 'Readable JSON with its textures as separate files, for inspecting or hand-editing the result.',
	usdz: 'What iPhones and iPads open in AR Quick Look, for putting a model in front of someone on Apple hardware.'
}

export interface ConvertTargetGroup {
	to: ConvertFormat
	toLabel: string
	/** The one line that says why anyone wants this format. */
	reason: string
	pairs: ConvertPair[]
}

/** The options a given conversion may offer. */
export function convertOptionsFor(pair: ConvertPair): readonly ConvertOption[] {
	return OPTIONS_BY_TARGET[pair.to]
}

export interface ConvertPair {
	/** URL segment, always `<from>-to-<to>`. */
	slug: string
	from: ConvertFormat
	to: ConvertFormat
	/** How the source format is written in prose and headings. */
	fromLabel: string
	toLabel: string
	/**
	 * `<title>`, kept close to the query on purpose. The H1 says the same from
	 * the two labels, so it can change them in place; the layout spec holds the
	 * two equal.
	 */
	title: string
	/** Meta description and the page's opening line. */
	description: string
	/**
	 * What to know about the result, shown beside the before-and-after once
	 * there is one. Usually why it is a size the reader did not expect;
	 * sometimes what did and did not survive the conversion. Optional, because
	 * most pairs produce exactly what anyone would assume.
	 *
	 * NEVER AN INSTRUCTION. This renders *after* a conversion, so telling
	 * someone what to drop here is telling them too late - and it is the second
	 * time that happened. The first put a USDZ size warning on
	 * an empty stage before anything had been dropped; the fix moved the field
	 * to the result, and three OBJ notes were then written opening with "Bring
	 * the .mtl and the texture images along with the .obj", which the empty
	 * state was already saying at the moment it was actionable.
	 *
	 * How to drop a bundle is a property of the source shape, not of the pair,
	 * and lives in `BUNDLE_SOURCE_COPY`.
	 */
	note?: string
}

export const CONVERT_PAIRS: ConvertPair[] = [
	{
		slug: 'glb-to-gltf',
		from: 'glb',
		to: 'gltf',
		fromLabel: 'GLB',
		toLabel: 'glTF',
		title: 'GLB to glTF converter',
		description:
			'Convert a GLB file to glTF in your browser. No account, no upload, no watermark.'
	},
	{
		slug: 'glb-to-usdz',
		from: 'glb',
		to: 'usdz',
		fromLabel: 'GLB',
		toLabel: 'USDZ',
		title: 'GLB to USDZ converter',
		description:
			'Convert a GLB file to USDZ in your browser. No account, no upload, no watermark.',
		/*
		  Measured, both directions: a 13 MB GLB came back as a 40 MB USDZ, and
		  the 18 MB camera sample as 4.4 MB. Either surprises someone who
		  expected the size to carry over.
		*/
		note: USDZ_RESULT_NOTE
	},
	{
		slug: 'gltf-to-glb',
		from: 'gltf',
		to: 'glb',
		fromLabel: 'glTF',
		toLabel: 'GLB',
		title: 'glTF to GLB converter',
		description:
			'Bundle a glTF file and its textures into a single GLB, in your browser. No account, no upload, no watermark.'
	},
	{
		slug: 'gltf-to-usdz',
		from: 'gltf',
		to: 'usdz',
		fromLabel: 'glTF',
		toLabel: 'USDZ',
		title: 'glTF to USDZ converter',
		description:
			'Convert a glTF file and its textures to USDZ, in your browser. No account, no upload, no watermark.',
		note: USDZ_RESULT_NOTE
	},
	{
		slug: 'stl-to-glb',
		from: 'stl',
		to: 'glb',
		fromLabel: 'STL',
		toLabel: 'GLB',
		title: 'STL to GLB converter',
		description:
			'Convert an STL file to GLB in your browser. No account, no upload, no watermark.',
		/*
		  Measured, not guessed: a 684 B STL came back as a 1.5 KB GLB. An STL
		  stores one normal per triangle and glTF stores one per vertex, so the
		  same mesh is 72 bytes a triangle instead of 50 - growth is the normal
		  case for this pair, not a sign anything went wrong. Same rule as the
		  USDZ note, keyed on the source instead of the target: an unexplained
		  number larger than the upload reads as a broken conversion.
		*/
		note: 'An STL keeps one normal per triangle where glTF keeps one per vertex, so the result is normally a little larger than the file you dropped in.'
	},
	{
		slug: 'stl-to-gltf',
		from: 'stl',
		to: 'gltf',
		fromLabel: 'STL',
		toLabel: 'glTF',
		title: 'STL to glTF converter',
		description:
			'Convert an STL file to glTF in your browser. No account, no upload, no watermark.',
		/* Same arithmetic as `stl-to-glb`, and glTF's JSON adds to it. */
		note: 'An STL keeps one normal per triangle where glTF keeps one per vertex, so the result is normally a little larger than the file you dropped in.'
	},
	{
		slug: 'stl-to-usdz',
		from: 'stl',
		to: 'usdz',
		fromLabel: 'STL',
		toLabel: 'USDZ',
		title: 'STL to USDZ converter',
		description:
			'Convert an STL file to USDZ in your browser. No account, no upload, no watermark.',
		/*
		  Deliberately not the sentence the GLB and glTF pairs carry. Theirs is
		  about textures, and an STL has none - the measured 13 MB to 40 MB case
		  says nothing about this conversion. What is true here is the geometry:
		  USDZ is a zip of uncompressed USD, and a print or scan mesh is dense.
		*/
		note: 'USDZ stores its geometry uncompressed, so a dense print or scan mesh can come back larger than the STL you dropped in.'
	},
	{
		slug: 'fbx-to-glb',
		from: 'fbx',
		to: 'glb',
		fromLabel: 'FBX',
		toLabel: 'GLB',
		title: 'FBX to GLB converter',
		description:
			'Convert an FBX file to GLB in your browser. No account, no upload, no watermark.',
		/*
		  What an FBX arrives with that the conversion does not keep, said before
		  the download rather than discovered after it. Cameras and lights have no
		  glTF equivalent beyond what a material carries, and three.js re-encodes
		  every embedded texture on the way out, so a JPEG-heavy file can come
		  back larger.

		  Animation is on that list too, and this note claimed the opposite on
		  both FBX pages. `FBXLoader` leaves its clips on `object.animations` and
		  `GLTFExporter` writes only the clips passed as `options.animations`,
		  which nothing passes - so the clips are dropped, silently, on a page
		  that promised they would come across.
		*/
		note: 'Meshes, materials, textures and skinning all come across. Animation, cameras and lights do not.'
	},
	{
		slug: 'fbx-to-gltf',
		from: 'fbx',
		to: 'gltf',
		fromLabel: 'FBX',
		toLabel: 'glTF',
		title: 'FBX to glTF converter',
		description:
			'Convert an FBX file to glTF in your browser. No account, no upload, no watermark.',
		/* The same note, and the same caveat about animation, as `fbx-to-glb`. */
		note: 'Meshes, materials, textures and skinning all come across. Animation, cameras and lights do not.'
	},
	{
		slug: 'fbx-to-usdz',
		from: 'fbx',
		to: 'usdz',
		fromLabel: 'FBX',
		toLabel: 'USDZ',
		title: 'FBX to USDZ converter',
		description:
			'Convert an FBX file to USDZ in your browser. No account, no upload, no watermark.',
		/*
		  The USDZ texture sentence, plus the one thing that is specific to this
		  source: an FBX states its own unit and the conversion honours it, which
		  is what makes AR placement come out at the right size. A file that
		  misdeclares its unit is the case where that shows.
		*/
		note: `${USDZ_RESULT_NOTE} AR Quick Look places a model at real size, and that size comes from the unit the FBX declares.`
	},
	{
		slug: 'obj-to-glb',
		from: 'obj',
		to: 'glb',
		fromLabel: 'OBJ',
		toLabel: 'GLB',
		title: 'OBJ to GLB converter',
		description:
			'Convert an OBJ file and its textures to a single GLB, in your browser. No account, no upload, no watermark.',
		/*
		  The drop instruction belongs to the surface, which keys it on the source
		  being a bundle. What belongs here is what people get wrong before they
		  drop anything: leaving the .mtl behind and reading the result as a
		  broken converter.
		*/
		note: 'Without the .mtl and the texture images, an OBJ carries no materials at all - so a result that is correct but grey means they did not come along with it.'
	},
	{
		slug: 'obj-to-gltf',
		from: 'obj',
		to: 'gltf',
		fromLabel: 'OBJ',
		toLabel: 'glTF',
		title: 'OBJ to glTF converter',
		description:
			'Convert an OBJ file and its textures to glTF in your browser. No account, no upload, no watermark.',
		note: 'Without the .mtl and the texture images, an OBJ carries no materials at all - so a result that is correct but grey means they did not come along with it.'
	},
	{
		slug: 'obj-to-usdz',
		from: 'obj',
		to: 'usdz',
		fromLabel: 'OBJ',
		toLabel: 'USDZ',
		title: 'OBJ to USDZ converter',
		description:
			'Convert an OBJ file and its textures to USDZ in your browser. No account, no upload, no watermark.',
		note: `Without the .mtl and the texture images, an OBJ carries no materials at all - so a result that is correct but grey means they did not come along with it. ${USDZ_RESULT_NOTE}`
	}
]

/**
 * Letters whose name begins with a vowel sound, so a label read out letter by
 * letter takes "an".
 *
 * Every format label here is an initialism, which is why the rule is about the
 * first letter's *name* rather than its spelling. The two disagree in both
 * directions and both cases are live: "an STL" though S is a consonant, and "a
 * USDZ" though U is a vowel, because U is read "you". A plain vowel test gets
 * exactly one of those wrong and it is the one already on the site.
 */
const VOWEL_SOUNDED_LETTERS = new Set('AEFHILMNORSX')

/**
 * "a" or "an", for a format label.
 *
 * The converter writes "Drop a GLB file", "Choose a glTF file" and so on from
 * the label, and every one of those sentences was correct while the sources
 * were GLB and glTF. STL, FBX and OBJ are why it cannot stay a literal "a".
 */
export function articleFor(label: string): 'a' | 'an' {
	return VOWEL_SOUNDED_LETTERS.has(label.charAt(0).toUpperCase()) ? 'an' : 'a'
}

/** The path of one pair's page. The single place the URL shape is written. */
export function convertPairPath(pair: ConvertPair): string {
	return `${CONVERT_INDEX_PATH}/${pair.slug}`
}

/** Every pair path, for the prerender list, the sitemap and the nav. */
export function convertPairPaths(): string[] {
	return CONVERT_PAIRS.map(convertPairPath)
}

/**
 * The pairs grouped by the format they read, which is the shape the sidebar
 * navigates by.
 *
 * Someone converting several files is holding one source format and choosing
 * between targets, so the source is the group and the target is the choice.
 * Grouping the other way would make them re-find their own format in every
 * group.
 *
 * The group label comes off the first member rather than a separate table: the
 * pairs already carry `fromLabel`, and a second place naming GLB is a second
 * place to get it wrong.
 */
export interface ConvertSourceGroup {
	from: ConvertFormat
	fromLabel: string
	pairs: ConvertPair[]
}

export function convertPairsBySource(): ConvertSourceGroup[] {
	const groups: ConvertSourceGroup[] = []

	for (const pair of CONVERT_PAIRS) {
		const group = groups.find((candidate) => candidate.from === pair.from)

		if (group) {
			group.pairs.push(pair)
			continue
		}

		groups.push({ from: pair.from, fromLabel: pair.fromLabel, pairs: [pair] })
	}

	return groups
}

/** Resolves a URL segment to its pair, or `null` for one that has no page. */
export function convertPairBySlug(
	slug: string | undefined
): ConvertPair | null {
	if (!slug) return null
	return CONVERT_PAIRS.find((pair) => pair.slug === slug) ?? null
}
