export {
	BakeError,
	bakeWithRecovery,
	lowerDetail,
	type BakeDetail,
	type BakeFailure,
	type BakeFailureReason,
	type BakeRecovery
} from './bake-outcome'
export {
	bakeOcclusionIntoDocument,
	bakeReport,
	type OcclusionBakeReport
} from './bake-into-document'
export {
	bakeOcclusion,
	encodeOcclusionPng,
	type BakedOcclusion
} from './bake-occlusion'
export {
	DEFAULT_OCCLUSION_BAKE_OPTIONS,
	type OcclusionBakeOptions
} from './options'
export {
	castsOcclusion,
	isGlass,
	planOcclusionBake,
	UV_SKIP_REASONS,
	type BakeUvLayout,
	type OcclusionBakePlan,
	type OcclusionBakeSkipReason,
	type OcclusionBakeTarget
} from './plan'
export {
	MAX_LAYOUT_TRIANGLES,
	planBakeUvs,
	withoutBakeUvs,
	writeBakeUvs,
	type PlannedBakeUvs,
	type Watlas
} from './generated-uvs'
export { type ScenePrimitive } from './scene-primitives'
export { occlusionBakeSignature } from './signature'
export { writeOcclusionBake, type BakedOcclusionImage } from './write-occlusion'
