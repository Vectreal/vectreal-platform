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
 * Texture compression options sent via X-Optimize-Options header (JSON-encoded).
 * Mirrors TextureCompressOptions from @vctrl/core for consistency.
 */
export interface OptimizeTextureOptions {
  /** Maximum [width, height] to resize to. Maintains aspect ratio, never enlarges. */
  resize?: [number, number]
  /** Target output format. Defaults to 'webp'. */
  targetFormat?: 'webp' | 'jpeg' | 'png'
  /** Compression quality 0–100. Defaults to 80. */
  quality?: number
}

export const DEFAULT_OPTIONS: Required<OptimizeTextureOptions> = {
  resize: [2048, 2048],
  targetFormat: 'webp',
  quality: 80,
}

/** Maps target format to MIME type string. */
export const FORMAT_MIME: Record<NonNullable<OptimizeTextureOptions['targetFormat']>, string> = {
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

/**
 * Parses the X-Optimize-Options header JSON string into validated options.
 * Falls back to DEFAULT_OPTIONS on any parse error.
 */
export function parseOptions(optionsStr: string): Required<OptimizeTextureOptions> {
  if (!optionsStr) return DEFAULT_OPTIONS

  try {
    const parsed = JSON.parse(optionsStr) as Partial<OptimizeTextureOptions>
    let resize: [number, number] = DEFAULT_OPTIONS.resize
    if (Array.isArray(parsed.resize) && parsed.resize.length === 2) {
      resize = [Number(parsed.resize[0]), Number(parsed.resize[1])]
    }
    return {
      resize,
      quality: typeof parsed.quality === 'number' ? parsed.quality : DEFAULT_OPTIONS.quality,
      targetFormat:
        parsed.targetFormat === 'jpeg' ||
        parsed.targetFormat === 'png' ||
        parsed.targetFormat === 'webp'
          ? parsed.targetFormat
          : DEFAULT_OPTIONS.targetFormat,
    }
  } catch {
    return DEFAULT_OPTIONS
  }
}

/**
 * Parses and validates the X-Texture-Index header value.
 * Throws if the value is missing or not a non-negative integer.
 */
export function parseTextureIndex(raw: string | null): number {
  const idx = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(idx) || idx < 0) throw new Error('Invalid or missing textureIndex')
  return idx
}
