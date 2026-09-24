import {
	MODEL_FORMATS,
	modelFormatForFileName
} from '@vctrl/core/model-formats'

import type { ConvertPair } from '../../convert/convert-pairs'

/**
 * What a visitor brought to a converter page, and whether we could read it.
 *
 * WHY THIS EVENT EXISTS AT ALL. The source format someone converts *from* is
 * the segment: FBX means games, OBJ means scanning, STL means printing. Each
 * pair has its own URL so that route traffic answers that without asking
 * anyone, and Search Console is the primary instrument for it. This is the one
 * thing Search Console cannot see - what they actually dropped once they got
 * here - and the gap between the two is the whole point:
 *
 *   landed on `fbx-to-glb`, dropped a `.3ds`
 *
 * is a demand signal for a format that has no page, no loader, and no way of
 * announcing itself otherwise. That is why a refusal is reported rather than
 * only a success: the files we cannot read are the more interesting half.
 *
 * WHAT IT CANNOT TELL US. PostHog is `opt_out_capturing_by_default`, so a
 * visitor who ignores the cookie banner emits nothing - and people who land,
 * read and leave are exactly the population this question is about. Every
 * number from this event is a **rate** among consenting visitors, never a
 * count of arrivals. Read it beside Search Console impressions, not instead of
 * them.
 */
export interface ConvertModelReceivedProps {
	/** The page they were on: always `<from>-to-<to>`. */
	pair: string
	from: string
	to: string
	/** The extension they actually brought, which is often not `from`. */
	file_format: string
	/** True when the page they landed on does not read what they dropped. */
	format_mismatch: boolean
	outcome: 'loaded' | 'refused'
	/** How many files came at once: a bundle arrives as several. */
	file_count: number
}

/**
 * The extension of the file the selection is *about*.
 *
 * The extension itself is never resolved against the formats we accept, and
 * that is deliberate: the question is what the visitor brought, so a `.3ds` has
 * to survive into the property. Resolving it would report `unknown` for
 * precisely the files worth knowing about.
 *
 * *Which* file it comes from is a different question, and taking the first one
 * answered it with an ordering accident. A bundle arrives as a directory
 * listing, so the canonical correct drop on `gltf-to-glb` or `obj-to-glb` led
 * with `scene.bin`, `model.mtl` or a texture - and the property whose whole
 * purpose is "what they actually brought" reported a sibling asset, with
 * `format_mismatch` true for a drop that was exactly right. The five bundle
 * pages would have read as near-100% mismatch, which is the headline number.
 */
function droppedFormat(files: readonly File[]): string {
	return extensionOf(subjectOf(files))
}

/**
 * The file a selection is about: the model in it, or failing that the thing
 * least likely to be an asset belonging to one.
 *
 * Both fallbacks matter. A format we cannot read is the interesting case, so a
 * lone `.3ds` has to reach the property rather than becoming nothing - and a
 * `.3ds` dropped *with* its textures must not be reported as a PNG either.
 */
function subjectOf(files: readonly File[]): string {
	const model = files.find(
		(file) => modelFormatForFileName(file.name)?.canImport
	)
	if (model) return model.name

	const notAnAsset = files.find((file) => couldBeAModel(file))

	return (notAnAsset ?? files[0])?.name ?? ''
}

/**
 * Whether a file could be the model, when none of them is a format we read.
 *
 * Three things it is not. A dotfile, because a folder picked on macOS arrives
 * carrying `.DS_Store` and nothing else in the selection has to be wrong for
 * that to win - which would report `ds_store` for the one signal this event
 * exists to catch. An extension the owner declares as a sibling. And anything
 * the browser itself calls an image, which is what covers the formats no list
 * here would have: a game-asset folder is exactly the FBX segment, and it
 * arrives full of `.tga`, `.dds` and `.exr`.
 */
function couldBeAModel(file: File): boolean {
	if (file.name.startsWith('.')) return false
	if (file.type.startsWith('image/')) return false

	return !SIBLING_EXTENSIONS.has(extensionOf(file.name))
}

/**
 * Every extension that arrives *beside* a model rather than as one, taken from
 * the format owner rather than listed here - this is a question it already
 * answers, and a second list of image extensions is one that goes stale.
 */
const SIBLING_EXTENSIONS = new Set(
	MODEL_FORMATS.flatMap((format) => format.siblingExtensions)
)

function extensionOf(name: string): string {
	const dot = name.lastIndexOf('.')

	/* Same rule as `modelFormatForFileName`: no dot is no extension, rather
	   than the whole file name read as one. */
	return dot < 0 ? 'unknown' : name.slice(dot + 1).toLowerCase()
}

export function buildConvertModelReceivedProps(
	pair: Pick<ConvertPair, 'slug' | 'from' | 'to'>,
	files: readonly File[],
	outcome: ConvertModelReceivedProps['outcome']
): ConvertModelReceivedProps {
	const fileFormat = droppedFormat(files)

	return {
		pair: pair.slug,
		from: pair.from,
		to: pair.to,
		file_format: fileFormat,
		format_mismatch: fileFormat !== pair.from,
		outcome,
		file_count: files.length
	}
}

/**
 * What a visitor left with: a conversion that finished, and one they saved.
 *
 * Arrival alone stops the funnel at the drop, so it answers which formats
 * people bring and not whether they got anything out. These two carry what
 * arrival cannot: the options ticked, and the sizes before and after, which
 * say whether the page did what it promised for that file.
 *
 * `convert_model_converted` fires when a result is filed, so a conversion a
 * newer drop superseded is not counted. `convert_model_downloaded` carries its
 * own pair, because the surface stays mounted across a pair switch and the page
 * a file was dropped on can differ from the one it is saved from.
 *
 * The same consent caveat as arrival applies: rates among consenting visitors,
 * never counts.
 */
export interface ConvertModelResultProps {
	pair: string
	from: string
	to: string
	/** The options ticked for this conversion, sorted, so equal sets compare equal. */
	options: string[]
	/** What the loader measured for the source; null when it measured nothing. */
	source_bytes: number | null
	result_bytes: number
	/** result / source, so 0.25 is a quarter of the size; null without a source size. */
	size_ratio: number | null
}

export function buildConvertModelResultProps(
	pair: Pick<ConvertPair, 'slug' | 'from' | 'to'>,
	options: readonly string[],
	sourceBytes: number | null,
	resultBytes: number
): ConvertModelResultProps {
	return {
		pair: pair.slug,
		from: pair.from,
		to: pair.to,
		options: [...options].sort(),
		source_bytes: sourceBytes,
		result_bytes: resultBytes,
		size_ratio: sourceBytes ? resultBytes / sourceBytes : null
	}
}
