export * from './model-loader'
/*
  What a reference inside a model means, given where that model sits in the
  dropped selection. Named because `@vctrl/hooks` resolves the same references
  against the same selection - for the optimizer payload and for the byte
  figures the page prints - and a second statement of this rule is what the
  module exists to end.
*/
export {
	referenceIn,
	referenceKeyIn,
	resolutionKey,
	selectionKey
} from './dropped-selection'
export { isMissingAssetsError, missingAssetsError } from './missing-assets'
/*
  Named rather than `export *`: the dispatch in `@vctrl/hooks` needs to ask
  which formats take the three.js route, and nothing outside this package should
  be able to reach the parsers themselves.
*/
export {
	isThreeSourceFormat,
	THREE_SOURCE_FORMAT_IDS
} from './three-source-bridges'
export type { ModelSiblings } from './three-source-bridges'
export * from './resolve-modified-url'
export * from './types'
