import type { StructuredLoadError } from './types'

/**
 * What a selection holding no model was, when it is something a visitor
 * plausibly meant as a model.
 *
 * The loader used to report every one of these as `unsupported_format` and
 * nothing else, so the copy could only list the formats we read: someone who
 * dropped product photos, a Blender file or a downloaded zip was told the same
 * sentence, and none of them learned what to do next. The file names were
 * already in hand where the refusal is made, so that is where the selection is
 * read, once, for every surface that words it.
 */
export type UnreadableSelection =
	/** Only pictures: someone with photos of a product, not a model of it. */
	| { kind: 'photos' }
	/** A Blender scene, which only Blender reads; it exports GLB. */
	| { kind: 'blender'; fileName: string }
	/** An archive, which is never opened here. */
	| { kind: 'archive'; fileName: string }

const PHOTO = /\.(jpe?g|png|heic|heif|webp)$/i
/* `.blend1`, `.blend2`: the backups Blender writes beside the scene. */
const BLENDER = /\.blend\d*$/i
const ARCHIVE = /\.zip$/i

/**
 * Reads a selection the loader found no model in. A Blender file or an archive
 * names the selection whatever else came with it, since the textures beside a
 * `.blend` are not what the visitor meant to bring; photos only when every
 * file is one.
 */
export function readUnreadableSelection(
	fileNames: readonly string[]
): UnreadableSelection | null {
	const blender = fileNames.find((name) => BLENDER.test(name))
	if (blender) return { kind: 'blender', fileName: baseName(blender) }

	const archive = fileNames.find((name) => ARCHIVE.test(name))
	if (archive) return { kind: 'archive', fileName: baseName(archive) }

	if (fileNames.length > 0 && fileNames.every((name) => PHOTO.test(name))) {
		return { kind: 'photos' }
	}

	return null
}

/** The reading a refusal carries, or `null` for any other error. */
export function unreadableSelectionOf(
	error: StructuredLoadError | null
): UnreadableSelection | null {
	if (error?.code !== 'unsupported_format') return null
	return (error.context?.selection as UnreadableSelection | undefined) ?? null
}

function baseName(path: string): string {
	return path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)
}
