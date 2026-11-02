import { Document, WebIO } from '@gltf-transform/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
	PublishExportMessage,
	PublishExportRequest,
	StudioFinishPlanRequest
} from './publish-export.worker.types'

/**
 * What the worker does with a request: the core functions it runs are pinned
 * in `@vctrl/core`; this covers how the request reaches them and how their
 * results reach the main thread.
 */
const mocks = vi.hoisted(() => ({
	exportGlbForPublish: vi.fn(),
	readGlbDocument: vi.fn(),
	/** Stands in for the KTX2 pass, handed what the worker passed as `ktx2`. */
	compressTextures: vi.fn(),
	createEncoderPool: vi.fn(),
	poolEncode: vi.fn(),
	disposePool: vi.fn(),
	bakeOcclusionIntoDocument: vi.fn(),
	bakeLightsIntoDocument: vi.fn(),
	writeBakeUvs: vi.fn(),
	createRenderer: vi.fn(),
	disposeRenderer: vi.fn(),
	forceContextLoss: vi.fn()
}))

/** The options the worker bakes with, as core's defaults stand in the mock. */
const OCCLUSION_OPTIONS = { resolution: 512, samples: 256, distance: 0.25 }
const LIGHT_OPTIONS = { resolution: 512, samples: 128 }

/** A renderer the mock made, whose context a test can lose. */
interface FakeRenderer {
	lost: boolean
}

vi.mock('@vctrl/core/model-exporter', () => ({
	ModelExporter: class {
		exportGlbForPublish = mocks.exportGlbForPublish
		readGlbDocument = mocks.readGlbDocument
	}
}))
// The real recovery and planners, so these cover how the worker relies on them.
vi.mock('@vctrl/core/occlusion-bake', async () => {
	const core = await vi.importActual<
		typeof import('../../../../packages/core/src/occlusion-bake')
	>('../../../../packages/core/src/occlusion-bake')
	return {
		bakeOcclusionIntoDocument: mocks.bakeOcclusionIntoDocument,
		bakeWithRecovery: core.bakeWithRecovery,
		bakeReport: core.bakeReport,
		planOcclusionBake: core.planOcclusionBake,
		planBakeUvs: core.planBakeUvs,
		withoutBakeUvs: core.withoutBakeUvs,
		writeBakeUvs: mocks.writeBakeUvs,
		DEFAULT_OCCLUSION_BAKE_OPTIONS: OCCLUSION_OPTIONS
	}
})
vi.mock('@vctrl/core/light-bake', async () => {
	const core = await vi.importActual<
		typeof import('../../../../packages/core/src/light-bake/bake-into-document')
	>('../../../../packages/core/src/light-bake/bake-into-document')
	return {
		bakeLightsIntoDocument: mocks.bakeLightsIntoDocument,
		planLightBake: core.planLightBake,
		planBakeUvsFor: core.planBakeUvsFor,
		DEFAULT_LIGHT_BAKE_OPTIONS: LIGHT_OPTIONS
	}
})
vi.mock('three', () => ({
	WebGLRenderer: class implements FakeRenderer {
		lost = false
		constructor() {
			mocks.createRenderer(this)
		}
		dispose = mocks.disposeRenderer
		forceContextLoss = mocks.forceContextLoss
		getContext = () => ({ isContextLost: () => this.lost })
	}
}))
vi.mock('./ktx2-encoder-pool', () => ({
	createKtx2EncoderPool: (createWorker: () => Worker) => {
		mocks.createEncoderPool(createWorker)
		return { encode: mocks.poolEncode, dispose: mocks.disposePool }
	},
	ktx2EncodeWorkerCount: () => 3
}))

const posted: Array<{ message: PublishExportMessage; transfer: unknown }> = []
const report = { encoded: ['color'], kept: [] }
const occlusionReport = {
	baked: ['body'],
	skipped: [{ material: 'glass', reason: 'no-uv0' }]
}
const lightsReport = { baked: ['body'], skipped: [] }
const lighting = {
	environment: {
		map: 'nature-park',
		resolution: '1k',
		intensity: 1,
		rotation: 0
	},
	lights: [
		{
			role: 'key',
			enabled: true,
			azimuth: 45,
			elevation: 45,
			size: 20,
			intensity: 1,
			color: '#ffffff'
		}
	]
} satisfies PublishExportRequest['lights']
/** What the export hands its `bake` hook. */
const exportedDocument = new Document()

async function send({
	occlusion = false,
	lights = false,
	...request
}: Omit<PublishExportRequest, 'type' | 'buffer' | 'occlusion' | 'lights'> &
	Partial<Pick<PublishExportRequest, 'occlusion' | 'lights'>>) {
	const buffer = (await new WebIO().writeBinary(new Document())).slice()
		.buffer as ArrayBuffer
	await (
		self.onmessage as (event: MessageEvent<PublishExportRequest>) => unknown
	)({
		data: { type: 'export', buffer, occlusion, lights, ...request }
	} as MessageEvent)
	return posted.map(({ message }) => message)
}

beforeEach(async () => {
	posted.length = 0
	vi.clearAllMocks()
	vi.stubGlobal('self', globalThis)
	vi.stubGlobal(
		'postMessage',
		(message: PublishExportMessage, options: { transfer: unknown }) =>
			posted.push({ message, transfer: options.transfer })
	)
	mocks.compressTextures.mockImplementation(async ({ onProgress }) => {
		onProgress(0, 1)
		return report
	})
	// Asks for its renderer, as the real bake does when it has a material.
	mocks.bakeOcclusionIntoDocument.mockImplementation(
		async (_document: Document, renderer: () => unknown) => {
			renderer()
			return occlusionReport
		}
	)
	vi.stubGlobal('OffscreenCanvas', class {})
	mocks.exportGlbForPublish.mockImplementation(
		async (
			_glb: Uint8Array,
			options: {
				ktx2?: unknown
				bake?: (document: Document) => Promise<void>
			}
		) => {
			await options.bake?.(exportedDocument)
			return {
				data: new Uint8Array([1, 2, 3]),
				geometryCodec: 'meshopt',
				geometrySizes: { none: 3, meshopt: 2 },
				textureBytes: 7,
				textures: options.ktx2
					? await mocks.compressTextures(options.ktx2)
					: undefined
			}
		}
	)
	vi.resetModules()
	await import('./publish-export.worker')
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('the publish export worker', () => {
	it('passes the geometry settings through and encodes textures when asked', async () => {
		const messages = await send({
			draco: { method: 'edgebreaker' },
			dracoWorthApplying: false,
			ktx2: true
		})

		expect(mocks.exportGlbForPublish).toHaveBeenCalledWith(
			expect.any(Uint8Array),
			expect.objectContaining({
				draco: { method: 'edgebreaker' },
				dracoWorthApplying: false
			})
		)
		expect(mocks.compressTextures).toHaveBeenCalledOnce()
		expect(messages).toContainEqual({
			type: 'progress',
			stage: 'textures',
			texturesDone: 0,
			texturesTotal: 1
		})

		const done = messages.at(-1)
		expect(done).toMatchObject({
			type: 'done',
			geometryCodec: 'meshopt',
			geometrySizes: { none: 3, meshopt: 2 },
			textureBytes: 7,
			textures: report
		})
		const { buffer } = done as { buffer: ArrayBuffer }
		expect(Array.from(new Uint8Array(buffer))).toEqual([1, 2, 3])
		expect(posted.at(-1)?.transfer).toEqual([buffer])
	})

	it('leaves textures alone when KTX2 is off', async () => {
		const messages = await send({ dracoWorthApplying: true, ktx2: false })

		expect(mocks.compressTextures).not.toHaveBeenCalled()
		expect(messages.at(-1)).toMatchObject({ type: 'done', textures: undefined })
	})

	it('bakes occlusion into the published copy when asked, and reports it', async () => {
		const messages = await send({
			dracoWorthApplying: true,
			ktx2: false,
			occlusion: true
		})

		expect(mocks.bakeOcclusionIntoDocument).toHaveBeenCalledWith(
			exportedDocument,
			expect.any(Function),
			OCCLUSION_OPTIONS,
			expect.any(Function),
			// Every material bakes on its own UVs, so there is no layout.
			undefined
		)
		expect(mocks.disposeRenderer).toHaveBeenCalledOnce()
		expect(mocks.forceContextLoss).toHaveBeenCalledOnce()
		expect(messages.at(-1)).toMatchObject({
			type: 'done',
			occlusion: occlusionReport
		})
	})

	describe('with a material whose own UVs a bake cannot use', () => {
		/** Exports `document` instead, so its bake hook sees that model. */
		const exporting = (document: Document) =>
			mocks.exportGlbForPublish.mockImplementationOnce(
				async (
					_glb: Uint8Array,
					options: { bake?: (document: Document) => Promise<void> }
				) => {
					await options.bake?.(document)
					return { data: new Uint8Array([1]), geometryCodec: 'none' }
				}
			)
		const layoutOf = (call: unknown[] | undefined) =>
			call?.at(-1) as
				| { texCoord: number; materials: Map<{ getName(): string }, unknown> }
				| undefined

		it('lays out a UV set once, says so first, and bakes both in it', async () => {
			exporting(quadDocument({ uvs: false }))
			mocks.bakeLightsIntoDocument.mockResolvedValue(lightsReport)

			const messages = await send({
				dracoWorthApplying: true,
				ktx2: false,
				occlusion: true,
				lights: lighting
			})

			expect(mocks.writeBakeUvs).toHaveBeenCalledOnce()
			const [planned] = mocks.writeBakeUvs.mock.calls[0]
			expect(planned.texCoord).toBe(1)
			expect(planned.primitives).toHaveLength(1)
			expect(messages.slice(0, 2)).toEqual([
				{ type: 'progress', stage: 'uvs' },
				// The layout is done: the limit on it stops here.
				{ type: 'progress', stage: 'occlusion', fraction: 0 }
			])
			const occlusionLayout = layoutOf(
				mocks.bakeOcclusionIntoDocument.mock.calls[0]
			)
			expect(occlusionLayout).toBe(planned)
			expect(layoutOf(mocks.bakeLightsIntoDocument.mock.calls[0])).toBe(planned)
		})

		it('lays out nothing when told not to, and reports its materials as too detailed', async () => {
			exporting(quadDocument({ uvs: false }))

			const messages = await send({
				dracoWorthApplying: true,
				ktx2: false,
				occlusion: true,
				generateUvs: false
			})

			expect(mocks.writeBakeUvs).not.toHaveBeenCalled()
			expect(messages).not.toContainEqual({ type: 'progress', stage: 'uvs' })
			const layout = layoutOf(mocks.bakeOcclusionIntoDocument.mock.calls[0])
			expect(
				[...layout!.materials].map(([material, reason]) => [
					material.getName(),
					reason
				])
			).toEqual([['card', 'too-detailed']])
		})

		it('bakes on without the layout when it cannot be made, its materials reported as too detailed', async () => {
			exporting(quadDocument({ uvs: false }))
			mocks.writeBakeUvs.mockRejectedValueOnce(
				new Error('Failed to fetch dynamically imported module')
			)

			const messages = await send({
				dracoWorthApplying: true,
				ktx2: false,
				occlusion: true
			})

			const layout = layoutOf(mocks.bakeOcclusionIntoDocument.mock.calls[0])
			expect(
				[...layout!.materials].map(([material, reason]) => [
					material.getName(),
					reason
				])
			).toEqual([['card', 'too-detailed']])
			expect(messages.at(-1)).toMatchObject({ type: 'done' })
		})

		it('lays out nothing, and says nothing, when no bake was asked for', async () => {
			exporting(quadDocument({ uvs: false }))

			const messages = await send({ dracoWorthApplying: true, ktx2: false })

			expect(mocks.writeBakeUvs).not.toHaveBeenCalled()
			expect(messages).not.toContainEqual({ type: 'progress', stage: 'uvs' })
		})
	})

	it('reports how far each bake has drawn, a few times a second and always its end', async () => {
		const reportDrawn = async (onProgress: (fraction: number) => void) => {
			onProgress(0.25)
			// Sooner than the interval after the last, so held back.
			onProgress(0.5)
			onProgress(1)
		}
		mocks.bakeOcclusionIntoDocument.mockImplementation(
			async (_d, _r, _o, onProgress) => {
				await reportDrawn(onProgress)
				return occlusionReport
			}
		)
		mocks.bakeLightsIntoDocument.mockImplementation(
			async (_d, _l, _r, _o, onProgress) => {
				await reportDrawn(onProgress)
				return lightsReport
			}
		)

		const messages = await send({
			dracoWorthApplying: true,
			ktx2: false,
			occlusion: true,
			lights: lighting
		})

		expect(messages.filter(({ type }) => type === 'progress')).toEqual([
			{ type: 'progress', stage: 'occlusion', fraction: 0.25 },
			{ type: 'progress', stage: 'occlusion', fraction: 1 },
			{ type: 'progress', stage: 'lights', fraction: 0.25 },
			{ type: 'progress', stage: 'lights', fraction: 1 }
		])
	})

	it('bakes nothing unless asked', async () => {
		const messages = await send({ dracoWorthApplying: true, ktx2: false })

		expect(mocks.exportGlbForPublish).toHaveBeenCalledWith(
			expect.any(Uint8Array),
			expect.objectContaining({ bake: undefined })
		)
		expect(mocks.bakeOcclusionIntoDocument).not.toHaveBeenCalled()
		expect(mocks.bakeLightsIntoDocument).not.toHaveBeenCalled()
		expect(mocks.createRenderer).not.toHaveBeenCalled()
		expect(messages.at(-1)).toMatchObject({
			type: 'done',
			occlusion: undefined,
			lights: undefined
		})
	})

	it('bakes the lights after the occlusion, each on a renderer of its own, and reports both', async () => {
		const order: string[] = []
		mocks.bakeOcclusionIntoDocument.mockImplementation(
			async (_document: Document, renderer: () => unknown) => {
				order.push('occlusion')
				renderer()
				return occlusionReport
			}
		)
		mocks.bakeLightsIntoDocument.mockImplementation(
			async (
				_document: Document,
				_lighting: unknown,
				renderer: () => unknown
			) => {
				order.push('lights')
				renderer()
				return lightsReport
			}
		)

		const messages = await send({
			dracoWorthApplying: true,
			ktx2: false,
			occlusion: true,
			lights: lighting
		})

		expect(order).toEqual(['occlusion', 'lights'])
		expect(mocks.bakeLightsIntoDocument).toHaveBeenCalledWith(
			exportedDocument,
			lighting,
			expect.any(Function),
			LIGHT_OPTIONS,
			expect.any(Function),
			undefined
		)
		expect(mocks.createRenderer).toHaveBeenCalledTimes(2)
		expect(mocks.disposeRenderer).toHaveBeenCalledTimes(2)
		expect(messages.at(-1)).toMatchObject({
			type: 'done',
			occlusion: occlusionReport,
			lights: lightsReport
		})
	})

	it('publishes without the lights when the GPU resets on every try, keeping the occlusion', async () => {
		mocks.bakeLightsIntoDocument.mockImplementation(
			async (_d: Document, _l: unknown, renderer: () => FakeRenderer) => {
				renderer().lost = true
				throw new Error('The GPU reset while baking the studio lights')
			}
		)

		const messages = await send({
			dracoWorthApplying: true,
			ktx2: false,
			occlusion: true,
			lights: lighting
		})

		expect(messages.at(-1)).toMatchObject({
			type: 'done',
			occlusion: occlusionReport,
			lights: {
				failed: 'gpu-reset',
				detail: 'The GPU reset while baking the studio lights'
			}
		})
		expect(mocks.bakeLightsIntoDocument).toHaveBeenCalledTimes(3)
	})

	it('gives the light bake a fresh renderer after the occlusion bake lost its own', async () => {
		const occlusionRenderers: FakeRenderer[] = []
		mocks.bakeOcclusionIntoDocument.mockImplementation(
			async (_d: Document, renderer: () => FakeRenderer) => {
				const current = renderer()
				occlusionRenderers.push(current)
				if (occlusionRenderers.length === 1) {
					current.lost = true
					throw new Error('The GPU reset while baking body')
				}
				return occlusionReport
			}
		)
		let lightsRenderer: FakeRenderer | undefined
		mocks.bakeLightsIntoDocument.mockImplementation(
			async (_d: Document, _l: unknown, renderer: () => FakeRenderer) => {
				lightsRenderer = renderer()
				return lightsReport
			}
		)

		const messages = await send({
			dracoWorthApplying: true,
			ktx2: false,
			occlusion: true,
			lights: lighting
		})

		expect(lightsRenderer?.lost).toBe(false)
		expect(occlusionRenderers).not.toContain(lightsRenderer)
		expect(messages.at(-1)).toMatchObject({
			type: 'done',
			occlusion: { ...occlusionReport, recovered: 'retried' },
			lights: lightsReport
		})
	})

	it('bakes at lower detail after a second reset, and says so only in the report', async () => {
		const options: unknown[] = []
		mocks.bakeOcclusionIntoDocument.mockImplementation(
			async (_d: Document, renderer: () => FakeRenderer, used: unknown) => {
				options.push(used)
				if (options.length < 3) {
					renderer().lost = true
					throw new Error('The GPU reset while baking body')
				}
				return occlusionReport
			}
		)

		const messages = await send({
			dracoWorthApplying: true,
			ktx2: false,
			occlusion: true
		})

		expect(options).toEqual([
			OCCLUSION_OPTIONS,
			OCCLUSION_OPTIONS,
			{ ...OCCLUSION_OPTIONS, resolution: 256, samples: 128 }
		])
		// The defaults the next bake starts from are as they were.
		expect(OCCLUSION_OPTIONS).toEqual({
			resolution: 512,
			samples: 256,
			distance: 0.25
		})
		expect(messages.at(-1)).toMatchObject({
			type: 'done',
			occlusion: { ...occlusionReport, recovered: 'lower-detail' }
		})
	})

	it('publishes without occlusion when no renderer can be made, and does not retry', async () => {
		mocks.createRenderer.mockImplementationOnce(() => {
			throw new Error('Error creating WebGL context.')
		})

		const messages = await send({
			dracoWorthApplying: true,
			ktx2: false,
			occlusion: true
		})

		expect(mocks.bakeOcclusionIntoDocument).toHaveBeenCalledOnce()
		expect(messages.at(-1)).toMatchObject({
			type: 'done',
			occlusion: {
				failed: 'no-webgl',
				detail: 'Error creating WebGL context.'
			}
		})
	})

	it('encodes textures through its pool, as many at once as it has workers, and ends the pool', async () => {
		const started: string[] = []
		vi.stubGlobal(
			'Worker',
			class {
				constructor(url: URL, options: WorkerOptions) {
					started.push(`${url.pathname} ${options.type}`)
				}
			}
		)
		await send({ dracoWorthApplying: true, ktx2: true })

		expect(mocks.createEncoderPool).toHaveBeenCalledOnce()
		mocks.createEncoderPool.mock.calls[0][0]()
		expect(started).toEqual([
			expect.stringMatching(/\/ktx2-encode\.worker\.ts module$/)
		])
		expect(mocks.compressTextures).toHaveBeenCalledWith(
			expect.objectContaining({ encode: mocks.poolEncode, concurrency: 3 })
		)
		expect(mocks.disposePool).toHaveBeenCalledOnce()
	})

	it('ends the pool when the export fails', async () => {
		mocks.exportGlbForPublish.mockRejectedValue(new Error('Out of memory'))

		await send({ dracoWorthApplying: true, ktx2: true })

		expect(mocks.disposePool).toHaveBeenCalledOnce()
	})

	it('starts no encode workers when KTX2 is off', async () => {
		await send({ dracoWorthApplying: true, ktx2: false })

		expect(mocks.createEncoderPool).not.toHaveBeenCalled()
	})

	it('reports a failure instead of throwing it away', async () => {
		mocks.exportGlbForPublish.mockRejectedValue(
			new Error('Draco encoder failed')
		)

		const messages = await send({ dracoWorthApplying: true, ktx2: false })

		expect(messages).toEqual([
			{ type: 'error', message: 'Draco encoder failed' }
		])
	})
})

/** One quad, its UVs inside the unit square, or none at all. */
function quadDocument({
	uvs,
	textured = false
}: {
	uvs: boolean
	textured?: boolean
}) {
	const document = new Document()
	const buffer = document.createBuffer()
	const primitive = document
		.createPrimitive()
		.setAttribute(
			'POSITION',
			document
				.createAccessor()
				.setBuffer(buffer)
				.setType('VEC3')
				.setArray(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]))
		)
		.setIndices(
			document
				.createAccessor()
				.setBuffer(buffer)
				.setType('SCALAR')
				.setArray(new Uint16Array([0, 1, 2, 0, 2, 3]))
		)
		.setMaterial(document.createMaterial('card'))
	if (textured) {
		primitive.getMaterial()!.setBaseColorTexture(document.createTexture())
	}
	if (uvs) {
		primitive.setAttribute(
			'TEXCOORD_0',
			document
				.createAccessor()
				.setBuffer(buffer)
				.setType('VEC2')
				.setArray(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]))
		)
	}
	document
		.createScene()
		.addChild(
			document
				.createNode()
				.setMesh(document.createMesh().addPrimitive(primitive))
		)
	return document
}

async function sendPlan() {
	const buffer = new ArrayBuffer(4)
	await (
		self.onmessage as (event: MessageEvent<StudioFinishPlanRequest>) => unknown
	)({ data: { type: 'plan', buffer } } as MessageEvent)
	return { buffer, messages: posted.map(({ message }) => message) }
}

describe('planning the studio finish in the publish worker', () => {
	it('answers which materials each bake would take, and bakes nothing', async () => {
		mocks.readGlbDocument.mockResolvedValue(quadDocument({ uvs: true }))

		const { buffer, messages } = await sendPlan()

		expect(mocks.readGlbDocument).toHaveBeenCalledWith(new Uint8Array(buffer))
		expect(messages).toEqual([
			{
				type: 'done',
				occlusion: { baked: ['card'], skipped: [] },
				lights: { baked: ['card'], skipped: [] }
			}
		])
		expect(mocks.exportGlbForPublish).not.toHaveBeenCalled()
		expect(mocks.createRenderer).not.toHaveBeenCalled()
	})

	it('plans a UV set for a material without its own, so both bakes would take it', async () => {
		mocks.readGlbDocument.mockResolvedValue(quadDocument({ uvs: false }))

		const { messages } = await sendPlan()

		expect(messages).toEqual([
			{
				type: 'done',
				occlusion: { baked: ['card'], skipped: [] },
				lights: { baked: ['card'], skipped: [] }
			}
		])
		expect(mocks.writeBakeUvs).not.toHaveBeenCalled()
	})

	it('names why a bake would take nothing', async () => {
		// A texture reads the UVs it lacks, so a layout would move it.
		mocks.readGlbDocument.mockResolvedValue(
			quadDocument({ uvs: false, textured: true })
		)

		const { messages } = await sendPlan()

		const skipped = [{ material: 'card', reason: 'no-uv0' }]
		expect(messages).toEqual([
			{
				type: 'done',
				occlusion: { baked: [], skipped },
				lights: { baked: [], skipped }
			}
		])
	})

	it('ignores a request it does not know', async () => {
		await (self.onmessage as (event: MessageEvent) => unknown)({
			data: { type: 'unknown' }
		} as MessageEvent)

		expect(posted).toEqual([])
		expect(mocks.exportGlbForPublish).not.toHaveBeenCalled()
		expect(mocks.readGlbDocument).not.toHaveBeenCalled()
	})

	it('reports a model it cannot read instead of throwing it away', async () => {
		mocks.readGlbDocument.mockRejectedValue(new Error('Not a GLB'))

		const { messages } = await sendPlan()

		expect(messages).toEqual([{ type: 'error', message: 'Not a GLB' }])
	})
})
