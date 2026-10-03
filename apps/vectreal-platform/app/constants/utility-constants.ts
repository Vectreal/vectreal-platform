/**
 * UUID validation regex pattern
 * Matches standard UUID v4 format
 */
export const UUID_REGEX =
	/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * The largest single file storage accepts: the `assets` bucket's
 * `fileSizeLimit`, and `file_size_limit` in `supabase/config.toml`.
 */
export const MAX_STORED_FILE_BYTES = 100 * 1024 * 1024
