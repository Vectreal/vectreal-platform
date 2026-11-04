/**
 * Prints the QR codes for the free-model intake: one per letter, or one per
 * letter batch.
 *
 * Run via: pnpm nx run vectreal-platform:generate-intake-qr -- [flags]
 *
 * With `--letters=<file.csv>` (header `organization,recipient,code`), writes
 * `<code>.svg` for each letter, opening `/free-model?c=<code>`, and
 * `letters.csv` mapping each code to its organization, recipient and URL. The
 * URL carries the opaque code only: the form looks the organization up to
 * greet it, and the recipient's name never leaves `letters.csv`. Add
 * `--register` to record the codes in the database, which the greeting and
 * the stored reply need; it asks for `--confirm-host` like
 * `purge-model-intake`, so the operator states which environment this is.
 *
 * Without `--letters`, writes `<batch>.<lang>.svg` for every batch in
 * `MODEL_INTAKE_BATCHES`, in English and German.
 *
 * Error correction is level M, which survives a crease or a smudge on a
 * printed letter without making the code dense. SVG so the print shop scales
 * it without blur.
 *
 *   --origin=<url>           default https://vectreal.com; a staging origin for a test
 *   --out=<dir>              where the files go, default ./intake-qr
 *   --letters=<file.csv>     one code per letter instead of per batch
 *   --lang=<en|de>           the letters' language, default de
 *   --register               also record the letter codes; needs DATABASE_URL
 *   --confirm-host=<host>    must equal the host in DATABASE_URL
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import QRCode from 'qrcode'

import {
	formatIntakeLetterMapping,
	parseIntakeLetterList
} from '../app/lib/domain/model-intake/model-intake-letters'
import {
	buildIntakeLetterUrl,
	buildIntakeUrl,
	MODEL_INTAKE_BATCHES,
	MODEL_INTAKE_LOCALES,
	type ModelIntakeLocale
} from '../app/lib/domain/model-intake/model-intake-shared'

function isIntakeLocale(value: string): value is ModelIntakeLocale {
	return MODEL_INTAKE_LOCALES.includes(value as ModelIntakeLocale)
}

function flag(name: string): string | undefined {
	const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`))
	return hit?.slice(name.length + 3)
}

async function writeQr(file: string, url: string) {
	const svg = await QRCode.toString(url, {
		type: 'svg',
		errorCorrectionLevel: 'M',
		margin: 4
	})
	await writeFile(file, svg)
	console.info('%s  %s', path.relative(process.cwd(), file), url)
}

/** Fails before any file is written, so a wrong environment costs nothing. */
function registrationHost(): string | null {
	if (!process.argv.includes('--register')) return null
	const databaseUrl = process.env.DATABASE_URL
	if (!databaseUrl) throw new Error('--register needs DATABASE_URL.')
	const host = new URL(databaseUrl).hostname
	if (flag('confirm-host') !== host) {
		throw new Error(`--register needs --confirm-host=${host}.`)
	}
	return host
}

async function printLetters(listFile: string, origin: string, outDir: string) {
	const parsed = parseIntakeLetterList(await readFile(listFile, 'utf8'))
	if (!parsed.ok) throw new Error(parsed.errors.join('\n'))

	const host = registrationHost()
	const locale = flag('lang') ?? 'de'
	if (!isIntakeLocale(locale)) {
		throw new Error(`--lang must be one of ${MODEL_INTAKE_LOCALES.join(', ')}.`)
	}
	const rows = []
	for (const letter of parsed.letters) {
		const url = buildIntakeLetterUrl(origin, letter.code, locale)
		const file = `${letter.code}.svg`
		await writeQr(path.join(outDir, file), url)
		rows.push({ ...letter, url, file })
	}

	const mapping = path.join(outDir, 'letters.csv')
	await writeFile(mapping, formatIntakeLetterMapping(rows))
	console.info('%s  code to recipient', path.relative(process.cwd(), mapping))

	if (host) {
		// Loaded only here, so printing alone never needs a database.
		const { upsertIntakeLetters } =
			await import('../app/lib/domain/model-intake/model-intake-repository.server')
		await upsertIntakeLetters(
			parsed.letters.map(({ code, organization }) => ({ code, organization }))
		)
		console.info('Registered %d letter(s) on %s.', rows.length, host)
	} else {
		console.info(
			'Not registered: the form greets these codes only after --register.'
		)
	}
}

async function printBatches(origin: string, outDir: string) {
	for (const batch of MODEL_INTAKE_BATCHES) {
		for (const locale of MODEL_INTAKE_LOCALES) {
			await writeQr(
				path.join(outDir, `${batch}.${locale}.svg`),
				buildIntakeUrl(origin, batch, locale)
			)
		}
	}
}

async function main() {
	const origin = flag('origin') ?? 'https://vectreal.com'
	const outDir = path.resolve(flag('out') ?? 'intake-qr')
	const letters = flag('letters')
	await mkdir(outDir, { recursive: true })

	if (letters) await printLetters(path.resolve(letters), origin, outDir)
	else await printBatches(origin, outDir)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error instanceof Error ? error.message : error)
		process.exit(1)
	})
