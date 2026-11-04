/**
 * Prints the QR codes for the free-model intake: one per letter, or one per
 * letter batch.
 *
 * Run via: pnpm nx run vectreal-platform:generate-intake-qr -- [flags]
 *
 * With `--letters=<file.csv>` (columns `organization,recipient,category`, and
 * optionally `code`), each letter gets a code, and the QR code encodes its
 * short address, `https://vectreal.com/c/<code>`. That address counts the
 * scan and forwards to the sample-store page for the letter's category, or to
 * the form while the category has no page. The URL carries the opaque code
 * only: the person's name never leaves the files written here.
 *
 * Writes into `--out`:
 *   <code>.svg    the QR code, for print
 *   letters.csv   code, organization, recipient, category, the address to
 *                 print under the QR code, and the file. Refused if it exists,
 *                 because it is the only record of who got which code. Fed
 *                 back as `--letters`, it reprints the same codes.
 *
 * `--register` records the letters in the database, which the forward, the
 * greeting and the stored reply all need. It asks for `--confirm-host` like
 * `purge-model-intake`, so the operator states which environment this is, and
 * it refuses a code already registered for a different letter.
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
 *   --register               also record the letters; needs DATABASE_URL
 *   --confirm-host=<host>    must equal the host in DATABASE_URL
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import QRCode from 'qrcode'

import {
	formatIntakeLetterMapping,
	parseIntakeLetterList
} from '../app/lib/domain/model-intake/model-intake-letters'
import {
	buildIntakeShortUrl,
	buildIntakeUrl,
	MODEL_INTAKE_BATCHES,
	MODEL_INTAKE_LOCALES,
	type ModelIntakeLocale
} from '../app/lib/domain/model-intake/model-intake-shared'

function flag(name: string): string | undefined {
	const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`))
	return hit?.slice(name.length + 3)
}

function isIntakeLocale(value: string): value is ModelIntakeLocale {
	return MODEL_INTAKE_LOCALES.includes(value as ModelIntakeLocale)
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

/** Every check runs before the first file or row is written. */
async function printLetters(listFile: string, origin: string, outDir: string) {
	const parsed = parseIntakeLetterList(await readFile(listFile, 'utf8'))
	if (!parsed.ok) throw new Error(parsed.errors.join('\n'))

	const locale = flag('lang') ?? 'de'
	if (!isIntakeLocale(locale)) {
		throw new Error(`--lang must be one of ${MODEL_INTAKE_LOCALES.join(', ')}.`)
	}
	const mapping = path.join(outDir, 'letters.csv')
	if (existsSync(mapping)) {
		throw new Error(
			`${mapping} exists and is the only record of who got which code. Choose another --out.`
		)
	}
	const host = registrationHost()

	if (host) {
		// Loaded only here, so printing alone never needs a database.
		const { registerIntakeLetters } =
			await import('../app/lib/domain/model-intake/model-intake-repository.server')
		const conflicts = await registerIntakeLetters(
			parsed.letters.map(({ code, organization, category }) => ({
				code,
				organization,
				category,
				locale
			}))
		)
		if (conflicts.length > 0) {
			throw new Error(
				`Already registered for a different letter: ${conflicts.join(', ')}. Nothing was printed; the other letters are registered.`
			)
		}
		console.info('Registered %d letter(s) on %s.', parsed.letters.length, host)
	}

	await mkdir(outDir, { recursive: true })
	const rows = []
	for (const letter of parsed.letters) {
		const url = buildIntakeShortUrl(origin, letter.code)
		const file = `${letter.code}.svg`
		await writeQr(path.join(outDir, file), url)
		rows.push({ ...letter, address: url.replace(/^https?:\/\//, ''), file })
	}
	await writeFile(mapping, formatIntakeLetterMapping(rows), { flag: 'wx' })
	console.info('%s  code to recipient', path.relative(process.cwd(), mapping))

	if (!host) {
		console.info(
			'Not registered: these codes forward to the plain form until a --register run.'
		)
	}
}

async function printBatches(origin: string, outDir: string) {
	if (process.argv.includes('--register')) {
		throw new Error('--register records letters, so it needs --letters.')
	}
	await mkdir(outDir, { recursive: true })
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

	if (letters) await printLetters(path.resolve(letters), origin, outDir)
	else await printBatches(origin, outDir)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error instanceof Error ? error.message : error)
		process.exit(1)
	})
