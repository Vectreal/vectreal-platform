import { createHmac, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { spawn } from 'node:child_process'

type JobStatus =
	| 'queued'
	| 'starting'
	| 'processing'
	| 'succeeded'
	| 'failed'

interface GenerationJob {
	id: string
	status: JobStatus
	createdAt: number
	updatedAt: number
	inputPath: string
	artifactPath: string
	artifactName: string
	contentType: string
	progress: null | number
	errorMessage: null | string
}

const PORT = Number(process.env.PORT || '8080')
const ENVIRONMENT = process.env.ENVIRONMENT || process.env.NODE_ENV || 'unknown'
const JOB_ROOT = resolve(
	process.env.TRELLIS_RUNTIME_TMP_DIR || join(tmpdir(), 'vectreal-trellis-runtime')
)
const AUTH_SECRET = process.env.TRELLIS_RUNTIME_AUTH_SECRET?.trim() || ''
const GENERATOR_COMMAND = process.env.TRELLIS_GENERATOR_COMMAND?.trim() || ''
const MOCK_ARTIFACT_SOURCE = process.env.TRELLIS_MOCK_ARTIFACT_SOURCE?.trim() || ''
const MAX_CONCURRENT_JOBS = parsePositiveInt(
	process.env.TRELLIS_MAX_CONCURRENT_JOBS,
	1
)
const MAX_IMAGE_BYTES = parsePositiveInt(
	process.env.TRELLIS_MAX_IMAGE_BYTES,
	10 * 1024 * 1024
)
const JOB_TTL_MS = parsePositiveInt(
	process.env.TRELLIS_JOB_TTL_MS,
	6 * 60 * 60 * 1000
)
const ARTIFACT_TTL_MS = parsePositiveInt(
	process.env.TRELLIS_ARTIFACT_TTL_MS,
	2 * 60 * 60 * 1000
)
const STATUS_POLL_MS = parsePositiveInt(process.env.TRELLIS_STATUS_POLL_MS, 4000)

const jobs = new Map<string, GenerationJob>()
const queue: string[] = []
let activeJobs = 0

function parsePositiveInt(
	value: string | undefined,
	fallback: number
): number {
	const parsed = Number(value)
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function nowIso(): string {
	return new Date().toISOString()
}

function isAuthorized(request: IncomingMessage): boolean {
	const provided = request.headers['x-trellis-runtime-secret']
	const token = Array.isArray(provided) ? provided[0] : provided
	return Boolean(AUTH_SECRET) && token === AUTH_SECRET
}

function shellQuote(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`
}

function sendJson(
	response: ServerResponse,
	statusCode: number,
	payload: Record<string, unknown>
) {
	response.writeHead(statusCode, {
		'Content-Type': 'application/json',
		'Cache-Control': 'no-store'
	})
	response.end(JSON.stringify(payload))
}

async function ensureDir(path: string) {
	await fs.mkdir(path, { recursive: true })
}

async function readRequestBody(request: IncomingMessage): Promise<Buffer> {
	const chunks: Buffer[] = []
	let total = 0

	for await (const chunk of request) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
		total += buffer.length

		if (total > MAX_IMAGE_BYTES) {
			throw new Error('Payload exceeds runtime image size limit')
		}

		chunks.push(buffer)
	}

	return Buffer.concat(chunks)
}

async function copyArtifact(sourcePath: string, outputPath: string) {
	await ensureDir(dirname(outputPath))
	await fs.copyFile(sourcePath, outputPath)
}

async function executeGenerator(job: GenerationJob) {
	if (MOCK_ARTIFACT_SOURCE) {
		await copyArtifact(MOCK_ARTIFACT_SOURCE, job.artifactPath)
		return
	}

	if (!GENERATOR_COMMAND) {
		throw new Error('Runtime generator is not configured')
	}

	const command = GENERATOR_COMMAND.replaceAll(
		'{input}',
		shellQuote(job.inputPath)
	).replaceAll('{output}', shellQuote(job.artifactPath))

	await new Promise<void>((resolvePromise, rejectPromise) => {
		const child = spawn('/bin/sh', ['-lc', command], {
			stdio: ['ignore', 'pipe', 'pipe'],
			env: process.env
		})

		let stderr = ''

		child.stdout.on('data', () => {
			job.status = 'processing'
			job.progress = 70
			job.updatedAt = Date.now()
		})

		child.stderr.on('data', (chunk) => {
			stderr += chunk.toString()
		})

		child.on('error', rejectPromise)
		child.on('close', (code) => {
			if (code === 0) {
				resolvePromise()
				return
			}

			rejectPromise(
				new Error(stderr.trim() || `Generator exited with code ${code ?? 'unknown'}`)
			)
		})
	})
}

async function processJob(jobId: string) {
	const job = jobs.get(jobId)
	if (!job) {
		return
	}

	activeJobs += 1
	job.status = 'starting'
	job.progress = 15
	job.updatedAt = Date.now()

	try {
		await executeGenerator(job)

		if (!existsSync(job.artifactPath)) {
			throw new Error('Generation completed without producing an artifact')
		}

		job.status = 'succeeded'
		job.progress = 100
		job.updatedAt = Date.now()
	} catch (error) {
		job.status = 'failed'
		job.errorMessage =
			error instanceof Error ? error.message : 'Unknown generation failure'
		job.progress = null
		job.updatedAt = Date.now()
	} finally {
		activeJobs = Math.max(0, activeJobs - 1)
		runNextJob()
	}
}

function runNextJob() {
	while (activeJobs < MAX_CONCURRENT_JOBS && queue.length > 0) {
		const nextJobId = queue.shift()
		if (!nextJobId) {
			return
		}

		void processJob(nextJobId)
	}
}

async function handleSubmit(
	request: IncomingMessage,
	response: ServerResponse
): Promise<void> {
	if (!isAuthorized(request)) {
		sendJson(response, 401, {
			success: false,
			error: 'Unauthorized runtime request'
		})
		return
	}

	const contentType = request.headers['content-type']
	const normalizedContentType = Array.isArray(contentType)
		? contentType[0]
		: contentType

	if (
		!normalizedContentType ||
		!/^image\/(png|jpeg|jpg|webp)$/i.test(normalizedContentType)
	) {
		sendJson(response, 400, {
			success: false,
			error: 'Only PNG, JPEG, and WebP image inputs are supported'
		})
		return
	}

	try {
		const body = await readRequestBody(request)
		const jobId = randomUUID()
		const jobDir = join(JOB_ROOT, jobId)
		const extension = extname(
			String(request.headers['x-trellis-filename'] || '').trim()
		)
		const inputPath = join(jobDir, `input${extension || '.png'}`)
		const artifactPath = join(jobDir, 'output.glb')

		await ensureDir(jobDir)
		await fs.writeFile(inputPath, body)

		const job: GenerationJob = {
			id: jobId,
			status: 'queued',
			createdAt: Date.now(),
			updatedAt: Date.now(),
			inputPath,
			artifactPath,
			artifactName: 'output.glb',
			contentType: 'model/gltf-binary',
			progress: 0,
			errorMessage: null
		}

		jobs.set(jobId, job)
		queue.push(jobId)
		runNextJob()

		sendJson(response, 202, {
			success: true,
			data: {
				jobId,
				status: job.status,
				pollAfterMs: STATUS_POLL_MS
			}
		})
	} catch (error) {
		sendJson(response, 413, {
			success: false,
			error: error instanceof Error ? error.message : 'Failed to accept job'
		})
	}
}

function handleStatus(
	request: IncomingMessage,
	response: ServerResponse,
	jobId: string
) {
	if (!isAuthorized(request)) {
		sendJson(response, 401, {
			success: false,
			error: 'Unauthorized runtime request'
		})
		return
	}

	const job = jobs.get(jobId)
	if (!job) {
		sendJson(response, 404, {
			success: false,
			error: 'Generation job not found'
		})
		return
	}

	sendJson(response, 200, {
		success: true,
		data: {
			jobId: job.id,
			status: job.status,
			progress: job.progress,
			message:
				job.status === 'queued'
					? 'Waiting for a runtime worker to pick up the job.'
					: job.status === 'starting'
						? 'Starting the Trellis runtime worker.'
						: job.status === 'processing'
							? 'Generating a 3D model from the uploaded image.'
							: job.status === 'succeeded'
								? 'Generation completed successfully.'
								: job.errorMessage,
			artifactReady: job.status === 'succeeded',
			pollAfterMs: STATUS_POLL_MS,
			retryable: job.status === 'failed'
		}
	})
}

async function handleArtifact(
	request: IncomingMessage,
	response: ServerResponse,
	jobId: string
) {
	if (!isAuthorized(request)) {
		sendJson(response, 401, {
			success: false,
			error: 'Unauthorized runtime request'
		})
		return
	}

	const job = jobs.get(jobId)
	if (!job) {
		sendJson(response, 404, {
			success: false,
			error: 'Generation job not found'
		})
		return
	}

	if (job.status !== 'succeeded' || !existsSync(job.artifactPath)) {
		sendJson(response, 409, {
			success: false,
			error: 'Artifact is not ready yet'
		})
		return
	}

	response.writeHead(200, {
		'Content-Type': job.contentType,
		'Cache-Control': 'no-store',
		'Content-Disposition': `attachment; filename="${job.artifactName}"`
	})

	await pipeline(createReadStream(job.artifactPath), response)
}

async function sweepExpiredJobs() {
	const now = Date.now()

	for (const [jobId, job] of jobs.entries()) {
		const ttl =
			job.status === 'succeeded' ? ARTIFACT_TTL_MS : JOB_TTL_MS
		if (now - job.updatedAt < ttl) {
			continue
		}

		jobs.delete(jobId)
		const queueIndex = queue.indexOf(jobId)
		if (queueIndex >= 0) {
			queue.splice(queueIndex, 1)
		}
		await fs.rm(dirname(job.inputPath), { recursive: true, force: true })
	}
}

function createSignature(value: string): string {
	return createHmac('sha256', AUTH_SECRET || 'dev-only-secret')
		.update(value)
		.digest('hex')
}

const server = createServer(async (request, response) => {
	const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
	const pathname = url.pathname

	if (request.method === 'GET' && pathname === '/health') {
		sendJson(response, 200, {
			success: true,
			data: {
				status: AUTH_SECRET ? 'healthy' : 'degraded',
				environment: ENVIRONMENT,
				timestamp: nowIso(),
				configured: Boolean(AUTH_SECRET),
				queueDepth: queue.length,
				activeJobs,
				runtimeSignature: createSignature('health').slice(0, 12)
			}
		})
		return
	}

	if (request.method === 'POST' && pathname === '/generations') {
		await handleSubmit(request, response)
		return
	}

	const statusMatch = pathname.match(/^\/generations\/([^/]+)$/)
	if (request.method === 'GET' && statusMatch) {
		handleStatus(request, response, statusMatch[1] as string)
		return
	}

	const artifactMatch = pathname.match(/^\/generations\/([^/]+)\/artifact$/)
	if (request.method === 'GET' && artifactMatch) {
		await handleArtifact(request, response, artifactMatch[1] as string)
		return
	}

	sendJson(response, 404, {
		success: false,
		error: 'Not found'
	})
})

void ensureDir(JOB_ROOT)
setInterval(() => {
	void sweepExpiredJobs()
}, 10 * 60 * 1000).unref()

server.listen(PORT, () => {
	console.info(
		`[trellis-runtime] listening on :${PORT} (${ENVIRONMENT}) jobRoot=${JOB_ROOT}`
	)
})
