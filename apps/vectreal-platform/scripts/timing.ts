/**
 * The 8-product timing run: photos in, a Publisher scene out, cleanup minutes
 * logged per object.
 *
 * Run via: pnpm nx run vectreal-platform:timing -- <command> [flags]
 *
 *   run [--watch] [--origin=<url>] [--project=<id>]
 *       For every `photos/<NN-slug>/` holding 3 photos: image-to-3D on Modal,
 *       one job per photo; normalize each result; create a scene from the
 *       first photo's model. Finished stages are kept in `runs/<NN-slug>/`,
 *       so a rerun only does what is left. --watch rescans every 30 s.
 *   start <NN>
 *       Stamps cleanup_start for that object.
 *   stop <NN> --usable=yes|no [--took="<what took the time>"] [--final-mb=<n>]
 *       Stamps cleanup_end and the minutes since start.
 *   summary
 *       The median cleanup and what it means for the letters.
 *
 * Needs: the dev server (`pnpm nx dev vectreal-platform`) for normalizing,
 * IMG_TO_3D_RUNTIME_BASE_URL, _PROXY_KEY and _PROXY_SECRET from
 * `.env.development`, and `pnpm -s vectreal login --origin <url>` once for
 * the scenes. The origin defaults to http://localhost:4200.
 *
 * Folder: TIMING_ROOT, default ~/vectreal-timing.
 */
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

import {
	formatTimingLog,
	ONE_CATEGORY_MINUTES,
	parseTimingLog,
	SEND_MINUTES,
	summarize,
	type TimingRow,
	upsertRow
} from './timing-log'
import { runTimingPass, timingPaths } from './timing-run'

const WATCH_INTERVAL_MS = 30_000

function flag(name: string): string | undefined {
	const prefix = `--${name}=`
	return process.argv
		.find((arg) => arg.startsWith(prefix))
		?.slice(prefix.length)
}

// nx runs this from the app's directory; a relative root means where it was typed.
const paths = timingPaths(
	path.resolve(
		process.env.NX_WORKSPACE_ROOT ?? process.cwd(),
		process.env.TIMING_ROOT ?? path.join(homedir(), 'vectreal-timing')
	)
)

async function readRows(): Promise<TimingRow[]> {
	if (!existsSync(paths.log)) throw new Error(`No log at ${paths.log}.`)
	return parseTimingLog(await readFile(paths.log, 'utf8'))
}

function rowFor(rows: TimingRow[], number: string | undefined): TimingRow {
	const row = rows.find((candidate) => candidate.number === number)
	if (!row) {
		throw new Error(
			`No row ${number ?? '(none given)'} in ${paths.log}; name the object by its number, as in 03.`
		)
	}
	return row
}

async function start(number: string | undefined) {
	const rows = await readRows()
	rowFor(rows, number)
	const now = new Date().toISOString()
	await writeFile(
		paths.log,
		formatTimingLog(upsertRow(rows, number!, { cleanup_start: now }))
	)
	console.log(`Cleanup of ${number} started at ${now}.`)
}

async function stop(number: string | undefined) {
	const usable = flag('usable')
	if (usable !== 'yes' && usable !== 'no') {
		throw new Error('stop needs --usable=yes or --usable=no.')
	}
	const rows = await readRows()
	const row = rowFor(rows, number)
	const startedAt = Date.parse(row.cleanup_start)
	if (Number.isNaN(startedAt)) {
		throw new Error(`${number} has no cleanup_start; run start first.`)
	}
	const end = new Date()
	const elapsed = Math.round((end.getTime() - startedAt) / 60_000)
	await writeFile(
		paths.log,
		formatTimingLog(
			upsertRow(rows, number!, {
				cleanup_end: end.toISOString(),
				cleanup_minutes: String(elapsed),
				usable,
				what_took_the_time: flag('took') ?? row.what_took_the_time,
				final_mb: flag('final-mb') ?? row.final_mb
			})
		)
	)
	console.log(`Cleanup of ${number}: ${elapsed} minutes, usable ${usable}.`)
}

async function summary() {
	const result = summarize(await readRows())
	if (result.open.length > 0) {
		console.log(`Still open: ${result.open.join(', ')}`)
	}
	if (result.median === undefined) {
		console.log('No object has finished cleanup yet.')
		return
	}
	const show = (value: number) =>
		Number.isFinite(value) ? `${value} min` : 'unusable'
	console.log(
		`Median cleanup over ${result.finished} objects: ${show(result.median)} ` +
			'(an unusable model counts as never finished)'
	)
	for (const group of result.byDifficulty) {
		console.log(
			`  ${group.difficulty || '(no difficulty)'}: ${show(group.median)} over ${group.count}`
		)
	}
	if (result.verdict === 'send') {
		console.log(
			`${SEND_MINUTES} minutes or less: the letters go out (with a contract yes).`
		)
	} else if (result.verdict === 'one category') {
		const [best] = result.byDifficulty
		console.log(
			`${SEND_MINUTES} to ${ONE_CATEGORY_MINUTES} minutes: letters for one product category only. ` +
				`Fastest group: ${best.difficulty} at ${show(best.median)}.`
		)
	} else {
		console.log(
			`Over ${ONE_CATEGORY_MINUTES} minutes: no letters; write the reason on Path.`
		)
	}
}

async function run() {
	const options = {
		paths,
		origin: flag('origin') ?? 'http://localhost:4200',
		project: flag('project')
	}
	if (!process.argv.includes('--watch')) {
		await runTimingPass(options)
		return
	}
	console.log(`Watching ${paths.photos}; Ctrl-C stops.`)
	for (;;) {
		await runTimingPass(options)
		await sleep(WATCH_INTERVAL_MS)
	}
}

async function main() {
	const [command, number] = process.argv
		.slice(2)
		.filter((arg) => !arg.startsWith('--'))
	if (command === 'run') return run()
	if (command === 'start') return start(number)
	if (command === 'stop') return stop(number)
	if (command === 'summary') return summary()
	throw new Error(
		'Usage: timing <run|start|stop|summary>; see scripts/timing.ts.'
	)
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error)
	process.exitCode = 1
})
