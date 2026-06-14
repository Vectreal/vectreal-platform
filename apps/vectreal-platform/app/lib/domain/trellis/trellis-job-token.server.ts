import { createHmac, timingSafeEqual } from 'node:crypto'

interface TrellisJobTokenPayload {
	jobId: string
	userId: string
	expiresAt: number
}

function getJobTokenSecret(): string {
	const secret =
		process.env.TRELLIS_JOB_TOKEN_SECRET?.trim() ||
		process.env.CSRF_SECRET ||
		process.env.SESSION_SECRET

	if (!secret && process.env.NODE_ENV === 'production') {
		throw new Error('TRELLIS_JOB_TOKEN_SECRET is required in production')
	}

	return secret || 'dev-only-trellis-job-token-secret'
}

function encodeBase64Url(value: string): string {
	return Buffer.from(value, 'utf8').toString('base64url')
}

function decodeBase64Url(value: string): string {
	return Buffer.from(value, 'base64url').toString('utf8')
}

function createSignature(payload: string): string {
	return createHmac('sha256', getJobTokenSecret())
		.update(payload)
		.digest('base64url')
}

export function createTrellisJobToken(payload: TrellisJobTokenPayload): string {
	const serialized = encodeBase64Url(JSON.stringify(payload))
	const signature = createSignature(serialized)

	return `${serialized}.${signature}`
}

export function verifyTrellisJobToken(token: string): TrellisJobTokenPayload {
	const [serialized, signature] = token.split('.')
	if (!serialized || !signature) {
		throw new Error('Invalid generation token')
	}

	const expectedSignature = createSignature(serialized)
	const providedBuffer = Buffer.from(signature)
	const expectedBuffer = Buffer.from(expectedSignature)

	if (
		providedBuffer.length !== expectedBuffer.length ||
		!timingSafeEqual(providedBuffer, expectedBuffer)
	) {
		throw new Error('Invalid generation token')
	}

	const parsed = JSON.parse(decodeBase64Url(serialized)) as Partial<TrellisJobTokenPayload>
	if (
		typeof parsed.jobId !== 'string' ||
		typeof parsed.userId !== 'string' ||
		typeof parsed.expiresAt !== 'number'
	) {
		throw new Error('Invalid generation token')
	}

	if (parsed.expiresAt <= Date.now()) {
		throw new Error('Generation token has expired')
	}

	return parsed as TrellisJobTokenPayload
}

