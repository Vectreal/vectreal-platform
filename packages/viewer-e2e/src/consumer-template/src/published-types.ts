/*
  Every entry point the packages publish, as an installed consumer resolves
  it. `skipLibCheck` is off in this app's tsconfig, so each declaration file
  behind them is checked too: one importing a path the tarball does not
  contain fails here rather than turning into `any` in somebody's editor.
*/
export type * as Core from '@vctrl/core'
export type * as CoreLightBake from '@vctrl/core/light-bake'
export type * as CoreModelExporter from '@vctrl/core/model-exporter'
export type * as CoreModelFormats from '@vctrl/core/model-formats'
export type * as CoreModelLoader from '@vctrl/core/model-loader'
export type * as CoreModelOptimizer from '@vctrl/core/model-optimizer'
export type * as CoreOcclusionBake from '@vctrl/core/occlusion-bake'
export type * as Embed from '@vctrl/embed'
export type * as Hooks from '@vctrl/hooks'
export type * as HooksUseExportModel from '@vctrl/hooks/use-export-model'
export type * as HooksUseLoadModel from '@vctrl/hooks/use-load-model'
export type * as HooksUseOptimizeModel from '@vctrl/hooks/use-optimize-model'
export type * as Viewer from '@vctrl/viewer'
export type * as ViewerHotspots from '@vctrl/viewer/hotspots'
