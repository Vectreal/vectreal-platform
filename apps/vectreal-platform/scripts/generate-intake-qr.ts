/**
 * Prints one QR code per letter batch, for the free-model intake.
 *
 * Run via: pnpm nx run vectreal-platform:generate-intake-qr
 *
 * Writes `<batch>.<lang>.svg` into `--out` (default `./intake-qr`) for every
 * batch in `MODEL_INTAKE_BATCHES`, in English and German, and prints the URL
 * each one encodes. Error correction is level M, which survives a crease or a
 * smudge on a printed letter without making the code dense. SVG so the print
 * shop scales it without blur.
 *
 *   --origin=<url>   default https://vectreal.com; a staging origin for a test
 *   --out=<dir>      where the files go
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import QRCode from 'qrcode'

import {
	buildIntakeUrl,
	MODEL_INTAKE_BATCHES,
	MODEL_INTAKE_LOCALES
} from '../app/lib/domain/model-intake/model-intake-shared'

function flag(name: string, fallback: string): string {
	const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`))
	return hit ? hit.slice(name.length + 3) : fallback
}

async function main() {
	const origin = flag('origin', 'https://vectreal.com')
	const outDir = path.resolve(flag('out', 'intake-qr'))
	await mkdir(outDir, { recursive: true })

	for (const batch of MODEL_INTAKE_BATCHES) {
		for (const locale of MODEL_INTAKE_LOCALES) {
			const url = buildIntakeUrl(origin, batch, locale)
			const svg = await QRCode.toString(url, {
				type: 'svg',
				errorCorrectionLevel: 'M',
				margin: 4
			})
			const file = path.join(outDir, `${batch}.${locale}.svg`)
			await writeFile(file, svg)
			console.info('%s  %s', path.relative(process.cwd(), file), url)
		}
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error)
	process.exit(1)
})
