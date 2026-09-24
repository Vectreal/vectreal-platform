/*
  Nothing here may import the news manifest. It bundles every newsroom article
  body, and every page importing this barrel shipped them: the home page, the
  converters, pricing, contact and the docs index each paid 123 KB gzipped for
  articles they never render. The article components that read it are imported
  by the newsroom from their own modules.
*/
export { AdjacentPager } from './adjacent-pager'
export { ArticleMeta } from './article-meta'
export { AuthorCard } from './author-card'
export { AuthorChip } from './author-chip'
export { CtaPanel } from './cta-panel'
export { DetailPanelSection } from './detail-panel-section'
export {
	describeSizeChange,
	FileSizeComparison,
	type FileSizeComparisonSizeInfo
} from './file-size-comparison'
export { InlineNotice } from './inline-notice'
export { SampleTiles } from './sample-tiles'
export { default as PageHero } from './page-hero'
export { DitherGrain } from './dither-grain'
export { DitherReveal } from './dither-reveal'
export { DitherSwap } from './dither-swap'
export {
	DestructiveAction,
	DestructiveActionButton
} from './destructive-action'
export { StatGrid, StatTile } from './stat-tile'
