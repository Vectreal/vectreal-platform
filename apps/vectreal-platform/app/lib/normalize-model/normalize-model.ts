/**
 * The normalize step itself: one generated GLB in, a GLB and a USDZ out, both
 * placed at real size and inside the size budget.
 *
 * Browser only. Draco encoding and the USDZ exporter both need a browser, so
 * `scripts/normalize-generated-model.ts` runs this in headless Chromium
 * through the dev-only `/__normalize` page rather than in Node.
 */
import { ModelExporter } from '@vctrl/core/model-exporter'
import { ModelLoader } from '@vctrl/core/model-loader'
import { ModelOptimizer } from '@vctrl/core/model-optimizer'
import { createBrowserTextureEncoder } from '@vctrl/hooks/use-optimize-model'

import {
	fitsSizeBudget,
	NORMALIZE_ATTEMPTS,
	type NormalizeAttempt,
	type NormalizeReport
} from './normalize-model-shared'

type Document = ModelOptimizer['document']

function countTriangles(document: Document): number {
	let triangles = 0
	for (const mesh of document.getRoot().listMeshes()) {
		for (const primitive of mesh.listPrimitives()) {
			const indices = primitive.getIndices()
			const vertices = indices ?? primitive.getAttribute('POSITION')
			triangles += Math.floor((vertices?.getCount() ?? 0) / 3)
		}
	}
	return triangles
}

async function runAttempt(
	input: Uint8Array,
	longestEdgeMeters: number | undefined,
	attempt: NormalizeAttempt
) {
	const optimizer = new ModelOptimizer()
	await optimizer.loadFromBuffer(input)
	await optimizer.place({ longestEdgeMeters })
	if (attempt.simplifyRatio < 1) {
		await optimizer.simplify({ ratio: attempt.simplifyRatio })
	}
	await optimizer.deduplicate()
	await optimizer.compressTextures({
		encoder: createBrowserTextureEncoder(),
		targetFormat: 'webp',
		resize: [attempt.textureSize, attempt.textureSize]
	})

	const document = optimizer.document
	const exporter = new ModelExporter()
	const glb = await exporter.exportDocumentGLBDraco(document)
	// USDZ goes through three.js, so it is read back from the GLB just written.
	const { scene } = await new ModelLoader().parseGLBToThreeJS(glb.data)
	const usdz = await exporter.exportThreeJSUSDZ(scene)

	return { document, glb: glb.data, usdz: usdz.data }
}

export async function normalizeModel(
	input: Uint8Array,
	{ longestEdgeMeters }: { longestEdgeMeters?: number } = {}
): Promise<{ report: NormalizeReport; glb: Uint8Array; usdz: Uint8Array }> {
	const source = new ModelOptimizer()
	await source.loadFromBuffer(input)

	const report: NormalizeReport = {
		inputBytes: input.byteLength,
		inputTriangles: countTriangles(source.document),
		longestEdgeMeters: longestEdgeMeters ?? null,
		attempts: [],
		fits: false,
		textures: []
	}

	let result: Awaited<ReturnType<typeof runAttempt>> | undefined
	for (const attempt of NORMALIZE_ATTEMPTS) {
		const started = performance.now()
		result = await runAttempt(input, longestEdgeMeters, attempt)
		const fits =
			fitsSizeBudget(result.glb.byteLength) &&
			fitsSizeBudget(result.usdz.byteLength)
		report.attempts.push({
			...attempt,
			triangles: countTriangles(result.document),
			glbBytes: result.glb.byteLength,
			usdzBytes: result.usdz.byteLength,
			fits,
			milliseconds: Math.round(performance.now() - started)
		})
		if (fits) break
	}

	// NORMALIZE_ATTEMPTS is never empty, so the loop ran at least once.
	const kept = result as NonNullable<typeof result>
	report.fits = report.attempts[report.attempts.length - 1].fits
	report.textures = kept.document
		.getRoot()
		.listTextures()
		.map((texture) => {
			const [width, height] = texture.getSize() ?? [0, 0]
			return {
				name: texture.getName() || texture.getURI(),
				mimeType: texture.getMimeType(),
				width,
				height
			}
		})

	return { report, glb: kept.glb, usdz: kept.usdz }
}
