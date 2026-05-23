import { parseOptions, readTextureIndex } from './contracts'
import { optimizeTextureBuffer } from './optimizer'

type WorkerRequest = {
	body: unknown
	rawBody?: unknown
	get(name: string): string | undefined
	is(type: string): boolean
}

type WorkerResponse = {
	status(code: number): WorkerResponse
	json(payload: unknown): WorkerResponse
	set(name: string, value: string): WorkerResponse
	send(payload: Buffer): WorkerResponse
}

function unauthorized(res: WorkerResponse): void {
	res.status(401).json({ error: 'Unauthorized worker invocation' })
}

function readRawBuffer(req: WorkerRequest): Buffer {
	const body = req.rawBody ?? req.body

	if (Buffer.isBuffer(body)) {
		return body
	}

	if (body instanceof Uint8Array) {
		return Buffer.from(body)
	}

	if (typeof body === 'string') {
		return Buffer.from(body)
	}

	return Buffer.from([])
}

export const optimizeTextures = async (
	req: WorkerRequest,
	res: WorkerResponse
) => {
	const expectedToken = process.env.OPTIMIZE_TEXTURES_WORKER_TOKEN || ''
	const receivedToken = (req.get('x-optimize-worker-token') || '').trim()

	if (expectedToken && expectedToken !== receivedToken) {
		unauthorized(res)
		return
	}

	if (!req.is('application/octet-stream')) {
		res.status(415).json({
			error:
				'Unsupported content type. optimize-textures worker requires application/octet-stream payloads.'
		})
		return
	}

	try {
		const textureIndex = readTextureIndex(
			req.get('x-texture-index') || undefined
		)
		const options = parseOptions(req.get('x-optimize-options') || '')
		const inputBuffer = readRawBuffer(req)

		if (!inputBuffer.byteLength) {
			res.status(400).json({ error: 'Texture payload is empty' })
			return
		}

		const result = await optimizeTextureBuffer({ inputBuffer, options })

		res.set('Content-Type', result.mimeType)
		res.set('Cache-Control', 'no-store')
		res.set('X-Texture-Index', String(textureIndex))
		res.status(200).send(result.buffer)
	} catch (error) {
		if (error instanceof Error) {
			if (
				error.message === 'Invalid or missing textureIndex' ||
				error instanceof SyntaxError
			) {
				res.status(400).json({ error: error.message })
				return
			}
		}

		console.error(
			'[optimize-textures-worker] Texture optimization failed:',
			error
		)
		const details = error instanceof Error ? error.message : 'Unknown error'
		res.status(500).json({
			error: 'Texture optimization failed',
			details
		})
	}
}
