import { readWithProgress } from './read-with-progress'
import { referencedUris } from './referenced-assets'
import { modelFormatForFileName } from '../model-formats'

/**
 * Why a link could not be read.
 *
 * - `unreachable`: the request threw. A browser gives the same `TypeError` for
 *   a host that refuses cross-origin reads, a host that does not exist and a
 *   visitor who is offline, on purpose, so these cannot be told apart.
 * - `http`: the host answered with a status that is not a file. Usually a link
 *   that has expired or moved.
 * - `unrecognized`: the bytes arrived, and neither the link nor the bytes say
 *   which format they are.
 * - `invalid`: the address is not a URL, or is relative where there is no page
 *   to resolve it against (Node, a worker).
 */
export type ModelFetchErrorKind =
	'unreachable' | 'http' | 'unrecognized' | 'invalid'

export class ModelFetchError extends Error {
	/**
	 * The host the model was asked from, or `null` for an address that is not a
	 * URL. The host and never the address: errors get logged and reported, and
	 * a presigned link is a credential until it expires. The caller already has
	 * the address it passed.
	 */
	readonly host: string | null

	constructor(
		readonly kind: ModelFetchErrorKind,
		url: string,
		readonly status?: number,
		options?: ErrorOptions
	) {
		const host = hostOf(url)
		super(
			!host || kind === 'invalid'
				? 'That address is not a URL a model can be fetched from'
				: kind === 'http'
					? `The model at ${host} answered ${status}`
					: kind === 'unreachable'
						? `The model at ${host} could not be read`
						: `The file at ${host} is not a model in a format that can be read`,
			options
		)
		this.name = 'ModelFetchError'
		this.host = host
	}
}

export interface FetchModelFilesOptions {
	/**
	 * Spread into every request, the model's and its references'. Carries an
	 * `AbortSignal`, headers, or `credentials` and `referrerPolicy` for a host
	 * that needs them other than the browser's defaults.
	 */
	init?: RequestInit
	/** How much of the model file has arrived, from 0 to 1, when its host says how large it is. */
	onProgress?: (fraction: number) => void
}

/**
 * Fetches the model a URL names as the files a drop would produce, so it loads
 * through exactly the path a dropped file does.
 *
 * The model file comes first. A `.gltf` brings the buffers and images it
 * references, fetched relative to it **on its own origin only**: the loader
 * pairs a reference with a file by its path beside the model, and a file from
 * another host has no such path. A reference that is skipped, or that fails to
 * fetch, is left out rather than failing the call, so the loader names it as
 * missing in the words it uses for a folder dropped without it.
 *
 * A URL that names no format (a presigned or download-endpoint link) is read
 * as a GLB when its bytes say so.
 *
 * Rejects with a `ModelFetchError` when the model itself cannot be read. An
 * abort through `init.signal`, at any point including while a glTF's files
 * download, rejects with the signal's reason.
 *
 * `onProgress` follows the model file alone: a `.gltf`'s buffers and images
 * download after it without reporting.
 */
export async function fetchModelFiles(
	url: string | URL,
	{ init, onProgress }: FetchModelFilesOptions = {}
): Promise<File[]> {
	/*
	  An abort wins, wherever it lands: checked before anything starts, after
	  everything finishes, and when anything fails, so a status or a sniff that
	  follows an abort cannot report in its place.
	*/
	const signal = init?.signal
	signal?.throwIfAborted()

	let modelUrl: URL
	try {
		modelUrl = new URL(url, globalThis.location?.href)
	} catch {
		// No `cause`: Node's URL error carries the address it refused.
		throw new ModelFetchError('invalid', String(url))
	}

	let files: File[]
	try {
		files = await readModelFiles(modelUrl, init, onProgress)
	} catch (error) {
		signal?.throwIfAborted()
		throw error
	}
	signal?.throwIfAborted()
	return files
}

async function readModelFiles(
	modelUrl: URL,
	init?: RequestInit,
	onProgress?: (fraction: number) => void
): Promise<File[]> {
	const model = await readFile(
		modelUrl,
		modelFileName(modelUrl),
		init,
		onProgress
	)
	if (!model.name.toLowerCase().endsWith('.gltf')) return [model]

	let gltfJson: unknown
	try {
		gltfJson = JSON.parse(await model.text())
	} catch {
		// Not JSON: the loader says so in its own words.
		return [model]
	}

	const siblings = await Promise.allSettled(
		siblingReferences(gltfJson, modelUrl).map((sibling) =>
			readFile(sibling, urlFilePath(sibling).split('/').pop() || null, init)
		)
	)

	return [
		model,
		...siblings.flatMap((result) =>
			result.status === 'fulfilled' ? [result.value] : []
		)
	]
}

async function readFile(
	url: URL,
	name: string | null,
	init?: RequestInit,
	onProgress?: (fraction: number) => void
): Promise<File> {
	let response: Response
	try {
		response = await fetch(url, init)
	} catch (cause) {
		if (init?.signal?.aborted) throw cause
		throw new ModelFetchError('unreachable', url.href, undefined, { cause })
	}

	if (!response.ok) throw new ModelFetchError('http', url.href, response.status)
	// A success with nothing in it, such as a 204, is not a model either.
	if (!response.body) throw new ModelFetchError('unrecognized', url.href)

	let chunks: Uint8Array<ArrayBuffer>[]
	try {
		chunks = await readWithProgress(
			response.body,
			Number(response.headers.get('Content-Length')) || undefined,
			onProgress
		)
	} catch (cause) {
		if (init?.signal?.aborted) throw cause
		// The connection dropped mid-file, which is the same next step.
		throw new ModelFetchError('unreachable', url.href, undefined, { cause })
	}

	const blob = new Blob(chunks)
	const resolvedName =
		name ??
		(isGlb(new Uint8Array(await blob.slice(0, 4).arrayBuffer()))
			? 'model.glb'
			: null)

	if (!resolvedName) throw new ModelFetchError('unrecognized', url.href)

	return withPath(new File([blob], resolvedName), urlFilePath(url))
}

// Not `URL.canParse`: Safari before 17 lacks it.
function hostOf(url: string): string | null {
	try {
		return new URL(url).host
	} catch {
		return null
	}
}

/**
 * The path a fetched file carries, decoded, without the leading slash.
 *
 * Doubles as its place in the selection the loader resolves references
 * against, so a glTF at `/models/chair/chair.gltf` and its `chair.bin` sit in
 * the same folder, exactly as they would had the folder been dropped.
 */
function urlFilePath(url: URL): string {
	const path = url.pathname.replace(/^\/+/, '')
	try {
		return decodeURIComponent(path)
	} catch {
		return path
	}
}

/**
 * The file's place in the selection, written the way the loader adopts a
 * dropped file's path, and only when the path has a folder in it: the loader
 * branches on `webkitRelativePath` being set.
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
 * The model's file name, read off the URL. `null` when the last segment names
 * no format the loader reads, which is ordinary for presigned links.
 */
function modelFileName(url: URL): string | null {
	const name = urlFilePath(url).split('/').pop() ?? ''
	return modelFormatForFileName(name)?.canImport ? name : null
}

/** The four bytes every binary glTF starts with: `glTF`. */
const GLB_MAGIC = [0x67, 0x6c, 0x54, 0x46]

function isGlb(bytes: Uint8Array): boolean {
	return GLB_MAGIC.every((byte, index) => bytes[index] === byte)
}

/** The URLs a `.gltf` references on its own origin, deduplicated. */
function siblingReferences(gltfJson: unknown, modelUrl: URL): URL[] {
	const siblings = new Map<string, URL>()
	for (const uri of referencedUris(gltfJson)) {
		let url: URL
		try {
			url = new URL(uri, modelUrl)
		} catch {
			continue
		}
		if (url.origin !== modelUrl.origin) continue
		siblings.set(url.href, url)
	}
	return [...siblings.values()]
}
