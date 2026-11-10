import {
	isIntakeAudience,
	isIntakeProductType,
	isIntakeShowcase,
	mintIntakeLetterCode,
	MODEL_INTAKE_AUDIENCES,
	MODEL_INTAKE_LOCALES,
	MODEL_INTAKE_PRODUCT_TYPES,
	MODEL_INTAKE_SHOWCASES,
	type ModelIntakeAudience,
	type ModelIntakeLocale,
	type ModelIntakeProductType,
	type ModelIntakeShowcase,
	normalizeIntakeLetterCode
} from './model-intake-shared'

/**
 * The letter list `generate-intake-qr --letters` reads, one row per posted
 * letter, and the mapping it writes back. Pure, so a spec reaches every
 * refusal without a file or a database.
 *
 * Columns are found by name: `organization` (the brand or agency),
 * `recipient` (the person the envelope names), `category` (the form's product
 * type), and optionally `audience` (`brand` or `agency`, which picks between
 * the store and the agency page), `showcase` (the sample-store product the
 * card shows, which picks the store page), `code` and `locale`. A row without
 * an audience is a brand, as every letter before the column was; one without a
 * showcase opens the form; one without a code gets a fresh one; one without a locale takes
 * the run's `--lang`. The mapping the script writes carries all of them, so feeding it
 * back in reprints the same letters.
 */
export interface IntakeLetterRow {
	organization: string
	recipient: string
	audience: ModelIntakeAudience
	category: ModelIntakeProductType
	showcase: ModelIntakeShowcase | null
	code: string
	locale: ModelIntakeLocale
}

function isIntakeLocale(value: string): value is ModelIntakeLocale {
	return MODEL_INTAKE_LOCALES.includes(value as ModelIntakeLocale)
}

/** Spreadsheet exports often begin with one. */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff)

const REQUIRED_COLUMNS = ['organization', 'recipient', 'category'] as const

/**
 * RFC 4180 records. A quote opens a quoted field only as its first character;
 * one anywhere else is refused rather than read as the start of a field that
 * would swallow the commas and lines after it.
 */
function parseCsv(text: string): { records: string[][] } | { error: string } {
	const records: string[][] = []
	let record: string[] = []
	let field = ''
	let quoted = false
	let line = 1

	const endField = () => {
		record.push(field)
		field = ''
	}

	for (let i = 0; i < text.length; i++) {
		const char = text[i]
		if (quoted) {
			if (char === '"' && text[i + 1] === '"') {
				field += '"'
				i++
			} else if (char === '"') {
				quoted = false
				const next = text[i + 1]
				if (next !== undefined && !',\r\n'.includes(next)) {
					return { error: `Line ${line}: text after a closing quote.` }
				}
			} else {
				if (char === '\n') line++
				field += char
			}
		} else if (char === '"') {
			if (field !== '') {
				return {
					error: `Line ${line}: a quote inside a field needs the whole field quoted, with the quote doubled.`
				}
			}
			quoted = true
		} else if (char === ',') {
			endField()
		} else if (char === '\n' || char === '\r') {
			if (char === '\r' && text[i + 1] === '\n') i++
			endField()
			records.push(record)
			record = []
			line++
		} else {
			field += char
		}
	}
	if (quoted) return { error: `Line ${line}: a quoted field is never closed.` }
	if (field !== '' || record.length > 0) {
		endField()
		records.push(record)
	}
	return {
		records: records.filter((row) => row.some((cell) => cell.trim() !== ''))
	}
}

/**
 * Every row, or every problem: a list with one bad row prints nothing, so a
 * half-printed batch never reaches the print shop.
 */
export function parseIntakeLetterList(
	text: string,
	defaultLocale: ModelIntakeLocale,
	mintCode: () => string = mintIntakeLetterCode
): { ok: true; letters: IntakeLetterRow[] } | { ok: false; errors: string[] } {
	const parsed = parseCsv(text.replace(BYTE_ORDER_MARK, ''))
	if ('error' in parsed) return { ok: false, errors: [parsed.error] }

	const [header, ...rows] = parsed.records
	const columns = header?.map((cell) => cell.trim().toLowerCase()) ?? []
	const missing = REQUIRED_COLUMNS.filter((name) => !columns.includes(name))
	if (missing.length > 0) {
		return {
			ok: false,
			errors: [
				`The first line must name the columns ${REQUIRED_COLUMNS.join(',')} (and optionally audience, showcase, code, locale). Missing: ${missing.join(', ')}.`
			]
		}
	}

	const errors: string[] = []
	const letters: IntakeLetterRow[] = []
	const taken = new Set<string>()

	rows.forEach((cells, index) => {
		const line = index + 2
		const cell = (name: string) => cells[columns.indexOf(name)]?.trim() ?? ''
		const organization = cell('organization')
		const category = cell('category')
		const audience =
			(columns.includes('audience') && cell('audience')) || 'brand'
		const showcase = columns.includes('showcase') ? cell('showcase') : ''
		const rawCode = columns.includes('code') ? cell('code') : ''
		const code = rawCode ? normalizeIntakeLetterCode(rawCode) : null
		const locale =
			(columns.includes('locale') && cell('locale')) || defaultLocale

		if (cells.length !== columns.length) {
			errors.push(`Line ${line}: expected ${columns.length} columns.`)
		} else if (!organization || /[\r\n]/.test(organization)) {
			errors.push(`Line ${line}: the organization is empty or spans lines.`)
		} else if (!isIntakeAudience(audience)) {
			errors.push(
				`Line ${line}: "${audience}" is not an audience (${MODEL_INTAKE_AUDIENCES.join(', ')}).`
			)
		} else if (!isIntakeProductType(category)) {
			errors.push(
				`Line ${line}: "${category}" is not a category (${MODEL_INTAKE_PRODUCT_TYPES.join(', ')}).`
			)
		} else if (showcase && !isIntakeShowcase(showcase)) {
			errors.push(
				`Line ${line}: "${showcase}" is not a showcase (${MODEL_INTAKE_SHOWCASES.join(', ')}).`
			)
		} else if (rawCode && !code) {
			errors.push(
				`Line ${line}: "${rawCode}" is not a letter code; leave it empty for a new one.`
			)
		} else if (!isIntakeLocale(locale)) {
			errors.push(
				`Line ${line}: "${locale}" is not a language (${MODEL_INTAKE_LOCALES.join(', ')}).`
			)
		} else if (code && taken.has(code)) {
			errors.push(`Line ${line}: ${code} is already on an earlier line.`)
		} else {
			if (code) taken.add(code)
			letters.push({
				organization,
				recipient: cell('recipient'),
				audience,
				category,
				showcase: isIntakeShowcase(showcase) ? showcase : null,
				code: code ?? '',
				locale
			})
		}
	})
	if (errors.length > 0) return { ok: false, errors }

	// Minted after every given code is known, so a fresh one never repeats one.
	for (const letter of letters) {
		if (letter.code) continue
		let fresh = mintCode()
		while (taken.has(fresh)) fresh = mintCode()
		taken.add(fresh)
		letter.code = fresh
	}
	return { ok: true, letters }
}

function csvCell(value: string): string {
	return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * The mapping kept with the print files: which code went to whom, the address
 * to print under its QR code, and the file holding the code itself.
 */
export function formatIntakeLetterMapping(
	rows: Array<IntakeLetterRow & { address: string; file: string }>
): string {
	const lines = [
		[
			'code',
			'organization',
			'recipient',
			'audience',
			'category',
			'showcase',
			'locale',
			'address',
			'file'
		],
		...rows.map((row) => [
			row.code,
			row.organization,
			row.recipient,
			row.audience,
			row.category,
			row.showcase ?? '',
			row.locale,
			row.address,
			row.file
		])
	]
	return `${lines.map((cells) => cells.map(csvCell).join(',')).join('\n')}\n`
}
