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
/*
  What an operating system leaves in a folder nobody put there: a folder of
  photos picked on a Mac carries a `.DS_Store`, and one from Windows a
  `Thumbs.db`. Counted, they turned the commonest photo drop into an unknown.
*/
const SYSTEM_FILE = /^(\..*|thumbs\.db|desktop\.ini)$/i
/*
  A model's texture folder, which holds pictures that are not photos of a
  product: someone who dropped a glTF's `textures/` without the `.gltf` needs
  the model file, not the photo offer.
*/
const TEXTURE_FOLDER = /(^|\/)(textures?|maps|tex|materials?)\//i

/**
 * Reads a selection the loader found no model in, by each file's path within
 * the selection (its name when it came without one). A Blender file names the
 * selection first, then an archive, whatever else came with them, since the
 * textures beside a `.blend` are not what the visitor meant to bring. Photos
 * only when every file is one and none sits in a texture folder.
 */
export function readUnreadableSelection(
	paths: readonly string[]
): UnreadableSelection | null {
	const named = paths
		.map((path) => path.replace(/\\/g, '/'))
		.filter((path) => !SYSTEM_FILE.test(baseName(path)))

	const blender = named.find((path) => BLENDER.test(path))
	if (blender) return { kind: 'blender', fileName: baseName(blender) }

	const archive = named.find((path) => ARCHIVE.test(path))
	if (archive) return { kind: 'archive', fileName: baseName(archive) }

	if (
		named.length > 0 &&
		named.every((path) => PHOTO.test(path) && !TEXTURE_FOLDER.test(path))
	) {
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
	return path.slice(path.lastIndexOf('/') + 1)
}
