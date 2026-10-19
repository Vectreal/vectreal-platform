import { createHash } from 'node:crypto'

import { agentApiError } from './agent-api-response'
import { MAX_STORED_FILE_BYTES } from '../../../constants/utility-constants'
import { GlbFormatError, splitGlb, type SplitGlb } from '../scene/glb-container'

// The multipart envelope around the file is small; this only stops a body far
// past the cap from being read into memory before it is refused.
const MAX_BODY_BYTES = MAX_STORED_FILE_BYTES + 1024 * 1024

export interface AgentGlbUpload {
	/** The whole form, for fields beside the file. */
	form: FormData
	glb: Uint8Array
	/** The GLB split into its JSON and BIN chunks, which also validated it. */
	split: SplitGlb
	/** Keys the idempotency fingerprint on the bytes, not only the fields. */
	fileSha256: string
}

/**
 * The multipart `file` of a v1 upload: one self-contained glTF 2.0 binary of
 * at most `MAX_STORED_FILE_BYTES`. Every refusal is thrown as a coded
 * Response, before any key is taken.
 */
export async function readAgentGlbUpload(
	request: Request
): Promise<AgentGlbUpload> {
	const declaredLength = Number(request.headers.get('Content-Length'))
	if (declaredLength > MAX_BODY_BYTES) throw tooLarge()

	const form = await readLimitedFormData(request).catch((error: unknown) => {
		if (error instanceof BodyTooLarge) throw tooLarge()
		return null
	})
	const file = form?.get('file')
	if (!form || !(file instanceof File)) {
		throw agentApiError(
			400,
			'invalid_request',
			'Send multipart/form-data with `file`, one GLB.'
		)
	}
	if (file.size > MAX_STORED_FILE_BYTES) throw tooLarge()

	const glb = new Uint8Array(await file.arrayBuffer())
	return {
		form,
		glb,
		split: splitOrRefuse(glb),
		fileSha256: createHash('sha256').update(glb).digest('hex')
	}
}

class BodyTooLarge extends Error {}

/**
 * The multipart body, read with a byte cap. `Content-Length` is optional (a
 * chunked upload has none), so the cap is counted on the stream itself rather
 * than trusted from the header.
 */
async function readLimitedFormData(request: Request): Promise<FormData> {
	if (!request.body) throw new TypeError('The request has no body.')
	let received = 0
	const limited = request.body.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				received += chunk.byteLength
				if (received > MAX_BODY_BYTES) controller.error(new BodyTooLarge())
				else controller.enqueue(chunk)
			}
		})
	)
	return new Response(limited, {
		headers: { 'Content-Type': request.headers.get('Content-Type') ?? '' }
	}).formData()
}

function splitOrRefuse(glb: Uint8Array): SplitGlb {
	try {
		return splitGlb(glb)
	} catch (error) {
		if (!(error instanceof GlbFormatError)) throw error
		throw agentApiError(400, 'invalid_request', error.message)
	}
}

function tooLarge(): Response {
	return agentApiError(
		413,
		'invalid_request',
		`The GLB is over the ${MAX_STORED_FILE_BYTES / 1024 / 1024} MB a scene file can take. Compress it first, for example with Draco and KTX2.`
	)
}
