import {
	BUNDLE_FORMAT_IDS,
	EXPORTABLE_FORMAT_IDS,
	IMPORTABLE_FORMAT_IDS,
	modelAcceptPattern,
	modelFormat
} from '@vctrl/core/model-formats'

import {
	CONVERT_PAIRS,
	CONVERT_TARGET_COPY,
	type ConvertFormat,
	type ConvertTargetGroup
} from './convert-pairs'

/**
 * What the converter family may offer, read from the format owner.
 *
 * WHY THIS IS NOT IN `convert-pairs.ts`, WHERE IT USED TO BE. That module is
 * imported by `react-router.config.ts` to build the prerender list, and a Vite
 * config is bundled before any alias plugin runs - so `@vctrl/core` resolves
 * there through `node_modules`, which points at `build/packages/vctrl/core`
 * (`publishConfig.directory`). The app's `build-ci` target declares no
 * `^build`, so on a clean checkout that directory does not exist and the app
 * build would fail on a workspace import the config never needed. The manifest
 * therefore takes `ModelFormatId` as a type, which erases, and every runtime
 * read of the owner lives here instead.
 *
 * Everything below is derived. Adding a format to `MODEL_FORMATS` moves all of
 * it with no edit here, which is the whole point: the set had nine independent
 * statements and this file used to be three of them.
 */

/**
 * Formats the loader accepts that a converter page must still not offer.
 *
 * This is product policy rather than capability, which is why it is written out
 * rather than derived. USDZ import is broken - the loader hands a zip archive
 * to a glTF reader - so a `usdz-to-glb` page would greet a stranger with a
 * parse error. It returns to the source set when that is fixed, not before.
 */
const SOURCES_WITHHELD: readonly ConvertFormat[] = ['usdz']

/** What a converter page may read. */
export const CONVERTER_SOURCE_FORMATS: readonly ConvertFormat[] =
	IMPORTABLE_FORMAT_IDS.filter((id) => !SOURCES_WITHHELD.includes(id))

/**
 * What a converter page may write, in the order the index reads them.
 *
 * `fbx` is absent because three.js ships no FBX exporter, so it is absent from
 * the owner's exportable set - which is what makes "glb to fbx", a top query on
 * both incumbent converter sites, impossible to publish here rather than merely
 * unwritten.
 *
 * WHY THE ORDER IS WRITTEN HERE AND NOT TAKEN FROM THE OWNER. They are two
 * different decisions that happen to range over the same three formats. The
 * owner's declaration order is dispatch precedence - `gltf` leads there so a
 * folder holding a `.gltf` beside a `.glb` is read as the bundle. This is
 * reading order on a page, and it leads with GLB because that is what most
 * people arriving here want. Deriving one from the other silently put GLB last
 * again, behind two formats fewer people are looking for, which is the exact
 * accident the index was reordered to fix.
 *
 * Only the decision is written down - which format leads - and the rest keeps
 * the owner's order behind it. Writing the full order out instead made this
 * module a second enumeration of the set, which `tests/format-owner.spec.ts`
 * caught: a list here could silently lose a format the owner can still write,
 * and a format added to the owner would need an edit here to appear at all.
 */
const LEADS: ConvertFormat = 'glb'

export const CONVERTER_TARGET_FORMATS: readonly ConvertFormat[] = [
	...EXPORTABLE_FORMAT_IDS.filter((id) => id === LEADS),
	...EXPORTABLE_FORMAT_IDS.filter((id) => id !== LEADS)
]

/**
 * Sources that are a manifest pointing at siblings, so the drop target has to
 * take the whole folder rather than the one file.
 */
export const SOURCES_THAT_ARE_BUNDLES: readonly ConvertFormat[] =
	BUNDLE_FORMAT_IDS

/**
 * What a bundle source is called on its own page, and what has to arrive with
 * it.
 *
 * Every one of these sentences was written as glTF's, because glTF was the only
 * bundle: "a glTF folder", "the .gltf together with its .bin and images",
 * "a .gltf needs its .bin and image files". The day OBJ became the second one,
 * all three appeared on the three OBJ pages, describing a format the visitor
 * had not brought.
 *
 * Keyed on the source, and `Partial` on purpose: a total `Record` here would
 * have to spell the bundle formats as a union, which is the one thing
 * `format-owner.spec.ts` forbids outside the owner - that guard exists because
 * a second statement of the set is how these pages drifted in the first place.
 * The ratchet is a test instead: `convert-pairs.spec.ts` fails when a bundle
 * source has no entry here.
 *
 * Hand-written rather than derived from `siblingExtensions`, which would
 * produce "its .mtl, .jpeg, .jpg, .png and .webp" - a correct list nobody would
 * write.
 */
export interface BundleSourceCopy {
	/** Goes after "Drop": "Drop **an OBJ and its files** here". */
	dropTarget: string
	/** The line under it, which is the one thing to know before dropping. */
	instruction: string
	/** The picker button. */
	chooseLabel: string
	/** What is missing when the load fails. */
	refusal: string
}

export const BUNDLE_SOURCE_COPY: Partial<
	Record<ConvertFormat, BundleSourceCopy>
> = {
	gltf: {
		dropTarget: 'a glTF folder',
		instruction:
			'Drop the whole folder, or the .gltf together with its .bin and images.',
		chooseLabel: 'Choose .gltf and its files',
		refusal: 'A .gltf needs its .bin and image files alongside it.'
	},
	obj: {
		dropTarget: 'an OBJ and its files',
		instruction:
			'Drop the whole folder, or the .obj together with its .mtl and textures.',
		chooseLabel: 'Choose .obj and its files',
		/*
		  Deliberately not "it needs them". An OBJ without its `.mtl` loads
		  perfectly well and comes back grey, so the refusal a visitor actually
		  sees here is a broken `.obj`, not a missing sibling.
		*/
		refusal: 'Check the .obj is valid, and bring its .mtl and textures along.'
	}
}

/** The copy for a bundle source, or `null` for a format that is one file. */
export function bundleSourceCopy(from: ConvertFormat): BundleSourceCopy | null {
	return BUNDLE_SOURCE_COPY[from] ?? null
}

/**
 * The conversions grouped by what they produce.
 *
 * WHY THE INDEX GROUPS BY DESTINATION AND THE RAIL GROUPS BY SOURCE. They are
 * answering different questions. On a pair page you already have a file open,
 * so the rail asks "what else can this become" - source-first. On the index you
 * have nothing open, and the thing that needs explaining is the format you
 * would want *out*, because that is the only part carrying a reason.
 *
 * It also decides how the page scales. Sources are the set that grows - OBJ,
 * STL and FBX took it from two to five - while the writable set stays three. Source-first turns that into five sections of near-identical
 * rows; destination-first turns it into the same three sections with more chips
 * in each. And since the explanation belongs to the destination, grouping this
 * way states each one exactly once instead of repeating it per source that can
 * reach it, which is the duplication that made the first version dense.
 */
export function convertPairsByTarget(): ConvertTargetGroup[] {
	const groups = new Map<ConvertFormat, ConvertTargetGroup>()

	for (const pair of CONVERT_PAIRS) {
		const group = groups.get(pair.to)

		if (group) {
			group.pairs.push(pair)
			continue
		}

		groups.set(pair.to, {
			to: pair.to,
			toLabel: pair.toLabel,
			reason: CONVERT_TARGET_COPY[pair.to] ?? '',
			pairs: [pair]
		})
	}

	/*
	  Ordered by `CONVERTER_TARGET_FORMATS` rather than by whichever pair happens
	  to be declared first. Insertion order put GLB last, behind two formats
	  fewer people are looking for, because `glb-to-gltf` is the first row in the
	  manifest - a reading order decided by an unrelated alphabetical accident.
	*/
	return CONVERTER_TARGET_FORMATS.map((format) => groups.get(format)).filter(
		(group): group is ConvertTargetGroup => group !== undefined
	)
}

/**
 * What a pair page's file picker offers, in the spelling `<input accept>` takes.
 *
 * A hint in the file dialog, and only that. The drop zone deliberately filters
 * nothing - `converter-surface.tsx` says why - so this is the one place a pair
 * page names its own format to the browser. It had written `.${pair.from}` by
 * hand, which drops the media type and is correct only while every format's id
 * equals its extension.
 *
 * Built by the owner's own `modelAcceptPattern`, so this page's picker and the
 * publisher's cannot drift into two ways of spelling one format.
 */
export function sourceAcceptAttribute(from: ConvertFormat): string {
	return modelAcceptPattern([modelFormat(from)])
}
