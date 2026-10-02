/**
 * The original survives every optimization.
 *
 * Re-applying a preset used to depend on a copy of the original the publisher
 * kept outside the optimizer, which one entry path wrote and nothing tied to
 * the model on screen, so a pass could start from a previous result or from a
 * different model entirely. The original is now part of the baseline the
 * optimizer already kept, and these pin that it cannot be lost or changed.
 */
import { Document, WebIO } from '@gltf-transform/core'
import { describe, expect, it, vi } from 'vitest'

import { ModelOptimizer, SupersededError } from './model-optimizer'

const io = new WebIO()

/** A triangle strip with enough float positions for quantize to shrink. */
async function glb(vertexCount = 300): Promise<Uint8Array> {
	const document = new Document()
	document.createBuffer()
	const positions = new Float32Array(vertexCount * 3).map((_, i) =>
		Math.sin(i * 0.37)
	)
	const accessor = document.createAccessor().setType('VEC3').setArray(positions)
	const mesh = document
		.createMesh()
		.addPrimitive(document.createPrimitive().setAttribute('POSITION', accessor))
	document.createScene().addChild(document.createNode().setMesh(mesh))
	return io.writeBinary(document)
}

const positionComponentType = (optimizer: ModelOptimizer) => {
	const accessor = optimizer.document
		?.getRoot()
		.listMeshes()[0]
		.listPrimitives()[0]
		.getAttribute('POSITION')
	return accessor?.getComponentType()
}

const FLOAT = 5126

const ONE_PIXEL_PNG = Uint8Array.from(
	atob(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
	),
	(c) => c.charCodeAt(0)
)

/**
 * Holds the optimizer's parse of `held` until `release` or `fail`, so a race
 * can be ordered deterministically. `reached` resolves once the parse began.
 */
function holdParse(optimizer: ModelOptimizer, held: Uint8Array) {
	const io = (optimizer as unknown as { io: WebIO }).io
	const readBinary = io.readBinary.bind(io)
	const gate = {
		release: () => {},
		fail: () => {},
		reached: new Promise<void>(() => {})
	}
	let reached: () => void = () => {}
	gate.reached = new Promise<void>((resolve) => (reached = resolve))
	vi.spyOn(io, 'readBinary').mockImplementation((bytes) =>
		bytes === held
			? new Promise((resolve, reject) => {
					gate.release = () => resolve(readBinary(bytes))
					gate.fail = () => reject(new Error('corrupt'))
					reached()
				})
			: readBinary(bytes)
	)
	return gate
}

/** Passes the magic-byte check, so its parse can be held and then failed. */
const corrupt = () => new TextEncoder().encode('glTF-corrupt')

describe('ModelOptimizer source', () => {
	it('restores the original after a destructive pass', async () => {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await glb())
		const originalSize = (await optimizer.export()).byteLength

		await optimizer.quantize()
		expect(positionComponentType(optimizer)).not.toBe(FLOAT)

		await optimizer.restoreSource()

		expect(positionComponentType(optimizer)).toBe(FLOAT)
		expect((await optimizer.export()).byteLength).toBe(originalSize)
		expect((await optimizer.getReport()).appliedOptimizations).toEqual([])
	})

	it('keeps the original through a sync of a derivation', async () => {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await glb())
		await optimizer.quantize()
		const optimized = await optimizer.export()

		// What the publisher does with the geometry worker's output.
		await optimizer.replaceDocument(optimized)
		expect(positionComponentType(optimizer)).not.toBe(FLOAT)

		await optimizer.restoreSource()
		expect(positionComponentType(optimizer)).toBe(FLOAT)
	})

	it('owns its copy of the bytes it was loaded from', async () => {
		const input = await glb()
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(input)

		input.fill(0)

		await expect(optimizer.restoreSource()).resolves.toBeUndefined()
		expect(positionComponentType(optimizer)).toBe(FLOAT)
	})

	it('adopts a stated original without touching the document', async () => {
		const optimizer = new ModelOptimizer()
		const original = await glb(900)
		await optimizer.loadFromBuffer(await glb(300))
		const shownSize = (await optimizer.export()).byteLength

		await optimizer.setSource(original)

		expect((await optimizer.export()).byteLength).toBe(shownSize)
		expect(optimizer.getBaseline().size).toBe(original.byteLength)

		await optimizer.restoreSource()
		expect((await optimizer.export()).byteLength).toBeGreaterThan(shownSize)
	})

	// The failed load retired the previous model; keeping it would have it
	// optimized and saved under the failed model's name.
	it('leaves no model after a load that failed', async () => {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await glb())

		await expect(
			optimizer.loadFromBuffer(new Uint8Array([1, 2, 3]))
		).rejects.toThrow()

		expect(optimizer.hasModel()).toBe(false)
		expect(optimizer.hasSource()).toBe(false)
	})

	it('keeps the newer model when a superseded load fails after it', async () => {
		const optimizer = new ModelOptimizer()
		const newer = await glb()
		// Settles the optimizer's IO, so the hold below is on the one it uses.
		await optimizer.loadFromBuffer(newer)
		const failing = corrupt()
		const gate = holdParse(optimizer, failing)

		const loading = optimizer.loadFromBuffer(failing)
		await gate.reached
		await optimizer.loadFromBuffer(newer)
		gate.fail()

		// Its own failure, reported as superseded: it is not about the model
		// now loaded.
		await expect(loading).rejects.toBeInstanceOf(SupersededError)
		expect(optimizer.hasModel()).toBe(true)
	})

	it('reports a restore that failed after a newer load as superseded', async () => {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await glb())
		const gate = holdParse(optimizer, optimizer.getBaseline().source!)
		const newer = await glb(900)

		const restoring = optimizer.restoreSource()
		await gate.reached
		await optimizer.loadFromBuffer(newer)
		gate.fail()

		await expect(restoring).rejects.toBeInstanceOf(SupersededError)
	})

	it('reports a statement that failed after a newer load as superseded', async () => {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await glb())
		const stated = await glb(600)
		const gate = holdParse(optimizer, stated)

		const stating = optimizer.setSource(stated)
		await gate.reached
		await optimizer.loadFromBuffer(await glb(900))
		gate.fail()

		await expect(stating).rejects.toBeInstanceOf(SupersededError)
	})

	it('commits no derivation onto a load that failed', async () => {
		const optimizer = new ModelOptimizer()
		const derived = await glb(900)
		await optimizer.loadFromBuffer(await glb())
		const failing = corrupt()
		const gate = holdParse(optimizer, failing)

		const loading = optimizer.loadFromBuffer(failing)
		await gate.reached
		const stale = optimizer.replaceDocument(derived)
		gate.fail()

		await expect(loading).rejects.toThrow()
		await expect(stale).rejects.toBeInstanceOf(SupersededError)
		expect(optimizer.hasModel()).toBe(false)
	})

	it('states no source while no model is loaded', async () => {
		const optimizer = new ModelOptimizer()
		await expect(optimizer.setSource(await glb())).rejects.toThrow(
			'No model loaded'
		)
		expect(optimizer.hasSource()).toBe(false)
	})

	it('has nothing to restore before a load or after a reset', async () => {
		const optimizer = new ModelOptimizer()
		expect(optimizer.hasSource()).toBe(false)
		await expect(optimizer.restoreSource()).rejects.toThrow('No source')

		await optimizer.loadFromBuffer(await glb())
		expect(optimizer.hasSource()).toBe(true)

		optimizer.reset()
		expect(optimizer.hasSource()).toBe(false)
	})

	it('takes the original from a JSON load as well', async () => {
		const optimizer = new ModelOptimizer()
		const json = await io.writeJSON(await io.readBinary(await glb()))
		await optimizer.loadFromJSON(json)

		await optimizer.quantize()
		await optimizer.restoreSource()

		expect(positionComponentType(optimizer)).toBe(FLOAT)
	})
})

/**
 * Every operation awaits between reading the optimizer and writing it. A model
 * loaded in that gap belongs to someone else, so the stale operation must
 * throw and leave the new model exactly as its load left it.
 */
describe('ModelOptimizer with a newer model loaded mid-operation', () => {
	const vertexCount = (optimizer: ModelOptimizer) =>
		optimizer.document
			?.getRoot()
			.listMeshes()[0]
			.listPrimitives()[0]
			.getAttribute('POSITION')
			?.getCount()

	async function withNewerLoad(
		operation: (optimizer: ModelOptimizer) => Promise<unknown>
	) {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await glb(300))
		const newer = await glb(900)

		const stale = operation(optimizer)
		await optimizer.loadFromBuffer(newer)

		await expect(stale).rejects.toBeInstanceOf(SupersededError)
		return { optimizer, newer }
	}

	it('keeps the newer model when a restore finishes after it', async () => {
		const { optimizer } = await withNewerLoad((o) => o.restoreSource())
		expect(vertexCount(optimizer)).toBe(900)
	})

	it('keeps the newer model and its baseline when a derivation lands late', async () => {
		const derived = await glb(300)
		const { optimizer, newer } = await withNewerLoad((o) =>
			o.replaceDocument(derived)
		)
		expect(vertexCount(optimizer)).toBe(900)
		expect(optimizer.getBaseline().source).toEqual(newer)
	})

	it('keeps the newer baseline when a stated source lands late', async () => {
		const stated = await glb(600)
		const { optimizer, newer } = await withNewerLoad((o) => o.setSource(stated))
		expect(optimizer.getBaseline().size).toBe(newer.byteLength)
	})

	it('keeps the newer model when an older load finishes after it', async () => {
		const older = await glb(600)
		const { optimizer } = await withNewerLoad((o) => o.loadFromBuffer(older))
		expect(vertexCount(optimizer)).toBe(900)
	})

	it('applies no transform to the newer model', async () => {
		const { optimizer } = await withNewerLoad((o) => o.quantize())
		expect(positionComponentType(optimizer)).toBe(FLOAT)
		expect((await optimizer.getReport()).appliedOptimizations).toEqual([])
	})

	// Adding normals grows this fixture, so the step takes its revert path.
	it('reports a step that would have reverted as superseded', async () => {
		await withNewerLoad((o) => o.optimizeNormals())
	})

	// The document still held during a load is the one being replaced, so
	// work started then would be for a model about to leave.
	describe('while a load is pending', () => {
		// Held mid-parse, so work that would finish first is what is tested:
		// work finishing after the load is refused by its own checks anyway.
		async function pendingLoad() {
			const optimizer = new ModelOptimizer()
			await optimizer.loadFromBuffer(await glb(300))
			const newer = await glb(900)
			const gate = holdParse(optimizer, newer)
			const pending = optimizer.loadFromBuffer(newer)
			await gate.reached
			const loading = () => {
				gate.release()
				return pending
			}
			return { optimizer, loading, newer }
		}

		it('states no source', async () => {
			const { optimizer, loading, newer } = await pendingLoad()
			await expect(optimizer.setSource(await glb(600))).rejects.toBeInstanceOf(
				SupersededError
			)
			await loading()
			expect(optimizer.getBaseline().size).toBe(newer.byteLength)
		})

		it('commits no derivation', async () => {
			const { optimizer, loading } = await pendingLoad()
			await expect(
				optimizer.replaceDocument(await glb(600))
			).rejects.toBeInstanceOf(SupersededError)
			await loading()
			expect(vertexCount(optimizer)).toBe(900)
		})

		it('applies no transform, and records none on the new model', async () => {
			const { optimizer, loading } = await pendingLoad()
			await expect(optimizer.quantize()).rejects.toBeInstanceOf(SupersededError)
			await loading()
			expect((await optimizer.getReport()).appliedOptimizations).toEqual([])
		})

		it('starts work again once the load has committed', async () => {
			const { optimizer, loading } = await pendingLoad()
			await loading()
			await expect(optimizer.quantize()).resolves.toBeUndefined()
		})
	})

	// A newer load between two steps is refused by the next step's own
	// check; a reset is not, so only the sequence's own ticket reports it.
	it('reports a sequence whose model was reset mid-way as superseded', async () => {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await glb())
		optimizer.onProgress(({ operation }) => {
			if (operation.startsWith('Running optimization 2/')) optimizer.reset()
		})

		await expect(
			optimizer.optimizeAll({
				simplify: false,
				normals: false,
				textures: false
			})
		).rejects.toBeInstanceOf(SupersededError)
	})

	it('reports nothing measured against the newer baseline', async () => {
		await withNewerLoad((o) => o.getReport())
	})

	it('records no texture pass on the newer model', async () => {
		const { optimizer } = await withNewerLoad((o) => o.compressTextures())
		expect((await optimizer.getReport()).appliedOptimizations).toEqual([])
	})

	// A restored draft states its real original after loading the optimized
	// version; a restore that read the version being retired must not commit.
	it('refuses a restore that read the source a pending statement retires', async () => {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await glb(300))
		const stated = await glb(900)
		const gate = holdParse(optimizer, optimizer.getBaseline().source!)

		const stating = optimizer.setSource(stated)
		const stale = optimizer.restoreSource()
		await gate.reached
		await stating
		gate.release()

		await expect(stale).rejects.toBeInstanceOf(SupersededError)
	})

	it('resurrects no document a reset discarded', async () => {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await glb())

		const stale = optimizer.quantize()
		optimizer.reset()

		await expect(stale).rejects.toBeInstanceOf(SupersededError)
		expect(optimizer.hasModel()).toBe(false)
	})

	it('drops a derivation of a source a statement retired meanwhile', async () => {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await glb(300))
		const derived = await glb(600)
		const stated = await glb(900)

		const gate = holdParse(optimizer, derived)

		const stale = optimizer.replaceDocument(derived)
		await gate.reached
		await optimizer.setSource(stated)
		gate.release()

		await expect(stale).rejects.toBeInstanceOf(SupersededError)
		expect(vertexCount(optimizer)).toBe(300)
	})

	// Started on the old document after the load claimed but before it
	// committed, so only the load's commit can refuse it.
	it('applies no transform of the old document onto a load that committed', async () => {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await glb(300))
		const newer = await glb(900)
		const gate = holdParse(optimizer, newer)

		const loading = optimizer.loadFromBuffer(newer)
		await gate.reached
		const stale = optimizer.quantize()
		gate.release()
		await loading

		await expect(stale).rejects.toBeInstanceOf(SupersededError)
		expect(vertexCount(optimizer)).toBe(900)
		expect(positionComponentType(optimizer)).toBe(FLOAT)
	})

	it('applies no transform onto a load that failed', async () => {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await glb())
		const failing = corrupt()
		const gate = holdParse(optimizer, failing)

		const loading = optimizer.loadFromBuffer(failing)
		await gate.reached
		const stale = optimizer.quantize()
		gate.fail()

		await expect(loading).rejects.toThrow()
		await expect(stale).rejects.toBeInstanceOf(SupersededError)
		expect(optimizer.hasModel()).toBe(false)
	})

	it('adopts no load that was in flight when the optimizer was reset', async () => {
		const optimizer = new ModelOptimizer()
		const loading = optimizer.loadFromBuffer(await glb())
		optimizer.reset()

		await expect(loading).rejects.toBeInstanceOf(SupersededError)
		expect(optimizer.hasModel()).toBe(false)
	})

	it('leaves nothing behind once the optimizer was reset', async () => {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await glb())

		const stale = optimizer.restoreSource()
		optimizer.reset()

		await expect(stale).rejects.toBeInstanceOf(SupersededError)
		expect(optimizer.hasModel()).toBe(false)
	})

	it('commits a derivation when nothing replaced the model', async () => {
		const optimizer = new ModelOptimizer()
		const source = await glb(300)
		await optimizer.loadFromBuffer(source)

		await optimizer.replaceDocument(await glb(900))

		expect(vertexCount(optimizer)).toBe(900)
		expect(optimizer.getBaseline().source).toEqual(source)
	})
})

/**
 * A caller that times out on a step does not stop it. Once the document has
 * been replaced, by putting the original back or by a newer derivation, that
 * orphaned step must not commit over it.
 */
describe('ModelOptimizer with the document replaced mid-operation', () => {
	it('drops a transform that finishes after the original is back', async () => {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await glb())

		const orphaned = optimizer.quantize()
		await optimizer.restoreSource()

		await expect(orphaned).rejects.toBeInstanceOf(SupersededError)
		expect(positionComponentType(optimizer)).toBe(FLOAT)
		expect((await optimizer.getReport()).appliedOptimizations).toEqual([])
	})

	it('drops a derivation that lands after the original is back', async () => {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await glb())
		await optimizer.quantize()
		const derived = await optimizer.export()

		const orphaned = optimizer.replaceDocument(derived)
		await optimizer.restoreSource()

		await expect(orphaned).rejects.toBeInstanceOf(SupersededError)
		expect(positionComponentType(optimizer)).toBe(FLOAT)
	})

	it('drops a transform that finishes after a derivation replaced it', async () => {
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await glb())
		const derived = await optimizer.export()

		const orphaned = optimizer.quantize()
		await optimizer.replaceDocument(derived)

		await expect(orphaned).rejects.toBeInstanceOf(SupersededError)
		expect(positionComponentType(optimizer)).toBe(FLOAT)
	})

	// A stale pass can sync its result after a new load started but before
	// it committed; the new model must still win.
})

describe('ModelOptimizer texture names at load', () => {
	// Normalization runs on the document being loaded, before it is adopted,
	// so it must read material slots from that document.
	it('names an unnamed texture after its material slot', async () => {
		const document = new Document()
		document.createBuffer()
		const texture = document
			.createTexture()
			.setImage(ONE_PIXEL_PNG)
			.setMimeType('image/png')
		const material = document
			.createMaterial('Wood')
			.setBaseColorTexture(texture)
		const accessor = document
			.createAccessor()
			.setType('VEC3')
			.setArray(new Float32Array(9))
		const mesh = document
			.createMesh()
			.addPrimitive(
				document
					.createPrimitive()
					.setAttribute('POSITION', accessor)
					.setMaterial(material)
			)
		document.createScene().addChild(document.createNode().setMesh(mesh))

		// Loaded over another model, whose materials must not be consulted.
		const optimizer = new ModelOptimizer()
		await optimizer.loadFromBuffer(await glb())
		await optimizer.loadFromBuffer(await io.writeBinary(document))

		// The URI the document carries, not one resolved again on read.
		const [loaded] = optimizer.document.getRoot().listTextures()
		expect(loaded.getURI()).toBe('Wood_baseColor.png')
	})
})
