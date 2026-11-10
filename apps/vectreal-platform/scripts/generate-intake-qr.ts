/**
 * Prints the QR codes for the free-model intake: one per letter, or one per
 * letter batch.
 *
 * Run via: pnpm nx run vectreal-platform:generate-intake-qr -- [flags]
 *
 * With `--letters=<file.csv>`, the Notion Letters export as it downloads
 * (columns `Organization`, `Recipient`, `Category`, and optionally `Audience`,
 * `Showcase`, `Code` and `Locale`, in any case), each letter keeps the code its
 * row carries or gets a fresh one, and the QR code encodes its short address,
 * `https://vectreal.com/c/<code>`. That address counts the scan and forwards an
 * agency letter to the agency page and a brand letter to the sample-store page
 * for its showcase, or to the form while it has none. A row without an
 * audience is a brand. The URL carries the opaque code
 * only: the person's name never leaves the files written here.
 *
 * Writes into `--out`:
 *   <code>.svg    the QR code, for print
 *   letters.csv   code, organization, recipient, audience, category, showcase, locale,
 *                 the address to print under the QR code, the file, and then
 *                 every other column of the list under its own name, the
 *                 postal `Address` as `postal_address`. Refused if it exists,
 *                 because it is the only record of who got which code. Fed
 *                 back as `--letters`, it reprints the same codes.
 *
 * `--register` records the letters in the database, which the forward, the
 * greeting and the stored reply all need. It asks for `--confirm-host` like
 * `purge-model-intake`, so the operator states which environment this is, and
 * it refuses a code already registered for a different letter. A row's
 * `locale` column, when present, wins over `--lang`.
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

/**
 * Every check runs before the first file is written, and the files before the
 * first row: a run that fails while registering leaves a `letters.csv` that
 * registers the same codes when fed back in.
 */
async function printLetters(listFile: string, origin: string, outDir: string) {
	const lang = flag('lang') ?? 'de'
	if (!isIntakeLocale(lang)) {
		throw new Error(`--lang must be one of ${MODEL_INTAKE_LOCALES.join(', ')}.`)
	}
	const parsed = parseIntakeLetterList(await readFile(listFile, 'utf8'), lang)
	if (!parsed.ok) throw new Error(parsed.errors.join('\n'))

	const mapping = path.join(outDir, 'letters.csv')
	if (existsSync(mapping)) {
		throw new Error(
			`${mapping} exists and is the only record of who got which code. Choose another --out.`
		)
	}
	const host = registrationHost()
	const letters = parsed.letters.map(
		({ code, organization, audience, category, showcase, locale }) => ({
			code,
			organization,
			audience,
			category,
			showcase,
			locale
		})
	)
	// Loaded only when registering, so printing alone never needs a database.
	const repository = host
		? await import('../app/lib/domain/model-intake/model-intake-repository.server')
		: null
	const conflicts =
		(await repository?.findConflictingIntakeLetters(letters)) ?? []
	if (conflicts.length > 0) {
		throw new Error(
			`Already registered for a different letter: ${conflicts.join(', ')}. Nothing was printed or registered.`
		)
	}

	await mkdir(outDir, { recursive: true })
	const rows = []
	for (const letter of parsed.letters) {
		const url = buildIntakeShortUrl(origin, letter.code)
		const file = `${letter.code}.svg`
		await writeQr(path.join(outDir, file), url)
		rows.push({ ...letter, address: url.replace(/^https?:\/\//, ''), file })
	}
	await writeFile(
		mapping,
		formatIntakeLetterMapping(rows, parsed.passThrough),
		{ flag: 'wx' }
	)
	console.info('%s  code to recipient', path.relative(process.cwd(), mapping))

	if (repository) {
		await repository.insertIntakeLetters(letters)
		// Asked again: a different letter registered with one of these codes since the first check would otherwise be kept silently.
		const raced = await repository.findConflictingIntakeLetters(letters)
		if (raced.length > 0) {
			throw new Error(
				`Registered meanwhile for a different letter: ${raced.join(', ')}. Do not post those letters; print them again with new codes.`
			)
		}
		console.info('Registered %d letter(s) on %s.', letters.length, host)
	} else {
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
