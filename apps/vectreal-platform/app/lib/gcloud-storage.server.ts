import { dirname, isAbsolute, join, resolve } from 'node:path'
import { existsSync } from 'node:fs'

import { Storage } from '@google-cloud/storage'

const REQUIRED_PROJECT_ID = 'vectreal-platform'
const VALID_DEPLOYED_ENVIRONMENTS = ['staging', 'production'] as const

type DeployedEnvironment = (typeof VALID_DEPLOYED_ENVIRONMENTS)[number]
type RuntimeEnvironment = 'local' | DeployedEnvironment

function getRequiredEnv(name: string): string {
	const value = process.env[name]?.trim()

	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`)
	}

	return value
}

function resolveCredentialsPath(pathValue: string): string {
	return isAbsolute(pathValue) ? pathValue : resolve(process.cwd(), pathValue)
}

function findWorkspaceRoot(startDir: string): string | null {
	let currentDir = startDir

	while (true) {
		if (
			existsSync(join(currentDir, 'pnpm-workspace.yaml')) ||
			existsSync(join(currentDir, 'nx.json'))
		) {
			return currentDir
		}

		const parentDir = dirname(currentDir)
		if (parentDir === currentDir) {
			return null
		}

		currentDir = parentDir
	}
}

function resolveLocalCredentialsPath(): string {
	const credentialsFile =
		process.env.GOOGLE_CLOUD_STORAGE_CREDENTIALS_FILE?.trim()
	const credentialsDir =
		process.env.GOOGLE_CLOUD_STORAGE_CREDENTIALS_DIR?.trim() || 'credentials'
	const legacyCredentialsPath =
		process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
	const workspaceRoot = findWorkspaceRoot(process.cwd())

	const candidates: string[] = []

	if (credentialsFile) {
		if (isAbsolute(credentialsFile)) {
			candidates.push(credentialsFile)
		} else {
			candidates.push(resolve(process.cwd(), credentialsDir, credentialsFile))
			if (workspaceRoot) {
				candidates.push(resolve(workspaceRoot, credentialsDir, credentialsFile))
			}
		}
	}

	if (legacyCredentialsPath) {
		candidates.push(resolveCredentialsPath(legacyCredentialsPath))
		if (!isAbsolute(legacyCredentialsPath) && workspaceRoot) {
			candidates.push(resolve(workspaceRoot, legacyCredentialsPath))
		}
	}

	if (candidates.length === 0) {
		throw new Error(
			'Missing local credentials configuration: set GOOGLE_CLOUD_STORAGE_CREDENTIALS_FILE (recommended) or GOOGLE_APPLICATION_CREDENTIALS'
		)
	}

	for (const candidatePath of [...new Set(candidates)]) {
		if (existsSync(candidatePath)) {
			return candidatePath
		}
	}

	throw new Error(
		`Missing local Google Cloud credentials file. Checked: ${[...new Set(candidates)].join(', ')}`
	)
}

function getRuntimeEnvironment() {
	const environment = process.env.ENVIRONMENT?.trim().toLowerCase()
	const isCloudRun = Boolean(process.env.K_SERVICE)

	if (
		environment &&
		!VALID_DEPLOYED_ENVIRONMENTS.includes(environment as DeployedEnvironment)
	) {
		throw new Error(
			`ENVIRONMENT must be one of ${VALID_DEPLOYED_ENVIRONMENTS.join(', ')}, received: ${environment}`
		)
	}

	if (environment) {
		return environment as RuntimeEnvironment
	}

	if (isCloudRun) {
		throw new Error(
			'ENVIRONMENT must be explicitly set to staging or production in deployed runtime'
		)
	}

	return 'local' as const
}

export async function createStorage() {
	const runtimeEnvironment = getRuntimeEnvironment()
	const isDeployed = runtimeEnvironment !== 'local'
	const privateBucketName = getRequiredEnv(
		'GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET'
	)

	if (
		process.env.GOOGLE_CLOUD_PROJECT?.trim() &&
		process.env.GOOGLE_CLOUD_PROJECT !== REQUIRED_PROJECT_ID
	) {
		throw new Error(
			`GOOGLE_CLOUD_PROJECT must be ${REQUIRED_PROJECT_ID}, received: ${process.env.GOOGLE_CLOUD_PROJECT}`
		)
	}

	const retryOptions = {
		autoRetry: true,
		maxRetries: 3
	}

	let keyFilename: string | undefined

	if (!isDeployed) {
		keyFilename = resolveLocalCredentialsPath()
	}

	const storage = new Storage(
		isDeployed
			? {
					projectId: REQUIRED_PROJECT_ID,
					retryOptions
				}
			: {
					projectId: REQUIRED_PROJECT_ID,
					keyFilename,
					retryOptions
				}
	)

	return {
		storage,
		// public: storage.bucket(
		// 	process.env.GOOGLE_CLOUD_STORAGE_PUBLIC_BUCKET ||
		// 		'vectreal-public-bucket' + (import.meta.env.DEV ? '-dev' : '')
		// ),
		private: storage.bucket(privateBucketName)
	}
}
