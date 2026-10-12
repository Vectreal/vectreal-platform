import {
	isGlb,
	modelFileName,
	siblingReferences,
	urlFilePath
} from './view-source'
import { readWithProgress } from '../http/read-with-progress'

/**
 * Why a link could not be read.
 *
 * - `unreachable`: the request threw. The browser gives the same `TypeError`
 *   for a host that refuses cross-origin reads, a host that does not exist and
 *   a visitor who is offline, on purpose, so these cannot be told apart and the
 *   page answers all of them with the same next step.
 * - `http`: the host answered and allowed the read, with a status that is not
 *   a file. Usually a link that has expired or moved.
 * - `unrecognized`: the bytes arrived, and neither the link nor the bytes say
 *   which format they are.
 */
export type RemoteModelErrorKind = 'unreachable' | 'http' | 'unrecognized'

export class RemoteModelError extends Error {
	constructor(
		readonly kind: RemoteModelErrorKind,
		readonly status?: number,
		options?: ErrorOptions
	) {
		super(
			kind === 'http'
				? `The link answered ${status}`
				: kind === 'unreachable'
					? 'The link could not be read from this page'
					: 'The link is not a model file this page can read',
			options
		)
		this.name = 'RemoteModelError'
	}
}

/*
  No cookies and no referrer. The visitor's credentials for the model's host
  are not ours to spend, and the page URL, which carries the link itself, is
  not the host's business.
*/
const REQUEST_INIT: RequestInit = {
	credentials: 'omit',
	referrerPolicy: 'no-referrer'
}

interface ReadOptions {
	onProgress?: (fraction: number) => void
	/** Abandons the read; it then rejects with whatever `fetch` rejects with. */
	signal?: AbortSignal
	/**
	 * `error` for a glTF's references: the same-origin rule is checked on the
	 * address as written, and a redirect would carry the request past it.
	 */
	redirect?: RequestRedirect
}

async function readFile(
	url: URL,
	name: string | null,
	{ onProgress, signal, redirect }: ReadOptions = {}
): Promise<File> {
	let response: Response
	try {
		response = await fetch(url, { ...REQUEST_INIT, signal, redirect })
	} catch (cause) {
		throw new RemoteModelError('unreachable', undefined, { cause })
	}

	if (!response.ok) throw new RemoteModelError('http', response.status)
	// A success with nothing in it, such as a 204, is not a model either.
	if (!response.body) throw new RemoteModelError('unrecognized')

	let chunks: Uint8Array<ArrayBuffer>[]
	try {
		chunks = await readWithProgress(
			response.body,
			Number(response.headers.get('Content-Length')) || undefined,
			onProgress
		)
	} catch (cause) {
		// The connection dropped mid-file, which is the same next step.
		throw new RemoteModelError('unreachable', undefined, { cause })
	}

	const blob = new Blob(chunks)
	const resolvedName =
		name ??
		(isGlb(new Uint8Array(await blob.slice(0, 4).arrayBuffer()))
			? 'model.glb'
			: null)

	if (!resolvedName) throw new RemoteModelError('unrecognized')

	return withPath(new File([blob], resolvedName), urlFilePath(url))
}

/*
  The file's place in the selection, written the way `file-loaders` adopts a
  dropped file's path, and only when the path has a folder in it: the loader
  branches on `webkitRelativePath` being set.
*/
function withPath(file: File, path: string): File {
	if (path.includes('/') && path.endsWith(file.name)) {
		Object.defineProperty(file, 'webkitRelativePath', {
			value: path,
			configurable: true,
			enumerable: true
		})
	}
	return file
}

/**
 * Fetches the model a link names, in the visitor's browser, as the files the
 * loader takes from a drop.
 *
 * A `.gltf` arrives with the buffers and images it references, fetched from
 * the same host (`siblingReferences`) and never through a redirect, which
 * could lead anywhere. The model's own link may redirect: download links
 * do. One that cannot be fetched is left out
 * rather than failing the load, so the loader names what is missing, in the
 * words it uses for a folder dropped without it.
 *
 * Rejects with a `RemoteModelError` when the model itself cannot be read.
 */
export async function fetchRemoteModel(
	url: URL,
	options: ReadOptions = {}
): Promise<File[]> {
	const model = await readFile(url, modelFileName(url), options)
	if (!model.name.toLowerCase().endsWith('.gltf')) return [model]

	let gltfJson: unknown
	try {
		gltfJson = JSON.parse(await model.text())
	} catch {
		// Not JSON: the loader says so in its own words.
		return [model]
	}

	const siblings = await Promise.allSettled(
		siblingReferences(gltfJson, url).map(({ url: siblingUrl, path }) =>
			readFile(siblingUrl, path.split('/').pop() || null, {
				signal: options.signal,
				redirect: 'error'
			})
		)
	)

	return [
		model,
		...siblings.flatMap((result) =>
			result.status === 'fulfilled' ? [result.value] : []
		)
	]
}
