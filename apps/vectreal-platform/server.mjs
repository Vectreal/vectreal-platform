import { createRequestHandler } from '@react-router/express'
import path from 'node:path'

import { createServerApp } from './server-app.mjs'

/** Production server: loads the build and listens. See `server-app.mjs`. */

const ROOT = path.join(import.meta.dirname, '..', '..')
const BUILD_DIR = path.join(ROOT, 'build', 'apps', 'vectreal-platform')

const build = await import(path.join(BUILD_DIR, 'server', 'index.js'))

// Exported by `entry.server.tsx`. Refusing to start without them is the
// point: a server without the gate would serve scheduled articles early, and
// one without the redaction would log live embed keys.
const { isUnpublishedNewsPath, redactUrlSecrets, startIndexNowSubmissions } =
	build.entry.module
for (const [name, value] of Object.entries({
	isUnpublishedNewsPath,
	redactUrlSecrets,
	startIndexNowSubmissions
})) {
	if (typeof value !== 'function') {
		throw new Error(
			`The server build does not export ${name} from entry.server.tsx.`
		)
	}
}

const app = createServerApp({
	clientDir: path.join(BUILD_DIR, 'client'),
	handleRequest: createRequestHandler({ build, mode: process.env.NODE_ENV }),
	isUnpublishedNewsPath,
	redactUrlSecrets
})

const port = Number(process.env.PORT) || 3000

app.listen(port, () => {
	console.log(`[vectreal-platform] http://localhost:${port}`)
	startIndexNowSubmissions()
})
