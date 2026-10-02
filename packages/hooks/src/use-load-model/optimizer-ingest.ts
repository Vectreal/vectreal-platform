import { SupersededError } from '@vctrl/core/model-optimizer'

/**
 * Optimizer ingest is not part of "is the model on screen".
 *
 * The model is always published before this runs, so a failure here must not
 * turn a visible scene into an error state. It costs the optimize step, which
 * `optimizer.error` and `optimizer.isPreparing` already report.
 *
 * A fallback re-imports the model, so it must never run, or be run inside
 * `ingest`, once the optimizer has refused this load as superseded.
 */
export const ingestIntoOptimizer = async (
	mayIngest: () => boolean,
	ingest: (ensureCurrent: () => void) => Promise<void>,
	fallback?: () => Promise<void>
): Promise<void> => {
	// For an ingest that awaits before reaching the optimizer: call it right
	// before the optimizer call, which claims the optimizer synchronously.
	const ensureCurrent = () => {
		if (!mayIngest()) throw new SupersededError()
	}

	if (!mayIngest()) return
	try {
		await ingest(ensureCurrent)
		return
	} catch (error) {
		// A newer model owns the optimizer; retrying would take it back.
		if (error instanceof SupersededError) return
		console.warn('Optimizer ingest failed.', error)
	}

	if (!fallback || !mayIngest()) return

	try {
		await fallback()
	} catch (error) {
		console.warn(
			'Optimizer fallback import failed; optimization is unavailable for this model.',
			error
		)
	}
}
