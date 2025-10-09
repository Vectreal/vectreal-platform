import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Storage } from '@google-cloud/storage'

const isDev = import.meta.env.DEV

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Build absolute path to credentials file
// From app/lib/ go up to app/, then to the app root (apps/vectreal-platform/)
const credentials = isDev
	? join(__dirname, '../../credentials/google-storage-local-dev-sa.json')
	: '/etc/gcloud-credentials.json'

export async function createStorage(credentialsJson?: string) {
	const storage = new Storage(
		isDev
			? {
					keyFilename: credentials
				}
			: {
					projectId: process.env.GOOGLE_CLOUD_PROJECT,
					credentials: JSON.parse(credentialsJson || '{}')
				}
	)

	return {
		storage,
		public: storage.bucket(
			process.env.GOOGLE_CLOUD_STORAGE_PUBLIC_BUCKET ||
				'vectreal-public-bucket' + (import.meta.env.DEV ? '-dev' : '')
		),
		private: storage.bucket(
			process.env.GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET ||
				'vectreal-private-bucket' + (import.meta.env.DEV ? '-dev' : '')
		)
	}
}
