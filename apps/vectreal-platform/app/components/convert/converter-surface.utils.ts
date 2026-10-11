import { modelFormatForFileName } from '@vctrl/core/model-formats'

import type { BundleSourceCopy } from '../../lib/convert/convert-capabilities'
import type {
	ConvertOption,
	ConvertPair
} from '../../lib/convert/convert-pairs'
import type { StructuredLoadError } from '@vctrl/hooks/use-load-model'

/** What one conversion produced, stamped with the recipe that produced it. */
export interface Conversion {
	bytes: Uint8Array
	fileName: string
	/** Said beside this result only, because only this model lost it. */
	note?: string
}

/**
 * Passes that replace the optimizer's document with a changed one.
 *
 * The distinction matters because it decides whether changing an option can be
 * answered from the document as it stands or needs the optimizer's source put
 * back first. `texturesOptimization` is destructive; Draco is not, because
 * `exportDocumentGLBDraco` clones the document and writes the copy.
 */
export const DESTRUCTIVE_OPTIONS: readonly ConvertOption[] = ['webp']

/**
 * The container a result arrives in, when that is not the format itself.
 *
 * The button used to name the extension alone, which is the one thing on the
 * page that is not the format the visitor asked for: every glTF page said
 * "Download ZIP" under a "glTF converter" heading, beside "Convert to glTF".
 * Naming the format and, where they differ, the container, is both true at
 * once - and it stays true for a format that is written into an archive later.
 */
export function downloadContainer(fileName: string, target: string): string {
	const extension = fileName.split('.').pop()?.toLowerCase()

	return extension && extension !== target ? ` (.${extension})` : ''
}

/**
 * The bytes the conversion actually started from.
 *
 * A bundle is its whole selection - a folder is what the visitor had. A
 * single-file source is not: the drop zone takes every file now, because
 * refusing them silently was worse, so a GLB dropped next to the `.blend` it
 * came from would otherwise be measured against both and report a reduction
 * that never happened.
 */
export function measuredBytes(files: readonly File[]): number {
	const model = files.find(
		(file) => modelFormatForFileName(file.name)?.canImport
	)

	/*
	  Asked of the model that loaded, not of the page. The drop zone filters
	  nothing, so an OBJ and its textures load perfectly well on a GLB page - and
	  keying this on the page's own source excluded the siblings from the
	  baseline while the conversion very much contained them, reporting a large
	  increase that never happened.
	*/
	const isBundle = model ? modelFormatForFileName(model.name)?.isBundle : false
	const counted = isBundle || !model ? files : [model]

	return counted.reduce((total, one) => total + one.size, 0)
}

/**
 * What to tell someone whose file was refused.
 *
 * The loader already names what was wrong and the surface was throwing that
 * away for one sentence about the page's own source format - so dropping two
 * models at once, which the loader reports precisely, read as "Check it is a
 * valid GLB" about a GLB that was perfectly valid. Only the codes that are
 * written for a reader are passed through; the rest keep the sentence, because
 * a parser's own message is not copy.
 */
export function refusalMessage(
	error: StructuredLoadError | null,
	pair: ConvertPair,
	bundleCopy: BundleSourceCopy | null
): string {
	switch (error?.code) {
		case 'unsupported_format':
			/*
			  The likeliest refusal here by far, now that the drop zone filters
			  nothing on purpose. The generic sentence sent someone who dropped a
			  perfectly good `.3ds` off to check their STL - a file they never
			  brought - which is the same defect the `multiple_models` case below
			  was written for.
			*/
			return `Nothing in that selection is a format we can read. This page converts ${pair.fromLabel}.`

		case 'multiple_models':
			/*
			  "One at a time" is impossible advice on a bundle page, which asks
			  for a whole folder one line above the stage. There the fix is to
			  take the extra model out, not to drop fewer files.
			*/
			return bundleCopy
				? 'That folder has more than one model in it. Leave just the one you want converted, with its own files.'
				: 'That selection has more than one model in it. Drop one at a time.'

		case 'missing_assets':
			return (
				bundleCopy?.refusal ??
				'That model refers to files that did not come with it. Drop the folder it lives in.'
			)

		case 'gltf_load_failed':
		case 'binary_load_failed':
			/*
			  The file arrived complete and would not parse, which is the one
			  thing the bundle copy must not be used for: it asks for the sibling
			  files, and on a glTF page that sentence is handed to someone who
			  brought the whole folder. Whether a bundle's parts are missing is
			  `missing_assets`, above.
			*/
			return `Check it is a valid ${pair.fromLabel}.`

		default:
			if (bundleCopy) return bundleCopy.refusal

			/*
			  "a", not `articleFor`, and this is the rule rather than an exception
			  to it: an article agrees with the word that follows it, and here
			  that word is always "valid". Reading the format label instead
			  produced "an valid FBX" - the same defect as "Drop a STL file here",
			  reintroduced by its own fix one line along.
			*/
			return `Check it is a valid ${pair.fromLabel}.`
	}
}

/** How many conversions to keep; `storeConversion` says why it is bounded. */
export const KEPT_CONVERSIONS = 3
