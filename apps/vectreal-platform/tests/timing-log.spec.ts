import { describe, expect, it } from 'vitest'

import {
	emptyRow,
	formatTimingLog,
	parseTimingLog,
	summarize,
	type TimingRow,
	upsertRow,
	verdictFor
} from '../scripts/timing-log'

function finished(
	number: string,
	difficulty: string,
	minutes: string,
	usable = 'yes'
): TimingRow {
	return {
		...emptyRow(number),
		difficulty,
		cleanup_minutes: minutes,
		usable
	}
}

describe('timing log', () => {
	it('round-trips notes with commas, quotes and line breaks', () => {
		const row = {
			...emptyRow('06'),
			what_took_the_time: 'the cable, "floating"\nand the arm'
		}
		expect(parseTimingLog(formatTimingLog([row]))).toEqual([row])
	})

	it('reads columns by name, whatever their order', () => {
		const rows = parseTimingLog('usable,number,cleanup_minutes\nyes,01,12\n')
		expect(rows[0]).toMatchObject({
			number: '01',
			usable: 'yes',
			cleanup_minutes: '12'
		})
	})

	it('reads a log saved with a byte-order mark', () => {
		const [row] = parseTimingLog('\uFEFFnumber,usable\n03,yes\n')
		expect(row).toMatchObject({ number: '03', usable: 'yes' })
	})

	it('keeps columns the operator added', () => {
		const rows = parseTimingLog('number,notes\n01,shot at noon\n')
		const written = formatTimingLog(upsertRow(rows, '01', { usable: 'yes' }))
		expect(parseTimingLog(written)[0]).toMatchObject({
			notes: 'shot at noon',
			usable: 'yes'
		})
	})

	it('updates a seeded row in place and keeps the rows in number order', () => {
		const seeded = [
			{ ...emptyRow('02'), shape: 'steel box' },
			{ ...emptyRow('01'), shape: 'block' }
		]
		const rows = upsertRow(seeded, '02', { object: '02-tool-box' })
		expect(rows.map((row) => row.number)).toEqual(['01', '02'])
		expect(rows[1]).toMatchObject({ shape: 'steel box', object: '02-tool-box' })
		expect(upsertRow(rows, '09', {})).toHaveLength(3)
	})

	it('applies the 15 Nov thresholds inclusively', () => {
		expect(verdictFor(30)).toBe('send')
		expect(verdictFor(30.5)).toBe('one category')
		expect(verdictFor(60)).toBe('one category')
		expect(verdictFor(61)).toBe('no letters')
	})

	it('takes the median of finished objects and lists the open ones', () => {
		const result = summarize([
			finished('01', 'easy', '10'),
			finished('02', 'easy', '20'),
			finished('03', 'hard', '50'),
			finished('04', 'hard', '70'),
			emptyRow('05')
		])
		expect(result).toMatchObject({
			finished: 4,
			open: ['05'],
			median: 35,
			verdict: 'one category'
		})
		expect(result.byDifficulty[0]).toEqual({
			difficulty: 'easy',
			count: 2,
			median: 15
		})
	})

	it('counts an unusable model as never finished, however soon it was dropped', () => {
		const result = summarize([
			finished('01', 'easy', '10'),
			finished('02', 'hard', '5', 'no'),
			finished('03', 'hard', '8', 'no')
		])
		expect(result.median).toBe(Infinity)
		expect(result.verdict).toBe('no letters')
	})
})
