/**
 * The browser half of `encode-environment-gainmaps.ts`: gainmap-js encodes on
 * the GPU, so the encode runs in a page. Exposes `window.encodeGainmap(url)`,
 * which answers the gain map JPEG for one HDR as base64.
 */
import {
	encodeAndCompress,
	findTextureMinMax
} from '@monogrid/gainmap-js/encode'
import { encodeJPEGMetadata } from '@monogrid/gainmap-js/libultrahdr'
import {
	ACESFilmicToneMapping,
	DataTexture,
	FloatType,
	RGBAFormat,
	WebGLRenderer
} from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'

/*
  Measured against the HDR as the viewer shows it (HalfFloat) on every hosted
  map: JPEG quality moves the render difference far less than the 8-bit gain
  encoding itself, and 0.85 is where size stops buying visible quality.
*/
const JPEG_QUALITY = 0.85

const renderer = new WebGLRenderer()

const toBase64 = (bytes: Uint8Array) => {
	let binary = ''
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
	}
	return btoa(binary)
}

async function encodeGainmap(url: string): Promise<string> {
	const hdr = await new HDRLoader().setDataType(FloatType).loadAsync(url)
	const { data, width, height } = hdr.image as {
		data: Float32Array
		width: number
		height: number
	}
	// A plain DataTexture (flipY off): the encoder's render-and-read round trip
	// flips rows, so the result lands upright, as the HDR shows.
	const image = new DataTexture(data, width, height, RGBAFormat, FloatType)
	image.needsUpdate = true
	const encoded = await encodeAndCompress({
		image,
		renderer,
		maxContentBoost: Math.max(...findTextureMinMax(hdr)),
		minContentBoost: 1,
		toneMapping: ACESFilmicToneMapping,
		mimeType: 'image/jpeg',
		quality: JPEG_QUALITY
	})
	const jpeg = encodeJPEGMetadata(encoded)
	image.dispose()
	hdr.dispose()
	return toBase64(jpeg)
}

Object.assign(window, { encodeGainmap, encoderReady: true })
