/* vectreal-platform | Optimization Worker Types
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>. */

/**
 * Typed message contracts for the optimization Web Worker.
 *
 * All types must be serializable (no class instances, functions, or DOM refs)
 * since they cross the worker boundary via structured clone / transferable.
 */

import type { DracoCompressionReport, Optimizations } from '@vctrl/core'

/**
 * Steps that run inside the worker. Texture compression is excluded: it needs
 * the browser's OffscreenCanvas encoder and runs on the main thread.
 */
export type GeometryOptimizationKey = Exclude<keyof Optimizations, 'texture'>

/**
 * Per-step glTF-Transform options.
 *
 * Derived from the shared `Optimizations` type rather than restated, so a new
 * option on a step is available here without a second edit. `enabled` is
 * dropped because it is UI state — a key being present already means the step
 * should run.
 */
export type WorkerOptimizationOptions = {
  [Key in GeometryOptimizationKey]?: Omit<Optimizations[Key], 'enabled'>
}

/**
 * The order the worker runs geometry steps in.
 *
 * Draco must come last: every other step operates on decoded accessors, so
 * measuring compression before them would measure the wrong geometry.
 * Simplification comes first so the cheaper passes work on the smaller mesh.
 *
 * `optimization-catalog.ts` lists the same steps with their UI copy, and a spec
 * asserts the two orders agree.
 */
export const GEOMETRY_STEP_ORDER = [
  'simplification',
  'dedup',
  'quantize',
  'normals',
  'draco'
] as const satisfies readonly GeometryOptimizationKey[]

/** Message sent TO the worker. The buffer ArrayBuffer should be transferred. */
export interface WorkerInputMessage {
  type: 'optimize'
  /** GLB file bytes (ArrayBuffer transferred to worker for zero-copy). */
  buffer: ArrayBuffer
  options: WorkerOptimizationOptions
}

/** Messages received FROM the worker. */
export type WorkerOutputMessage =
  | {
      type: 'progress'
      /**
       * Which step is reporting. A key rather than a label, so UI copy stays on
       * the main thread and the worker has nothing to keep in sync with it.
       */
      step: GeometryOptimizationKey
      /** 0–100 completion percentage for the current step. */
      progress: number
    }
  | {
      type: 'done'
      /**
       * Optimized GLB as ArrayBuffer (transferred back for zero-copy).
       * Always uncompressed — Draco is applied at export time, not here.
       */
      buffer: ArrayBuffer
      /**
       * Steps the worker's optimizer actually kept. Without this the main
       * thread can't tell an applied pass from a reverted one, since it only
       * ever sees the resulting bytes.
       */
      appliedOptimizations: string[]
      /** Draco measurement, when Draco compression was requested. */
      dracoReport?: DracoCompressionReport
    }
  | {
      type: 'error'
      message: string
    }
