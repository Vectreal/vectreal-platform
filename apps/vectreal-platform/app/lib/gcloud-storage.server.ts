import { Storage } from '@google-cloud/storage'

const isDev = import.meta.env.DEV

const credentials = isDev
	? './credentials/google-storage-local-dev-sa.json'
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
			process.env.GOOGLE_CLOUD_STORAGE_PUBLIC_BUCKET || 'vectreal-public-bucket'
		),
		private: storage.bucket(
			process.env.GOOGLE_CLOUD_STORAGE_PRIVATE_BUCKET ||
				'vectreal-private-bucket'
		)
	}
}
