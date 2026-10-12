import { modelFormatForFileName } from '@vctrl/core/model-formats'
import { referencedUris } from '@vctrl/core/model-loader'

/**
 * The rules behind `/view?src=<url>`: which links it will open, what the
 * fetched file is called, and which of a glTF's references it may follow.
 *
 * Pure, with no DOM and no database, so a spec reads every rule directly.
 */

/** What the page was asked to open. */
export type ViewSource =
	| { kind: 'none' }
	| { kind: 'invalid'; raw: string; reason: string }
	| { kind: 'url'; url: URL }

/*
  Hosts a browser treats as potentially trustworthy over plain http. Anywhere
  else an http link would be blocked as mixed content on an https page, so
  accepting it would only move the refusal somewhere less clear.
*/
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * Reads the `src` parameter.
 *
 * Only https, plus http on a loopback host. Everything else is refused here,
 * before any request: `javascript:` and `data:` because a link is not code or
 * an inline payload, `blob:` and `file:` because they name nothing a visitor
 * can share, and our own origin because this page is for files hosted
 * somewhere else.
 */
export function parseViewSource(
	raw: string | null,
	pageOrigin: string
): ViewSource {
	const trimmed = raw?.trim()
	if (!trimmed) return { kind: 'none' }

	let url: URL
	try {
		url = new URL(trimmed)
	} catch {
		return {
			kind: 'invalid',
			raw: trimmed,
			reason: 'That is not a complete link. It should start with https://.'
		}
	}

	const secure =
		url.protocol === 'https:' ||
		(url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname))

	if (!secure) {
		return {
			kind: 'invalid',
			raw: trimmed,
			reason: 'Only https:// links can be opened here.'
		}
	}

	/*
	  Compared without a trailing dot on the host: `vectreal.com.` is the same
	  host to DNS and to the browser, and spelling it that way must not get a
	  link to this site past the check.
	*/
	if (withoutTrailingDot(url.origin) === withoutTrailingDot(pageOrigin)) {
		return {
			kind: 'invalid',
			raw: trimmed,
			reason: 'That link points at Vectreal itself, not at a model file.'
		}
	}

	return { kind: 'url', url }
}

function withoutTrailingDot(origin: string): string {
	const { protocol, hostname, port } = new URL(origin)
	return `${protocol}//${hostname.replace(/\.$/, '')}${port ? `:${port}` : ''}`
}

/**
 * The path a fetched file carries, decoded, without the leading slash.
 *
 * Doubles as the file's place in the selection the loader resolves references
 * against, so a glTF at `/models/chair/chair.gltf` and its `chair.bin` sit in
 * the same folder, exactly as they would if the visitor had dropped it.
 */
export function urlFilePath(url: URL): string {
	const path = url.pathname.replace(/^\/+/, '')
	try {
		return decodeURIComponent(path)
	} catch {
		return path
	}
}

/**
 * The model's file name, read off the link.
 *
 * `null` when the last segment names no format the loader reads, which is
 * ordinary for presigned and download-endpoint links. The caller then sniffs
 * the bytes instead.
 */
export function modelFileName(url: URL): string | null {
	const name = urlFilePath(url).split('/').pop() ?? ''
	return modelFormatForFileName(name)?.canImport ? name : null
}

/** The four bytes every binary glTF starts with: `glTF`. */
const GLB_MAGIC = [0x67, 0x6c, 0x54, 0x46]

/** Whether the bytes are a binary glTF, for a link that does not say. */
export function isGlb(bytes: Uint8Array): boolean {
	return GLB_MAGIC.every((byte, index) => bytes[index] === byte)
}

/** A file a glTF references, and where to fetch it. */
export interface SiblingReference {
	url: URL
	/** Its path, in the same frame as `urlFilePath` of the model. */
	path: string
}

/**
 * The files a `.gltf` names, as URLs to fetch.
 *
 * Same origin as the model only. A reference is resolved against the model's
 * link the way a browser resolves a relative URL, and an absolute reference to
 * another host is dropped rather than followed: this page fetches what the
 * link's own host serves, and is not a relay that a crafted glTF can point at
 * a third host, or back at ours.
 *
 * A dropped reference is not an error here. The loader reports the assets it
 * could not find, in the words it uses for a folder dropped without them.
 */
export function siblingReferences(
	gltfJson: unknown,
	modelUrl: URL
): SiblingReference[] {
	const siblings = new Map<string, SiblingReference>()

	for (const uri of referencedUris(gltfJson)) {
		let url: URL
		try {
			url = new URL(uri, modelUrl)
		} catch {
			continue
		}
		if (url.origin !== modelUrl.origin) continue
		siblings.set(url.href, { url, path: urlFilePath(url) })
	}

	return [...siblings.values()]
}
