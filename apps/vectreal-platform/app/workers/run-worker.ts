/** The reply protocol both app workers speak. */
type WorkerReply =
	{ type: 'progress' } | { type: 'done' } | { type: 'error'; message: string }

interface RunWorkerOptions<Reply extends WorkerReply, Result> {
	/** The request, transferred rather than copied where `transfer` says so. */
	message: unknown
	transfer: Transferable[]
	timeoutMs: number
	onProgress: (progress: Extract<Reply, { type: 'progress' }>) => void
	toResult: (done: Extract<Reply, { type: 'done' }>) => Result
	/** The caller's own wording, since the UI surfaces these as they are. */
	errors: { timedOut: string; undeserializable: string; crashed: string }
}

/**
 * Runs one request in a worker it owns, and kills the worker on every exit.
 *
 * The timeout lives here rather than around the call, because only this scope
 * holds the `Worker` and can terminate it. An external timeout would reject
 * while an encode kept running in the background, and every retry would stack
 * another one.
 *
 * The caller passes a factory rather than a worker: Vite only bundles a worker
 * whose `new URL(..., import.meta.url)` is written out at the call site, and
 * calling it in here makes a constructor that throws reject, like every other
 * failure.
 */
export function runWorker<Reply extends WorkerReply, Result>(
	createWorker: () => Worker,
	{
		message,
		transfer,
		timeoutMs,
		onProgress,
		toResult,
		errors
	}: RunWorkerOptions<Reply, Result>
): Promise<Result> {
	return new Promise<Result>((resolve, reject) => {
		const worker = createWorker()

		// Every exit runs through here so the worker is never left alive and the
		// timer is never left pending.
		const settle = (finish: () => void) => {
			clearTimeout(timer)
			worker.terminate()
			finish()
		}

		const timer = setTimeout(() => {
			settle(() => reject(new Error(errors.timedOut)))
		}, timeoutMs)

		worker.onmessage = ({ data }: MessageEvent<Reply>) => {
			if (data.type === 'progress') {
				onProgress(data as Extract<Reply, { type: 'progress' }>)
			} else if (data.type === 'done') {
				settle(() =>
					resolve(toResult(data as Extract<Reply, { type: 'done' }>))
				)
			} else if (data.type === 'error') {
				const { message } = data as Extract<Reply, { type: 'error' }>
				settle(() => reject(new Error(message)))
			}
		}

		// Neither onmessage nor onerror fires when a message fails structured
		// clone, so without this the run would hang until the timeout.
		worker.onmessageerror = () => {
			settle(() => reject(new Error(errors.undeserializable)))
		}

		worker.onerror = (error) => {
			settle(() => reject(new Error(error.message ?? errors.crashed)))
		}

		worker.postMessage(message, transfer)
	})
}
