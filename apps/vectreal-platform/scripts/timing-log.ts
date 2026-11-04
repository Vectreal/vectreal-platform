/**
 * The timing log: one CSV row per object, keyed by the folder's number
 * (`03-wood-unit` is `03`), so rows can be written before the photos exist.
 */

export const TIMING_COLUMNS = [
	'number',
	'object',
	'shape',
	'difficulty',
	'generation_minutes',
	'raw_mb',
	'normalized_mb',
	'scene_url',
	'cleanup_start',
	'cleanup_end',
	'cleanup_minutes',
	'usable',
	'what_took_the_time',
	'final_mb'
] as const

export type TimingColumn = (typeof TIMING_COLUMNS)[number]
/** The known columns, plus any a spreadsheet added, which are kept as they are. */
export type TimingRow = Record<TimingColumn, string> & Record<string, string>

/** `03-wood-unit` -> `03`. */
export function objectNumber(folder: string): string {
	return folder.split('-')[0]
}

function quote(value: string): string {
	return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

export function formatTimingLog(rows: readonly TimingRow[]): string {
	const columns = [
		...new Set([...TIMING_COLUMNS, ...rows.flatMap((row) => Object.keys(row))])
	]
	const lines = [
		columns.join(','),
		...rows.map((row) =>
			columns.map((column) => quote(row[column] ?? '')).join(',')
		)
	]
	return `${lines.join('\n')}\n`
}

/** RFC 4180 fields: quoted fields may hold commas, quotes and newlines. */
function parseRecords(text: string): string[][] {
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
	return records.filter((fields) => fields.some((value) => value !== ''))
}

/**
 * Columns are read by header name, so a spreadsheet may reorder them, add its
 * own, or save with a byte-order mark.
 */
export function parseTimingLog(text: string): TimingRow[] {
	const [header = [], ...records] = parseRecords(text.replace(/^\uFEFF/, ''))
	return records.map((fields) => {
		const row = emptyRow('')
		header.forEach((column, index) => {
			if (column) row[column] = fields[index] ?? ''
		})
		return row
	})
}

export function emptyRow(number: string): TimingRow {
	const row = Object.fromEntries(
		TIMING_COLUMNS.map((column) => [column, ''])
	) as TimingRow
	row.number = number
	return row
}

/** Sets `values` on the row with `number`, adding the row when missing. */
export function upsertRow(
	rows: readonly TimingRow[],
	number: string,
	values: Record<string, string>
): TimingRow[] {
	const found = rows.some((row) => row.number === number)
	const next = found ? [...rows] : [...rows, emptyRow(number)]
	return next
		.map((row) => (row.number === number ? { ...row, ...values } : row))
		.sort((a, b) => a.number.localeCompare(b.number))
}

export const SEND_MINUTES = 30
export const ONE_CATEGORY_MINUTES = 60

export function median(values: readonly number[]): number {
	const sorted = [...values].sort((a, b) => a - b)
	const middle = Math.floor(sorted.length / 2)
	return sorted.length % 2
		? sorted[middle]
		: (sorted[middle - 1] + sorted[middle]) / 2
}

export type TimingVerdict = 'send' | 'one category' | 'no letters'

export function verdictFor(medianMinutes: number): TimingVerdict {
	if (medianMinutes <= SEND_MINUTES) return 'send'
	if (medianMinutes <= ONE_CATEGORY_MINUTES) return 'one category'
	return 'no letters'
}

/**
 * Minutes a finished row counts as, or undefined while cleanup is open. A
 * model judged unusable counts as never finished, so giving up early cannot
 * pull the median down.
 */
export function countedMinutes(row: TimingRow): number | undefined {
	if (row.usable.trim().toLowerCase() === 'no') return Infinity
	const minutes = Number.parseFloat(row.cleanup_minutes)
	return Number.isFinite(minutes) ? minutes : undefined
}

export interface TimingSummary {
	finished: number
	open: string[]
	median?: number
	verdict?: TimingVerdict
	/** Median per difficulty, for the 30 to 60 minute one-category rule. */
	byDifficulty: { difficulty: string; count: number; median: number }[]
}

export function summarize(rows: readonly TimingRow[]): TimingSummary {
	const finished = rows.flatMap((row) => {
		const minutes = countedMinutes(row)
		return minutes === undefined ? [] : [{ row, minutes }]
	})
	const open = rows
		.filter((row) => countedMinutes(row) === undefined)
		.map((row) => row.object || row.number)

	const difficulties = [...new Set(finished.map(({ row }) => row.difficulty))]
	const byDifficulty = difficulties
		.map((difficulty) => {
			const minutes = finished
				.filter(({ row }) => row.difficulty === difficulty)
				.map((entry) => entry.minutes)
			return { difficulty, count: minutes.length, median: median(minutes) }
		})
		.sort((a, b) => a.median - b.median)

	if (finished.length === 0) return { finished: 0, open, byDifficulty }
	const overall = median(finished.map((entry) => entry.minutes))
	return {
		finished: finished.length,
		open,
		median: overall,
		verdict: verdictFor(overall),
		byDifficulty
	}
}
