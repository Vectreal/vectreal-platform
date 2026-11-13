/**
 * Reads a response body to the end, reporting how far it is from 0 to 1.
 *
 * `expectedBytes` is the size the caller believes the body has. It is what the
 * fraction is measured against, and with none there is nothing to measure, so
 * `onProgress` is not called. Clamped at 1, because a compressed response's
 * `Content-Length` counts what crossed the wire while the stream delivers the
 * decoded bytes, which can be more.
 *
 * `onBytes` is told every chunk's running total, whether or not a size is
 * known: a download with no length still has bytes to show.
 */
export async function readWithProgress(
	body: ReadableStream<Uint8Array<ArrayBuffer>>,
	expectedBytes?: number,
	onProgress?: (fraction: number) => void,
	onBytes?: (received: number) => void
): Promise<Uint8Array<ArrayBuffer>[]> {
	const reader = body.getReader()
	const chunks: Uint8Array<ArrayBuffer>[] = []
	let received = 0
	for (;;) {
		const { done, value } = await reader.read()
		if (done) break
		chunks.push(value)
		received += value.byteLength
		if (expectedBytes) onProgress?.(Math.min(received / expectedBytes, 1))
		onBytes?.(received)
	}

	return chunks
}
