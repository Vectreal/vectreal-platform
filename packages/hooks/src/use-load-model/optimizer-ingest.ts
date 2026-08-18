/**
 * Optimizer ingest is not part of "is the model on screen".
 *
 * The model is always published before this runs, so a failure here must not
 * turn a visible scene into an error state. It costs the optimize step, which
 * `optimizer.error` and `optimizer.isPreparing` already report.
 */
export const ingestIntoOptimizer = async (
	ingest: () => Promise<void>,
	fallback?: () => Promise<void>
): Promise<void> => {
	try {
		await ingest()
		return
	} catch (error) {
		console.warn('Optimizer ingest failed.', error)
	}

	if (!fallback) return

	try {
		await fallback()
	} catch (error) {
		console.warn(
			'Optimizer fallback import failed; optimization is unavailable for this model.',
			error
		)
	}
}
