import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import {
	mkdir,
	readdir,
	readFile,
	rename,
	stat,
	writeFile
} from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import sharp from 'sharp'

import { normalizeInBrowser } from './normalize-in-browser'
import {
	formatTimingLog,
	objectNumber,
	parseTimingLog,
	upsertRow
} from './timing-log'
import { DEFAULT_IMG_TO_3D_PARAMS } from '../app/lib/domain/img-to-3d/img-to-3d-contract'
import { ImgTo3dRuntimeError } from '../app/lib/domain/img-to-3d/img-to-3d-handlers'
import { liveImgTo3dRuntime } from '../app/lib/domain/img-to-3d/img-to-3d-runtime-client.server'
import { prepareIntakePhotos } from '../app/lib/domain/model-intake/model-intake-photos.server'
import { MODEL_INTAKE_PHOTO_COUNT } from '../app/lib/domain/model-intake/model-intake-shared'

const PHOTO_EXTENSIONS = new Set([
	'.jpg',
	'.jpeg',
	'.heic',
	'.heif',
	'.png',
	'.webp'
])
/** A photo still being copied in is left for the next pass. */
const SETTLED_MS = 10_000
const GENERATION_TIMEOUT_MS = 60 * 60 * 1000
const RETRY_MS = 30_000
/**
 * The runtime refuses images over 10 MB and generates at 1024 px, so photos
 * are sent at this long edge: a 48 MP phone photo would otherwise be refused.
 */
const MAX_PHOTO_EDGE = 2048
const PERMANENT_REFUSALS = new Set([413, 415, 422])
const SEED = 1
const PROJECT_NAME = 'Timing run'

export interface TimingPaths {
	root: string
	photos: string
	runs: string
	log: string
}

export function timingPaths(root: string): TimingPaths {
	return {
		root,
		photos: path.join(root, 'photos'),
		runs: path.join(root, 'runs'),
		log: path.join(root, 'timing-log.csv')
	}
}

interface Candidate {
	photo: string
	jobId: string
	submittedAt: number
	/** The runtime confirmed it has the job. */
	sent?: boolean
	processingAt?: number
	finishedAt?: number
	raw?: string
	rawBytes?: number
	error?: string
	normalized?: string
	normalizedBytes?: number
	normalizeMs?: number
	fits?: boolean
}

interface RunState {
	photosMs?: number
	photos?: string[]
	candidates?: Candidate[]
	scene?: { id: string; projectId: string; url: string; ms: number }
	/** The row is in timing-log.csv; nothing is left to do. */
	logged?: boolean
}

const megabytes = (bytes: number) => (bytes / 1_000_000).toFixed(1)
const minutes = (ms: number) => (ms / 60_000).toFixed(1)

function log(object: string, message: string) {
	console.log(`${new Date().toISOString()}  ${object}  ${message}`)
}

/** Folders holding exactly the expected photos, none of them still arriving. */
async function completeObjects(photosDir: string): Promise<string[]> {
	if (!existsSync(photosDir)) return []
	const folders = (await readdir(photosDir, { withFileTypes: true }))
		.filter((entry) => entry.isDirectory() && /^\d{2}-/.test(entry.name))
		.map((entry) => entry.name)
		.sort()

	const complete: string[] = []
	for (const folder of folders) {
		const photos = await photoFiles(path.join(photosDir, folder))
		if (photos.length !== MODEL_INTAKE_PHOTO_COUNT) continue
		const times = await Promise.all(
			photos.map(async (file) => (await stat(file)).mtimeMs)
		)
		if (times.every((time) => Date.now() - time > SETTLED_MS)) {
			complete.push(folder)
		}
	}
	return complete
}

async function photoFiles(dir: string): Promise<string[]> {
	return (await readdir(dir))
		.filter((name) => PHOTO_EXTENSIONS.has(path.extname(name).toLowerCase()))
		.sort()
		.map((name) => path.join(dir, name))
}

async function readLongestEdgeCm(dir: string): Promise<number | undefined> {
	const file = path.join(dir, 'longest-edge-cm.txt')
	if (!existsSync(file)) return undefined
	const value = Number.parseFloat(await readFile(file, 'utf8'))
	if (!(Number.isFinite(value) && value > 0)) {
		throw new Error(`${file} must hold one positive number of centimeters.`)
	}
	return value
}

/** The CLI's MCP server, signed in with the session `vectreal login` stored. */
class Publisher {
	private client?: Client
	private projectId?: string

	constructor(
		private readonly origin: string,
		private readonly requestedProject?: string
	) {}

	private async call<T>(name: string, args: Record<string, unknown>) {
		if (!this.client) {
			this.client = new Client({ name: 'timing-run', version: '1.0.0' })
			await this.client.connect(
				new StdioClientTransport({
					command: 'pnpm',
					args: ['-s', 'vectreal', 'mcp'],
					cwd: process.env.NX_WORKSPACE_ROOT ?? path.resolve('../..'),
					env: {
						...(process.env as Record<string, string>),
						VECTREAL_ORIGIN: this.origin
					},
					stderr: 'inherit'
				})
			)
		}
		const result = await this.client.callTool({ name, arguments: args })
		const [first] = result.content as { type: string; text?: string }[]
		if (result.isError) throw new Error(`${name}: ${first?.text}`)
		return JSON.parse(first?.text ?? 'null') as T
	}

	private async project(): Promise<string> {
		if (this.projectId) return this.projectId
		if (this.requestedProject) return (this.projectId = this.requestedProject)
		const { projects } = await this.call<{
			projects: { id: string; name: string }[]
		}>('list_projects', {})
		const existing = projects.find((project) => project.name === PROJECT_NAME)
		if (existing) return (this.projectId = existing.id)
		try {
			const { project } = await this.call<{ project: { id: string } }>(
				'create_project',
				{ name: PROJECT_NAME }
			)
			return (this.projectId = project.id)
		} catch (error) {
			// The Free plan allows one project; the scenes then go into it.
			const [fallback] = projects
			if (!fallback) throw error
			console.log(
				`Could not create "${PROJECT_NAME}" (${error instanceof Error ? error.message : error}); using "${fallback.name}".`
			)
			return (this.projectId = fallback.id)
		}
	}

	async createScene(file: string, name: string) {
		const projectId = await this.project()
		const { scene } = await this.call<{
			scene: { id: string; projectId: string }
		}>('create_scene_from_file', { path: file, name, projectId })
		return {
			id: scene.id,
			projectId: scene.projectId,
			url: new URL(`/publisher/${scene.id}`, this.origin).toString()
		}
	}

	async close() {
		await this.client?.close()
	}
}

export interface TimingRunOptions {
	paths: TimingPaths
	origin: string
	project?: string
}

/** One pass over the inbox. Every finished stage is kept, so a rerun resumes. */
export async function runTimingPass({
	paths,
	origin,
	project
}: TimingRunOptions) {
	const objects = await completeObjects(paths.photos)
	const publisher = new Publisher(origin, project)
	try {
		for (const object of objects) {
			try {
				await runObject(object, paths, publisher)
			} catch (error) {
				process.exitCode = 1
				log(
					object,
					`stopped: ${error instanceof Error ? error.message : error}`
				)
			}
		}
	} finally {
		await publisher.close()
	}
}

async function runObject(
	object: string,
	paths: TimingPaths,
	publisher: Publisher
) {
	const dir = path.join(paths.runs, object)
	const statePath = path.join(dir, 'run.json')
	const state: RunState = existsSync(statePath)
		? JSON.parse(await readFile(statePath, 'utf8'))
		: {}
	if (state.logged) return

	await mkdir(dir, { recursive: true })
	// One write at a time, each replacing the file whole, so concurrent polls
	// can never leave a torn run.json behind.
	let saving = Promise.resolve()
	const save = () =>
		(saving = saving.then(async () => {
			await writeFile(
				`${statePath}.tmp`,
				`${JSON.stringify(state, null, '\t')}\n`
			)
			await rename(`${statePath}.tmp`, statePath)
		}))

	if (!state.photos) {
		const started = Date.now()
		const sources = await photoFiles(path.join(paths.photos, object))
		const prepared = await prepareIntakePhotos(
			await Promise.all(
				sources.map(
					async (file) => new File([await readFile(file)], path.basename(file))
				)
			)
		)
		if (!prepared.ok) {
			throw new Error(
				`photos refused (${JSON.stringify(prepared.fieldErrors)}): JPEG, HEIC, PNG or WebP, at most 50 megapixels each`
			)
		}
		state.photos = []
		for (const [index, photo] of prepared.photos.entries()) {
			const file = path.join(dir, `photo-${index + 1}.${photo.extension}`)
			await writeFile(
				file,
				await sharp(photo.bytes)
					.resize(MAX_PHOTO_EDGE, MAX_PHOTO_EDGE, {
						fit: 'inside',
						withoutEnlargement: true
					})
					.toFormat(photo.extension === 'jpg' ? 'jpeg' : photo.extension)
					.toBuffer()
			)
			state.photos.push(file)
		}
		state.photosMs = Date.now() - started
		await save()
		log(object, `photos prepared in ${state.photosMs} ms`)
	}

	state.candidates ??= []
	for (const photo of state.photos) {
		if (state.candidates.some((candidate) => candidate.photo === photo)) {
			continue
		}
		state.candidates.push({
			photo,
			jobId: randomUUID(),
			submittedAt: Date.now()
		})
	}
	// Recorded before anything is sent, so a crash mid-submit asks the runtime
	// about this job rather than paying for a second one.
	await save()
	for (const candidate of state.candidates) {
		await ensureSubmitted(object, candidate, save).catch((error) =>
			log(object, `submit of ${candidate.jobId} refused (${error}); retrying`)
		)
	}

	await Promise.all(
		state.candidates.map((candidate, index) =>
			generate(object, dir, candidate, index + 1, save)
		)
	)

	const waiting = state.candidates.filter(
		(candidate) => !candidate.raw && !candidate.error
	).length
	if (waiting > 0) {
		throw new Error(
			`${waiting} photos not generated yet; the next run continues`
		)
	}
	const generated = state.candidates.filter((candidate) => candidate.raw)
	if (generated.length === 0) {
		throw new Error(
			`every generation failed; delete ${dir} to submit the photos again`
		)
	}

	const longestEdgeCm = await readLongestEdgeCm(path.join(paths.photos, object))
	for (const candidate of generated) {
		if (candidate.normalized) continue
		const started = Date.now()
		const { glb, report } = await normalizeInBrowser({
			input: candidate.raw!,
			out: path.join(dir, 'normalized'),
			longestEdgeCm
		})
		candidate.normalized = glb
		candidate.normalizedBytes = (await stat(glb)).size
		candidate.normalizeMs = Date.now() - started
		candidate.fits = report.fits
		await save()
		log(
			object,
			`normalized ${path.basename(glb)}: ${megabytes(candidate.rawBytes!)} MB -> ${megabytes(candidate.normalizedBytes)} MB in ${minutes(candidate.normalizeMs)} min${report.fits ? '' : ', over the 15 MB budget'}`
		)
	}

	// The first photo's model goes to the Publisher; the others wait beside it.
	const [chosen] = generated
	if (!state.scene) {
		const started = Date.now()
		const scene = await publisher.createScene(chosen.normalized!, object)
		state.scene = { ...scene, ms: Date.now() - started }
		await save()
		log(object, `scene ${scene.url} in ${state.scene.ms} ms`)
	}

	// The chosen model's own wait, from its submit to its file.
	const generationMs = chosen.finishedAt! - chosen.submittedAt
	const rows = existsSync(paths.log)
		? parseTimingLog(await readFile(paths.log, 'utf8'))
		: []
	await writeFile(
		paths.log,
		formatTimingLog(
			upsertRow(rows, objectNumber(object), {
				object,
				generation_minutes: minutes(generationMs),
				raw_mb: megabytes(chosen.rawBytes!),
				normalized_mb: megabytes(chosen.normalizedBytes!),
				scene_url: state.scene.url
			})
		)
	)
	state.logged = true
	await save()
}

function imageFile(photo: string, bytes: Buffer<ArrayBuffer>): File {
	const extension = path.extname(photo)
	const type =
		extension === '.png'
			? 'image/png'
			: extension === '.webp'
				? 'image/webp'
				: 'image/jpeg'
	return new File([bytes], path.basename(photo), { type })
}

/** The runtime has never heard of the job: it was not received. */
function isUnknownJob(error: unknown): boolean {
	return (
		error instanceof ImgTo3dRuntimeError &&
		error.kind === 'runtime_rejected' &&
		error.status === 404
	)
}

/**
 * Sends a candidate's photo unless the runtime already has its job. A refused
 * submit throws, leaving the candidate unsent, so the next run tries again;
 * one sent but unanswered stays unsent and is settled by polling.
 */
async function ensureSubmitted(
	object: string,
	candidate: Candidate,
	save: () => Promise<void>
) {
	if (candidate.sent || candidate.raw || candidate.error) return
	try {
		await liveImgTo3dRuntime.status(candidate.jobId)
		candidate.sent = true
		await save()
		return
	} catch (error) {
		if (!isUnknownJob(error)) throw error
	}

	try {
		await liveImgTo3dRuntime.submit({
			jobId: candidate.jobId,
			seed: SEED,
			resolution: DEFAULT_IMG_TO_3D_PARAMS.resolution,
			textureSize: DEFAULT_IMG_TO_3D_PARAMS.textureSize,
			decimationTarget: DEFAULT_IMG_TO_3D_PARAMS.decimationTarget,
			image: imageFile(candidate.photo, await readFile(candidate.photo))
		})
	} catch (error) {
		if (error instanceof ImgTo3dRuntimeError && error.outcomeUnknown) {
			candidate.submittedAt = Date.now()
			await save()
			log(object, `submit of ${candidate.jobId} unanswered; polling it`)
			return
		}
		// Refused for the photo itself (too large, wrong type, empty): sending
		// it again cannot help, so this candidate drops out and the rest go on.
		if (
			error instanceof ImgTo3dRuntimeError &&
			PERMANENT_REFUSALS.has(error.status)
		) {
			candidate.error = `submit refused: ${error.message}`
			await save()
			log(object, candidate.error)
			return
		}
		throw error
	}
	candidate.submittedAt = Date.now()
	candidate.sent = true
	await save()
	log(
		object,
		`submitted ${path.basename(candidate.photo)} as job ${candidate.jobId}`
	)
}

async function generate(
	object: string,
	dir: string,
	candidate: Candidate,
	index: number,
	save: () => Promise<void>
) {
	if (candidate.raw || candidate.error) return
	const started = Date.now()
	const fail = async (reason: string) => {
		candidate.error = reason
		await save()
		log(object, `candidate ${index} failed: ${reason}`)
	}
	for (;;) {
		let pollAfterMs = RETRY_MS
		try {
			const status = await liveImgTo3dRuntime.status(candidate.jobId)
			if (status.status === 'processing' && !candidate.processingAt) {
				candidate.processingAt = Date.now()
				await save()
			}
			if (status.status === 'failed') {
				return await fail(status.message ?? 'failed')
			}
			if (status.artifactReady) {
				const response = await liveImgTo3dRuntime.artifact(candidate.jobId)
				const bytes = Buffer.from(await response.arrayBuffer())
				candidate.raw = path.join(dir, `${object}-${index}.glb`)
				await writeFile(candidate.raw, bytes)
				candidate.rawBytes = bytes.byteLength
				candidate.finishedAt = Date.now()
				await save()
				log(
					object,
					`candidate ${index}: ${megabytes(bytes.byteLength)} MB raw, ` +
						`queued ${minutes((candidate.processingAt ?? candidate.finishedAt) - candidate.submittedAt)} min, ` +
						`generated ${minutes(candidate.finishedAt - (candidate.processingAt ?? candidate.submittedAt))} min`
				)
				return
			}
			pollAfterMs = Math.max(status.pollAfterMs, 3_000)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			if (isUnknownJob(error)) {
				// Sent and confirmed, then forgotten: the runtime lost it.
				if (candidate.sent) return await fail(message)
				// An unanswered submit that never arrived: send it now.
				await ensureSubmitted(object, candidate, save).catch((cause) =>
					log(object, `candidate ${index}: ${cause}; retrying`)
				)
			} else {
				// The edge's 401, 429 and 5xx say nothing about the job itself.
				log(object, `candidate ${index}: ${message}; retrying`)
			}
		}
		// Checked after a poll, so a run resumed late still collects a result
		// that finished while it was stopped.
		if (Date.now() - started >= GENERATION_TIMEOUT_MS) {
			// Never accepted: nothing ran, so the next run sends it again.
			if (!candidate.sent) {
				log(object, `candidate ${index} not accepted; the next run retries`)
				return
			}
			return await fail(
				`no result within ${minutes(GENERATION_TIMEOUT_MS)} min`
			)
		}
		await sleep(pollAfterMs)
	}
}
