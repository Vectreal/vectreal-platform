/* vectreal-platform | Supabase Edge Function — optimize-textures
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
 * Supabase Edge Function: optimize-textures
 *
 * Replaces the GCP Cloud Functions v2 optimize-textures worker.
 * Accepts a single raw texture binary and returns a compressed, optionally
 * resized image in the requested format.
 *
 * HTTP contract (unchanged from the Cloud Function):
 *   POST /functions/v1/optimize-textures
 *   Content-Type: application/octet-stream
 *   Authorization: Bearer <supabase-service-role-key>
 *   X-Texture-Index: <number>
 *   X-Texture-File-Name: <string>
 *   X-Optimize-Options: <JSON OptimizeTextureOptions>
 *
 * Response:
 *   200  binary image  +  X-Texture-Index / X-Texture-Name / X-Texture-File-Name headers
 *   400  { error }     on bad input
 *   415  { error }     on wrong content-type
 *   500  { error }     on processing failure
 *
 * Local dev:
 *   supabase functions serve optimize-textures
 *   curl -X POST http://localhost:54321/functions/v1/optimize-textures \
 *     -H "Authorization: Bearer <anon-key>" \
 *     -H "Content-Type: application/octet-stream" \
 *     -H "X-Texture-Index: 0" \
 *     -H "X-Texture-File-Name: albedo.png" \
 *     -H "X-Optimize-Options: {\"targetFormat\":\"webp\",\"quality\":80}" \
 *     --data-binary @texture.png --output optimized.webp
 */

import { encodeImage } from './encoder.ts'
import { FORMAT_MIME, parseOptions, parseTextureIndex } from './types.ts'

// ---------------------------------------------------------------------------
// File-name helpers (mirrors logic in the React Router API route)
// ---------------------------------------------------------------------------

function mimeTypeToExtension(mimeType: string): string | null {
  switch (mimeType.toLowerCase()) {
    case 'image/webp': return 'webp'
    case 'image/jpeg': return 'jpg'
    case 'image/png': return 'png'
    default: return null
  }
}

function replaceExtension(fileName: string, ext: string): string {
  const lastDot = fileName.lastIndexOf('.')
  const lastSlash = fileName.lastIndexOf('/')
  return lastDot > lastSlash
    ? `${fileName.slice(0, lastDot)}.${ext}`
    : `${fileName}.${ext}`
}

function resolveOutputFileName(fileName: string, mimeType: string): string {
  const ext = mimeTypeToExtension(mimeType)
  return ext ? replaceExtension(fileName, ext) : fileName
}

// ---------------------------------------------------------------------------
// JSON error response helper
// ---------------------------------------------------------------------------

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405)
  }

  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('application/octet-stream')) {
    return jsonError(
      'Unsupported content type. optimize-textures requires application/octet-stream payloads.',
      415,
    )
  }

  // Parse and validate request metadata from headers
  let textureIndex: number
  try {
    textureIndex = parseTextureIndex(req.headers.get('x-texture-index'))
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Invalid textureIndex', 400)
  }

  const textureName = (
    req.headers.get('x-texture-file-name') ??
    req.headers.get('x-texture-name') ??
    ''
  ).trim()

  if (!textureName) {
    return jsonError('Missing texture file name', 400)
  }

  const options = parseOptions(req.headers.get('x-optimize-options') ?? '')

  const body = await req.arrayBuffer()
  if (!body.byteLength) {
    return jsonError('Texture payload is empty', 400)
  }

  try {
    const [maxWidth, maxHeight] = options.resize
    const optimized = await encodeImage(new Uint8Array(body), {
      format: options.targetFormat,
      quality: options.quality,
      maxWidth,
      maxHeight,
    })

    if (!optimized.byteLength) {
      throw new Error('Encoder produced an empty output payload')
    }

    const outputMimeType = FORMAT_MIME[options.targetFormat]
    const outputFileName = resolveOutputFileName(textureName, outputMimeType)

    return new Response(optimized, {
      status: 200,
      headers: {
        'Content-Type': outputMimeType,
        'Cache-Control': 'no-store',
        'X-Texture-Index': String(textureIndex),
        'X-Texture-Name': outputFileName,
        'X-Texture-File-Name': outputFileName,
      },
    })
  } catch (err) {
    console.error('[optimize-textures] Processing failed:', err)
    return new Response(
      JSON.stringify({
        error: 'Texture optimization failed',
        details: err instanceof Error ? err.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      },
    )
  }
})
