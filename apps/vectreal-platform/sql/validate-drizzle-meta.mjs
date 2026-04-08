import fs from 'node:fs'
import path from 'node:path'

const metaDir = path.resolve('supabase/migrations/meta')
const journalPath = path.join(metaDir, '_journal.json')

function fail(message) {
	console.error(`[drizzle-meta] ${message}`)
	process.exit(1)
}

if (!fs.existsSync(journalPath)) {
	fail(`Missing journal file: ${journalPath}`)
}

const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'))
const entries = Array.isArray(journal.entries) ? journal.entries : []

if (entries.length === 0) {
	fail('Journal has no entries')
}

const snapshotFiles = fs
	.readdirSync(metaDir)
	.filter((file) => /^\d{4}_snapshot\.json$/.test(file))

const snapshotMap = new Map()
for (const file of snapshotFiles) {
	const idx = Number.parseInt(file.slice(0, 4), 10)
	snapshotMap.set(idx, file)
}

const snapshotFileSet = new Set(snapshotFiles)

// Drizzle commonly does not emit 0000_snapshot.json; require snapshots for migration tags > 0000.
for (const entry of entries) {
	const migrationPrefix = String(entry.tag).split('_')[0]
	const migrationNum = Number.parseInt(migrationPrefix, 10)
	if (Number.isNaN(migrationNum) || migrationNum < 0) {
		fail(`Invalid migration tag format: ${entry.tag}`)
	}

	if (migrationNum > 0) {
		const expectedSnapshotFile = `${migrationPrefix}_snapshot.json`
		if (!snapshotFileSet.has(expectedSnapshotFile)) {
			fail(
				`Journal entry idx=${entry.idx} (${entry.tag}) has no matching snapshot file ${expectedSnapshotFile}.`
			)
		}
	}

	if (
		entry.idx > 0 &&
		!snapshotMap.has(entry.idx) &&
		migrationNum === entry.idx
	) {
		fail(
			`Journal entry idx=${entry.idx} (${entry.tag}) has no matching snapshot file.`
		)
	}
}

// Validate snapshot prevId chain across existing snapshots.
const sortedSnapshotIdx = [...snapshotMap.keys()].sort((a, b) => a - b)
let previousSnapshotId = null

for (const idx of sortedSnapshotIdx) {
	const file = snapshotMap.get(idx)
	const fullPath = path.join(metaDir, file)
	const snapshot = JSON.parse(fs.readFileSync(fullPath, 'utf8'))

	if (!snapshot.id) {
		fail(`Snapshot ${file} is missing id`)
	}

	if (previousSnapshotId !== null && snapshot.prevId !== previousSnapshotId) {
		fail(
			`Broken prevId chain at ${file}: expected prevId=${previousSnapshotId}, got ${snapshot.prevId}`
		)
	}

	previousSnapshotId = snapshot.id
}

console.log('[drizzle-meta] OK: journal and snapshots are consistent')
