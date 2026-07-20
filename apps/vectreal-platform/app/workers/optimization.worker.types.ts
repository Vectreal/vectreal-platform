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

/** Options for each non-texture optimization step passed to the worker. */
export interface WorkerOptimizationOptions {
  simplify?: {
    enabled: boolean
    ratio?: number
    error?: number
  }
  dedup?: {
    enabled: boolean
    textures?: boolean
    materials?: boolean
    meshes?: boolean
    accessors?: boolean
  }
  quantize?: {
    enabled: boolean
    quantizePosition?: number
    quantizeNormal?: number
    quantizeColor?: number
    quantizeTexcoord?: number
  }
  normals?: {
    enabled: boolean
    overwrite?: boolean
  }
  draco?: {
    enabled: boolean
    method?: 'edgebreaker' | 'sequential'
    encodeSpeed?: number
    decodeSpeed?: number
    quantizePosition?: number
    quantizeNormal?: number
    quantizeColor?: number
    quantizeTexcoord?: number
    quantizeGeneric?: number
  }
}

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
      /** Human-readable label matching the step labels in use-optimization-process. */
      step: string
      /** 0–100 completion percentage for the current step. */
      progress: number
    }
  | {
      type: 'done'
      /** Optimized GLB as ArrayBuffer (transferred back for zero-copy). */
      buffer: ArrayBuffer
    }
  | {
      type: 'error'
      message: string
    }
