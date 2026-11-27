/**
 * Checks one published package's build output against its size budget.
 *
 * Run as `check-size` on each `@vctrl/*` project, after `build-ci`, so CI
 * enforces it on every PR that touches a package.
 *
 * `manifestExternals` in `vite.library.mts` fails a build that inlines a
 * package the manifest declares. What it cannot see is a package the manifest
 * does not declare: rolldown inlines an undeclared import silently, and every
 * host that installs the package ships the copy. Size is where that shows.
 *
 * Two numbers per package:
 * - code: every `.js` and `.css` file, each gzipped, summed. The most a host's
 *   bundler can pull in from this package. An inlined dependency lands here.
 * - files: every file in the build output, raw. The backstop for what the
 *   tarball carries besides docs (`copy-md` adds those later), declarations
 *   included.
 *
 * Over a budget fails; within 3% of one passes with a warning on the PR, so
 * the change that eats the last headroom is seen before the one that fails.
 *
 * A package that is over gets smaller, or the PR names the new budget and why:
 * a budget never moves silently.
 *
 * The budgets sit about 5% above the sizes measured on 27 Nov 2026, built from
 * main at 62adb42 (3.5.0 plus a few days).
 */
import { appendFileSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

type Budget = { codeKB: number; filesKB: number }

/** Measured 27 Nov 2026: code KB gz, then files KB raw. */
const BUDGETS: Record<string, Budget> = {
	// 61.5, 435.3
	core: { codeKB: 65, filesKB: 455 },
	// 11.9, 85.9
	hooks: { codeKB: 12.5, filesKB: 90 },
	// 56.0, 397.5
	viewer: { codeKB: 59, filesKB: 420 },
	// 4.7, 38.0
	embed: { codeKB: 5, filesKB: 40 },
	// 4.4, 70.9
	sdk: { codeKB: 4.7, filesKB: 75 },
	// 19.4, 58.8
	cli: { codeKB: 20.5, filesKB: 62 }
}

const WARN_AT = 0.97

function filesUnder(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const file = path.join(dir, name)
		return statSync(file).isDirectory() ? filesUnder(file) : [file]
	})
}

function main() {
	const name = process.argv[2]
	const budget = BUDGETS[name]
	if (!budget)
		throw new Error(
			`No size budget for "${name}"; expected one of ${Object.keys(BUDGETS).join(', ')}`
		)

	const root = path.resolve(import.meta.dirname, 'build/packages/vctrl', name)
	const files = filesUnder(root)
	const code: { file: string; gz: number }[] = []
	let filesBytes = 0
	for (const file of files) {
		const bytes = readFileSync(file)
		filesBytes += bytes.length
		if (/\.(js|css)$/.test(file))
			code.push({
				file: path.relative(root, file),
				gz: gzipSync(bytes).length
			})
	}
	const codeBytes = code.reduce((sum, { gz }) => sum + gz, 0)

	const failures: string[] = []
	const nearBudget: string[] = []
	for (const [what, bytes, limitKB] of [
		['code', codeBytes, budget.codeKB],
		['files', filesBytes, budget.filesKB]
	] as const) {
		const kb = (bytes / 1024).toFixed(1)
		const unit = what === 'code' ? 'KB gz' : 'KB'
		console.log(
			`@vctrl/${name} ${what.padEnd(5)} ${kb.padStart(6)} ${unit} of ${limitKB}`
		)
		// Compared in bytes, so half a KB over does not round down to on it.
		if (bytes > limitKB * 1024)
			failures.push(
				`@vctrl/${name}: ${what} is ${kb} ${unit}, over its ${limitKB} budget`
			)
		else if (bytes > limitKB * WARN_AT * 1024)
			nearBudget.push(
				`@vctrl/${name}: ${what} is ${kb} ${unit}, within 3% of its ${limitKB} budget`
			)
	}

	if (nearBudget.length) warnNearBudget(nearBudget)
	if (failures.length) {
		// The largest files first: an inlined dependency is usually one of them.
		const largest = code
			.sort((a, b) => b.gz - a.gz)
			.slice(0, 8)
			.map(
				({ file, gz }) =>
					`  ${(gz / 1024).toFixed(1).padStart(6)} KB gz  ${file}`
			)
		console.error(
			`\n${failures.join('\n')}\n\nLargest code files:\n${largest.join('\n')}`
		)
		process.exit(1)
	}
}

/*
  A warning annotation lands on the PR's checks; the summary line stays on the
  run page. Outside GitHub Actions the console line is all there is.
*/
function warnNearBudget(lines: string[]) {
	console.warn(`\n${lines.join('\n')}`)
	if (process.env['GITHUB_ACTIONS'])
		for (const line of lines)
			console.log(
				`::warning title=Package near its size budget::${line}. The next growth fails CI.`
			)
	const summary = process.env['GITHUB_STEP_SUMMARY']
	if (summary)
		appendFileSync(
			summary,
			lines.map((line) => `- Package near its size budget: ${line}\n`).join('')
		)
}

main()
