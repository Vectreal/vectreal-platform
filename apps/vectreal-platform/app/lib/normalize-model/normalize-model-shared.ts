/**
 * The rules the normalize step holds a generated model to, shared by the
 * browser page that runs it and the script that drives the page.
 */

/** Both deliverables, the GLB and the USDZ, must come in at or under this. */
export const MODEL_SIZE_BUDGET_BYTES = 15_000_000

export interface NormalizeAttempt {
	/** Longest texture edge, in pixels. Textures already smaller keep their size. */
	textureSize: number
	/** Share of triangles kept; 1 keeps the mesh as generated. */
	simplifyRatio: number
}

/**
 * Tried in order, and the first whose GLB and USDZ both fit is kept.
 *
 * Textures shrink before the mesh does, because simplifying is the one step
 * that changes the model's shape. USDZ carries neither Draco nor WebP, and the
 * exporter caps its textures at 1024 pixels, so once textures are at 1024 only
 * fewer triangles can bring the USDZ down.
 */
export const NORMALIZE_ATTEMPTS: readonly NormalizeAttempt[] = [
	{ textureSize: 2048, simplifyRatio: 1 },
	{ textureSize: 1024, simplifyRatio: 1 },
	{ textureSize: 1024, simplifyRatio: 0.5 },
	{ textureSize: 1024, simplifyRatio: 0.25 }
]

export function fitsSizeBudget(bytes: number): boolean {
	return bytes <= MODEL_SIZE_BUDGET_BYTES
}

export interface NormalizeAttemptReport extends NormalizeAttempt {
	triangles: number
	glbBytes: number
	usdzBytes: number
	fits: boolean
	milliseconds: number
}

export interface NormalizeReport {
	inputBytes: number
	inputTriangles: number
	longestEdgeMeters: number | null
	/** Every attempt made, in order; the last one is what was written. */
	attempts: NormalizeAttemptReport[]
	fits: boolean
	textures: { name: string; mimeType: string; width: number; height: number }[]
}
