/**
 * Where an asset's bytes live in the bucket.
 *
 * Pure, and separate from `asset-storage.server.ts`, because that module opens
 * a database client at import time - so nothing in the default test run can
 * import it, and only the opt-in integration suites, which have a real
 * Postgres, can. The rule it holds is worth reaching from an ordinary spec: an
 * asset's *name* may carry the folders it sat in - two textures called
 * `diffuse.png` in different subfolders are two assets, and the path is what
 * tells them apart - while the object key has to stay a single valid segment.
 */

/** The bucket key for one asset's bytes. */
export const assetObjectPath = (
	sceneId: string,
	assetId: string,
	fileName: string
): string => `scenes/${sceneId}/assets/${assetId}/${objectSegment(fileName)}`

/**
 * The name as one segment a bucket will accept.
 *
 * ONE RULE, NOT TWO. Everything outside the accepted set becomes `_`, which
 * covers both jobs at once: it flattens the separators (the name reaches here
 * from a glTF URI, which is forward-slashed, and from a `File.name` written by
 * a picker on Windows, which is not), and it replaces the characters a bucket
 * refuses. A separate flattening step was written first and kept for a round;
 * removing it reddened nothing, because this replace had already subsumed it.
 *
 * The second job is the one that is easy to miss. Supabase Storage rejects an
 * object key outside roughly `[A-Za-z0-9_/!.*'() &$=@;:+,?-]` with a 400
 * `InvalidKey`, and the key used to be the bare basename - so only the *file*
 * name had to satisfy it. Moving the folders into the key made the *folder*
 * name have to satisfy it too, and a folder name is author-chosen prose:
 * `Oberflächen/holz.png` and `材质/diffuse.png` save today and were refused
 * outright afterwards, permanently rather than once, because no later save can
 * write a key the bucket will not take. Verified against a running Supabase,
 * which answers `{"error":"InvalidKey"}` for exactly those and 200 for what
 * this produces.
 *
 * The set here is narrower than the bucket's, deliberately. `#` and `?` are
 * accepted by the bucket but `@supabase/storage-js` interpolates the key into
 * the upload URL unencoded, so either one truncates the request path.
 *
 * Nothing is lost by it: the name the loader resolves against lives in
 * `assets.name`, and `assetId` is what makes the key unique. This segment
 * exists so a human reading the bucket can tell what they are looking at.
 */
/** What one path component may hold, on the storage server's file backend. */
const SEGMENT_LIMIT = 200

const objectSegment = (fileName: string): string => {
	const safe = fileName.replace(/[^A-Za-z0-9._-]/g, '_')

	/*
	  A SEGMENT OF NOTHING BUT DOTS IS NOT A NAME. `.` and `..` are inside the
	  accepted set, so they survive the replace, and the storage server then
	  path-normalizes them: a key ending `/..` is stored one directory up,
	  outside the `assetId` that was supposed to make it unique. Two such assets
	  in one scene collide and fail the save; worse, `remove` reports success and
	  deletes nothing, so the row goes and the bytes stay, counting against the
	  org's storage forever. A glTF can write `"uri": ".."`, so this is reachable
	  without a picker.
	*/
	if (/^\.*$/.test(safe)) return 'asset'

	return safe.length <= SEGMENT_LIMIT ? safe : shortened(safe)
}

/**
 * The tail of an over-long segment, keeping its extension.
 *
 * The file backend enforces 255 bytes per path *component*, not per key, and
 * answers a longer one with a 500. That limit used to be spent on the bare
 * basename; putting the folders in the key makes the whole flattened path
 * compete for it, so a deeply nested texture can now reach it where its file
 * name never would. Every character here is ASCII by the time we arrive, since
 * the replace above collapses everything else, so length is bytes.
 *
 * The tail rather than the head: the end of a flattened path is the part that
 * says which file this is. Hosted Supabase is S3-backed and has no per-segment
 * rule, so this only bites the file backend - but it bites it with a 500, and
 * the segment exists for a human reading the bucket, who does not need 900
 * characters of it.
 */
const shortened = (segment: string): string => {
	const dot = segment.lastIndexOf('.')
	const extension = dot > 0 ? segment.slice(dot) : ''
	const head = extension ? segment.slice(0, dot) : segment
	const keep = Math.max(1, SEGMENT_LIMIT - extension.length)

	return head.slice(-keep) + extension
}
