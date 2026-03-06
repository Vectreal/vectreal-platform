import { openDB } from 'idb'

import type {
	PendingSceneDraft,
	SavePendingSceneDraftInput
} from '../../types/pending-scene'

/** Database and object-store names for publisher pending drafts. */
const PENDING_SCENE_DB_NAME = 'vectreal-publisher'
const PENDING_SCENE_STORE_NAME = 'pending-scenes'

/**
 * Session key used to keep one draft id per browser tab.
 *
 * This prevents two open publisher tabs from racing on the same draft record.
 */
const PENDING_SCENE_TAB_ID_KEY = 'vectreal-publisher-tab-id'

/** Draft retention window (24h) before automatic cleanup. */
const PENDING_SCENE_TTL_MS = 1000 * 60 * 60 * 24

/** Guards IndexedDB/sessionStorage usage to browser runtime only. */
const isClient = () => typeof window !== 'undefined'

/** Creates a stable random identifier for draft keys. */
const createId = () => {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID()
	}

	return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Returns the current tab draft id, creating one if missing.
 *
 * Uses sessionStorage so ids are isolated per tab lifetime.
 *
 * Exported so callers can embed the id in auth-redirect URLs, allowing a
 * newly opened tab (after OAuth) to locate the correct draft in IDB even
 * though its own sessionStorage is fresh.
 */
export const getTabDraftId = () => {
	if (!isClient()) {
		return 'pending-scene-default'
	}

	const existing = window.sessionStorage.getItem(PENDING_SCENE_TAB_ID_KEY)
	if (existing) {
		return existing
	}

	const next = createId()
	window.sessionStorage.setItem(PENDING_SCENE_TAB_ID_KEY, next)
	return next
}

/** Opens (or creates) the IndexedDB database used for pending drafts. */
const getPendingSceneDB = async () => {
	return openDB(PENDING_SCENE_DB_NAME, 1, {
		upgrade(db) {
			if (!db.objectStoreNames.contains(PENDING_SCENE_STORE_NAME)) {
				db.createObjectStore(PENDING_SCENE_STORE_NAME, {
					keyPath: 'id'
				})
			}
		}
	})
}

/**
 * Deletes expired drafts eagerly to keep storage bounded.
 *
 * This runs before read/write operations instead of relying on background tasks.
 */
const deleteExpiredDrafts = async () => {
	if (!isClient()) {
		return
	}

	const now = Date.now()
	const db = await getPendingSceneDB()
	const transaction = db.transaction(PENDING_SCENE_STORE_NAME, 'readwrite')
	const store = transaction.objectStore(PENDING_SCENE_STORE_NAME)
	let cursor = await store.openCursor()

	while (cursor) {
		const draft = cursor.value as PendingSceneDraft
		if (!draft?.expiresAt || draft.expiresAt <= now) {
			await cursor.delete()
		}
		cursor = await cursor.continue()
	}

	await transaction.done
}

/**
 * Persists the current in-browser scene draft before auth redirects.
 *
 * Returns the draft id string when successfully persisted so callers can
 * embed it in auth-redirect URLs (enabling cross-tab draft restoration).
 * Returns `false` when persistence fails.
 */
export const savePendingSceneDraft = async (
	input: SavePendingSceneDraftInput
): Promise<string | false> => {
	if (!isClient()) {
		return false
	}

	try {
		const db = await getPendingSceneDB()
		await deleteExpiredDrafts()
		const now = Date.now()
		const draftId = getTabDraftId()
		const draft: PendingSceneDraft = {
			id: draftId,
			createdAt: now,
			expiresAt: now + PENDING_SCENE_TTL_MS,
			sceneMeta: input.sceneMeta,
			sceneData: input.sceneData,
			optimizationSettings: input.optimizationSettings,
			optimizedSceneBytes: input.optimizedSceneBytes ?? null,
			clientSceneBytes: input.clientSceneBytes ?? null
		}

		await db.put(PENDING_SCENE_STORE_NAME, draft)
		return draftId
	} catch (error) {
		console.warn('[pending-scene-idb] failed to persist draft', error)
		return false
	}
}

/**
 * Loads a pending scene draft from IndexedDB.
 *
 * When `draftId` is provided the lookup uses that id directly, which enables
 * a newly opened tab (after OAuth) to restore the draft saved by the
 * originating tab whose id was embedded in the redirect URL.
 *
 * Returns `null` when no valid draft is available.
 */
export const loadPendingSceneDraft = async (
	draftId?: string | null
): Promise<PendingSceneDraft | null> => {
	if (!isClient()) {
		return null
	}

	try {
		await deleteExpiredDrafts()
		const db = await getPendingSceneDB()
		const resolvedId = draftId ?? getTabDraftId()
		const draft = (await db.get(PENDING_SCENE_STORE_NAME, resolvedId)) as
			| PendingSceneDraft
			| undefined

		if (!draft) {
			return null
		}

		if (!draft.expiresAt || draft.expiresAt <= Date.now()) {
			await db.delete(PENDING_SCENE_STORE_NAME, draft.id)
			return null
		}

		return draft
	} catch (error) {
		console.warn('[pending-scene-idb] failed to load draft', error)
		return null
	}
}

/** Clears the active tab's pending draft after successful authenticated save. */
export const clearPendingSceneDraft = async (): Promise<void> => {
	if (!isClient()) {
		return
	}

	try {
		const db = await getPendingSceneDB()
		await db.delete(PENDING_SCENE_STORE_NAME, getTabDraftId())
	} catch (error) {
		console.warn('[pending-scene-idb] failed to clear draft', error)
	}
}
