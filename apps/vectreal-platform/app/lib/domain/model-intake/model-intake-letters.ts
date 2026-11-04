import { normalizeIntakeLetterCode } from './model-intake-shared'

/**
 * The letter list `generate-intake-qr --letters` reads, one row per posted
 * letter, and the mapping it writes back. Pure, so a spec reaches every
 * refusal without a file or a database.
 *
 * Input is CSV with the header `organization,recipient,code`: the brand or
 * agency, the person the envelope names, and the code printed on the card.
 */
export interface IntakeLetterRow {
	organization: string
	recipient: string
	code: string
}

const HEADER = ['organization', 'recipient', 'code'] as const

/** RFC 4180 records: quoted fields may hold commas, quotes ("") and line breaks. */
function parseCsv(text: string): string[][] {
	const records: string[][] = []
	let record: string[] = []
	let field = ''
	let quoted = false

	for (let i = 0; i < text.length; i++) {
		const char = text[i]
		if (quoted) {
			if (char === '"' && text[i + 1] === '"') {
				field += '"'
				i++
			} else if (char === '"') {
				quoted = false
			} else {
				field += char
			}
		} else if (char === '"') {
			quoted = true
		} else if (char === ',') {
			record.push(field)
			field = ''
		} else if (char === '\n' || char === '\r') {
			if (char === '\r' && text[i + 1] === '\n') i++
			record.push(field)
			records.push(record)
			record = []
			field = ''
		} else {
			field += char
		}
	}
	if (field !== '' || record.length > 0) {
		record.push(field)
		records.push(record)
	}
	return records.filter((row) => row.some((cell) => cell.trim() !== ''))
}

/**
 * Every row, or every problem: a list with one bad row prints nothing, so a
 * half-printed batch never reaches the print shop.
 */
export function parseIntakeLetterList(
	text: string
): { ok: true; letters: IntakeLetterRow[] } | { ok: false; errors: string[] } {
	const [header, ...rows] = parseCsv(text.replace(/^\uFEFF/, ''))
	const columns = header?.map((cell) => cell.trim().toLowerCase())
	if (!columns || HEADER.some((name, index) => columns[index] !== name)) {
		return {
			ok: false,
			errors: [`The first line must be ${HEADER.join(',')}.`]
		}
	}

	const errors: string[] = []
	const letters: IntakeLetterRow[] = []
	const seen = new Set<string>()

	rows.forEach((cells, index) => {
		const line = index + 2
		const [organization = '', recipient = '', rawCode = ''] = cells.map(
			(cell) => cell.trim()
		)
		const code = normalizeIntakeLetterCode(rawCode)
		if (cells.length !== HEADER.length) {
			errors.push(`Line ${line}: expected ${HEADER.length} columns.`)
		} else if (!organization) {
			errors.push(`Line ${line}: the organization is empty.`)
		} else if (!code) {
			errors.push(
				`Line ${line}: "${rawCode}" is not a code (6 to 12 letters or digits).`
			)
		} else if (seen.has(code)) {
			errors.push(`Line ${line}: ${code} is already on an earlier line.`)
		} else {
			seen.add(code)
			letters.push({ organization, recipient, code })
		}
	})

	return errors.length > 0 ? { ok: false, errors } : { ok: true, letters }
}

function csvCell(value: string): string {
	return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** The mapping kept with the print files: which code went to whom, and the URL its QR code opens. */
export function formatIntakeLetterMapping(
	rows: Array<IntakeLetterRow & { url: string; file: string }>
): string {
	const lines = [
		['code', 'organization', 'recipient', 'url', 'file'],
		...rows.map((row) => [
			row.code,
			row.organization,
			row.recipient,
			row.url,
			row.file
		])
	]
	return `${lines.map((cells) => cells.map(csvCell).join(',')).join('\n')}\n`
}
