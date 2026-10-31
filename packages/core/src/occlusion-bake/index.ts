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
	type OcclusionBakePlan,
	type OcclusionBakeSkipReason,
	type OcclusionBakeTarget
} from './plan'
export { type ScenePrimitive } from './scene-primitives'
export { occlusionBakeSignature } from './signature'
export { writeOcclusionBake, type BakedOcclusionImage } from './write-occlusion'
