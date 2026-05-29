/* vectreal-platform | Supabase Edge Function
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
 * Deno-compatible image encoder using imagescript (pure TypeScript + WASM).
 *
 * imagescript supports WebP/JPEG/PNG encode/decode without native binaries,
 * making it suitable for Supabase Edge Functions where sharp cannot run.
 *
 * Resize behaviour mirrors sharp's `fit: 'inside', withoutEnlargement: true`:
 * the image is scaled down proportionally to fit within maxWidth × maxHeight,
 * but is never enlarged if it already fits within the bounds.
 */

import { Image } from 'npm:imagescript@1.3.0'

export interface EncodeOptions {
  /** Target output format */
  format: 'webp' | 'jpeg' | 'png'
  /** Quality 0–100 */
  quality: number
  /** Scale down to fit within this width (never enlarges) */
  maxWidth?: number
  /** Scale down to fit within this height (never enlarges) */
  maxHeight?: number
}

/**
 * Decodes `input`, optionally resizes it proportionally, then re-encodes to
 * the requested format.
 *
 * @param input  Raw image bytes (PNG, JPEG, WebP, GIF, or BMP)
 * @param opts   Encode options
 * @returns      Encoded image bytes in the requested format
 */
export async function encodeImage(
  input: Uint8Array,
  opts: EncodeOptions,
): Promise<Uint8Array> {
  const img = await Image.decode(input)

  const { maxWidth, maxHeight, format, quality } = opts

  if (maxWidth || maxHeight) {
    const scaleW = maxWidth ? maxWidth / img.width : Infinity
    const scaleH = maxHeight ? maxHeight / img.height : Infinity
    const scale = Math.min(scaleW, scaleH, 1) // clamp at 1 — never enlarge
    if (scale < 1) {
      img.resize(Math.round(img.width * scale), Math.round(img.height * scale))
    }
  }

  switch (format) {
    case 'jpeg':
      return img.encodeJPEG(quality) as Promise<Uint8Array>
    case 'png':
      return img.encodePNG() as Promise<Uint8Array>
    case 'webp':
    default:
      return img.encodeWebP(quality) as Promise<Uint8Array>
  }
}

/**
 * Creates a sharp-constructor-compatible encoder for use with
 * @vctrl/core's TextureCompressOptions.encoder and @gltf-transform/functions.
 *
 * The returned function matches the sharp API surface that gltf-transform uses:
 * `encoder(buffer)` → instance with `.resize()`, `.webp/jpeg/png()`,
 * `.toBuffer()`, and `.metadata()` — enabling full model optimization pipelines
 * in Deno/edge contexts when passed to ModelOptimizer.
 */
export function createSharpCompatEncoder() {
  return function sharpCompat(inputBuffer: Uint8Array | ArrayBuffer) {
    const input = inputBuffer instanceof Uint8Array
      ? inputBuffer
      : new Uint8Array(inputBuffer)

    let targetFormat: 'webp' | 'jpeg' | 'png' = 'webp'
    let quality = 80
    let maxWidth: number | undefined
    let maxHeight: number | undefined

    const instance = {
      resize(w?: number, h?: number, _opts?: unknown) {
        maxWidth = w
        maxHeight = h
        return instance
      },
      webp(opts?: { quality?: number }) {
        targetFormat = 'webp'
        if (typeof opts?.quality === 'number') quality = opts.quality
        return instance
      },
      jpeg(opts?: { quality?: number }) {
        targetFormat = 'jpeg'
        if (typeof opts?.quality === 'number') quality = opts.quality
        return instance
      },
      png(opts?: { quality?: number }) {
        targetFormat = 'png'
        if (typeof opts?.quality === 'number') quality = opts.quality
        return instance
      },
      async toBuffer(): Promise<Uint8Array> {
        return encodeImage(input, { format: targetFormat, quality, maxWidth, maxHeight })
      },
      async metadata(): Promise<{ width: number; height: number; format: string }> {
        const img = await Image.decode(input)
        return { width: img.width, height: img.height, format: 'unknown' }
      },
    }

    return instance
  }
}
