import { loadModelFromServer } from '@vctrl/hooks/use-load-model/scene-loaders'

import type { LoadedModel, ModelSource } from '@vctrl/hooks/use-load-model'
import type { LoadContext } from '@vctrl/hooks/use-load-model/load-context'

const SCENE_ID = 'scene-1'
const MANIFEST_URL = `/api/scenes/${SCENE_ID}?projectId=proj-1&preview=1&token=tok`
const MODEL_URL = '/api/scenes/scene-1/assets/published-glb-id?preview=1'
const BAKE_URL = '/api/scenes/scene-1/assets/bake-id?preview=1'

const GLB_BYTES = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 1, 2, 3, 4])
const BAKE_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

function embedManifest(overrides: Record<string, unknown> = {}) {
	return {
		success: true,
		data: {
			sceneId: SCENE_ID,
			meta: { name: 'Blue Vans Shoe', description: 'A shoe' },
			publishedModel: {
				url: MODEL_URL,
				fileName: 'blue-vans-shoe.glb',
				mimeType: 'model/gltf-binary',
				byteSize: GLB_BYTES.byteLength
			},
			assetRefs: {
				'bake-id': {
					url: BAKE_URL,
					fileName: 'shadow-bake.png',
					mimeType: 'image/png',
					byteSize: BAKE_BYTES.byteLength
				}
			},
			settings: {
				camera: { cameras: [{ cameraId: 'cam-1', name: 'Front' }] },
				controls: { autoRotate: true },
				shadows: { baked: { assetId: 'bake-id', signature: 'sig' } }
			},
			settingsUpdatedAt: '2026-08-21T00:00:00.000Z',
			...overrides
		}
	}
}

/** Records every request so a stray POST to the legacy endpoint is visible. */
function stubFetch(manifestBody: unknown, manifestStatus = 200) {
	const calls: { url: string; method: string }[] = []

	const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
		calls.push({ url, method: init?.method ?? 'GET' })

		if (url === MODEL_URL) {
			return { ok: true, status: 200, arrayBuffer: async () => GLB_BYTES.buffer }
		}
		if (url === BAKE_URL) {
			return {
				ok: true,
				status: 200,
				arrayBuffer: async () => BAKE_BYTES.buffer
			}
		}

		return {
			ok: manifestStatus >= 200 && manifestStatus < 300,
			status: manifestStatus,
			statusText: manifestStatus === 404 ? 'Not Found' : 'OK',
			json: async () => manifestBody
		}
	})

	vi.stubGlobal('fetch', fetchMock)
	return calls
}

function buildContext() {
	const published: LoadedModel[] = []
	// Typed on the parameter so the File assertion below has something to read.
	const loadToThreeJS = vi.fn(async (_file: File) => ({
		scene: { name: 'three-scene' },
		animations: []
	}))

	const ctx = {
		modelLoader: { loadToThreeJS },
		optimizer: undefined,
		publish: (loaded: LoadedModel) => published.push(loaded),
		onProgress: () => {}
	} as unknown as LoadContext

	return { ctx, loadToThreeJS, published }
}

const source: Extract<ModelSource, { kind: 'server' }> = {
	kind: 'server',
	sceneId: SCENE_ID,
	serverOptions: { endpoint: MANIFEST_URL, apiKey: 'tok' },
	parseMode: 'direct'
}

describe('published-GLB embed load', () => {
	afterEach(() => vi.unstubAllGlobals())

	/**
	 * The guard for the legacy-POST bypass. `fetchManifestPayload` falls back to
	 * `POST get-scene-settings` whenever a manifest fails its shape check, and
	 * that action returns the whole editor payload. An embed manifest has no
	 * `gltfJson`, so without an explicit `publishedModel` arm in the predicate
	 * every embed would silently re-acquire exactly what the manifest withholds.
	 */
	it('accepts a manifest with no gltfJson and never falls back to the POST', async () => {
		const calls = stubFetch(embedManifest())
		const { ctx } = buildContext()

		await loadModelFromServer(source, ctx)

		expect(calls.some((call) => call.method === 'POST')).toBe(false)
	})

	it('requests exactly the published GLB and the bake', async () => {
		const calls = stubFetch(embedManifest())
		const { ctx } = buildContext()

		await loadModelFromServer(source, ctx)

		const assetCalls = calls
			.filter((call) => call.url !== MANIFEST_URL)
			.map((call) => call.url)
			.sort()

		expect(assetCalls).toEqual([BAKE_URL, MODEL_URL].sort())
	})

	it('hands the loader a File carrying the GLB bytes, name and mime type', async () => {
		stubFetch(embedManifest())
		const { ctx, loadToThreeJS } = buildContext()

		await loadModelFromServer(source, ctx)

		expect(loadToThreeJS).toHaveBeenCalledTimes(1)
		const [file] = loadToThreeJS.mock.calls[0]

		expect(file.name).toBe('blue-vans-shoe.glb')
		expect(file.type).toBe('model/gltf-binary')
		expect(Array.from(new Uint8Array(await file.arrayBuffer()))).toEqual(
			Array.from(GLB_BYTES)
		)
	})

	it('keeps settings and meta while reporting no glTF document', async () => {
		stubFetch(embedManifest())
		const { ctx, published } = buildContext()

		const loaded = await loadModelFromServer(source, ctx)

		expect(loaded.sceneData?.gltfJson).toBeNull()
		expect(loaded.sceneData?.camera?.cameras?.[0]?.cameraId).toBe('cam-1')
		expect(loaded.sceneData?.controls?.autoRotate).toBe(true)
		expect(loaded.sceneData?.meta?.name).toBe('Blue Vans Shoe')
		expect(published).toHaveLength(1)
	})

	it('makes the bake bytes available as scene asset data', async () => {
		stubFetch(embedManifest())
		const { ctx } = buildContext()

		const loaded = await loadModelFromServer(source, ctx)
		const entries = Object.values(loaded.sceneData?.assetData ?? {})

		expect(entries.map((entry) => entry.fileName)).toEqual(['shadow-bake.png'])
		// The GLB rides in the asset map only while it is fetched; it must not
		// leak into the data the viewer sees.
		expect(entries).toHaveLength(1)
	})

	it('loads a scene that has no shadow bake', async () => {
		const calls = stubFetch(
			embedManifest({ assetRefs: {}, settings: { controls: {} } })
		)
		const { ctx } = buildContext()

		const loaded = await loadModelFromServer(source, ctx)

		expect(loaded.sceneData?.assetData).toEqual({})
		expect(calls.some((call) => call.url === BAKE_URL)).toBe(false)
	})

	/**
	 * An auth failure is deterministic. Retrying it over the legacy POST only
	 * fails a second time, doubles the requests, and flattens a precise status
	 * into a generic "server load failed".
	 */
	it('throws a structured not_found on a 404 manifest without retrying', async () => {
		const calls = stubFetch({ success: false, error: 'Scene not found' }, 404)
		const { ctx } = buildContext()

		await expect(loadModelFromServer(source, ctx)).rejects.toMatchObject({
			code: 'not_found',
			recoverable: false
		})

		expect(calls.some((call) => call.method === 'POST')).toBe(false)
	})
})
