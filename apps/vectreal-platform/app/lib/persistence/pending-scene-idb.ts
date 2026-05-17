import { openDB } from 'idb'

import type {
	OriginalSceneModel,
	PendingSceneDraft,
	SaveOriginalSceneModelInput,
	SavePendingSceneDraftInput
} from '../../types/pending-scene'

/** Database and object-store names for publisher pending drafts. */
const PENDING_SCENE_DB_NAME = 'vectreal-publisher'
const PENDING_SCENE_STORE_NAME = 'pending-scenes'
const ORIGINAL_SCENE_STORE_NAME = 'original-scenes'

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

/**
 * Writes an explicit draft id into sessionStorage for this tab.
 *
 * Used after restoring a cross-tab draft (OAuth redirect) to re-anchor the
 * tab so that subsequent IDB lookups (e.g. `loadOriginalSceneModel`) resolve
 * to the correct entries saved by the originating tab.
 */
export const setTabDraftId = (id: string): void => {
	if (!isClient()) return
	window.sessionStorage.setItem(PENDING_SCENE_TAB_ID_KEY, id)
}

/** Opens (or creates) the IndexedDB database used for pending drafts. */
const getPendingSceneDB = async () => {
	return openDB(PENDING_SCENE_DB_NAME, 2, {
		upgrade(db, oldVersion) {
			if (!db.objectStoreNames.contains(PENDING_SCENE_STORE_NAME)) {
				db.createObjectStore(PENDING_SCENE_STORE_NAME, { keyPath: 'id' })
			}
			if (
				oldVersion < 2 &&
				!db.objectStoreNames.contains(ORIGINAL_SCENE_STORE_NAME)
			) {
				db.createObjectStore(ORIGINAL_SCENE_STORE_NAME, { keyPath: 'id' })
			}
		}
	})
}

/**
 * Deletes expired entries from all IDB stores to keep storage bounded.
 *
 * Runs before read/write operations instead of relying on background tasks.
 */
const deleteExpiredDrafts = async () => {
	if (!isClient()) {
		return
	}

	const now = Date.now()
	const db = await getPendingSceneDB()

	for (const storeName of [PENDING_SCENE_STORE_NAME, ORIGINAL_SCENE_STORE_NAME]) {
		const tx = db.transaction(storeName, 'readwrite')
		let cursor = await tx.objectStore(storeName).openCursor()

		while (cursor) {
			const entry = cursor.value as { expiresAt?: number }
			if (!entry?.expiresAt || entry.expiresAt <= now) {
				await cursor.delete()
			}
			cursor = await cursor.continue()
		}

		await tx.done
	}
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

/**
 * Persists the original un-optimized scene snapshot immediately after a local
 * file upload so the optimization pipeline can reload from it on every run.
 *
 * Returns the draft id string on success, or `false` on failure.
 */
export const saveOriginalSceneModel = async (
	input: SaveOriginalSceneModelInput
): Promise<string | false> => {
	if (!isClient()) {
		return false
	}

	try {
		await deleteExpiredDrafts()
		const db = await getPendingSceneDB()
		const now = Date.now()
		const id = getTabDraftId()
		const entry: OriginalSceneModel = {
			id,
			createdAt: now,
			expiresAt: now + PENDING_SCENE_TTL_MS,
			sceneData: input.sceneData
		}
		await db.put(ORIGINAL_SCENE_STORE_NAME, entry)
		return id
	} catch (error) {
		console.warn('[pending-scene-idb] failed to save original scene model', error)
		return false
	}
}

/**
 * Loads the original un-optimized scene snapshot from IndexedDB.
 *
 * When `draftId` is provided the lookup uses that id directly, enabling a
 * newly opened OAuth tab to find the entry saved by the originating tab.
 *
 * Returns `null` when no valid entry is available.
 */
export const loadOriginalSceneModel = async (
	draftId?: string | null
): Promise<OriginalSceneModel | null> => {
	if (!isClient()) {
		return null
	}

	try {
		await deleteExpiredDrafts()
		const db = await getPendingSceneDB()
		const resolvedId = draftId ?? getTabDraftId()
		const entry = (await db.get(ORIGINAL_SCENE_STORE_NAME, resolvedId)) as
			| OriginalSceneModel
			| undefined

		if (!entry) {
			return null
		}

		if (!entry.expiresAt || entry.expiresAt <= Date.now()) {
			await db.delete(ORIGINAL_SCENE_STORE_NAME, entry.id)
			return null
		}

		return entry
	} catch (error) {
		console.warn('[pending-scene-idb] failed to load original scene model', error)
		return null
	}
}

/** Clears the active tab's original scene snapshot. */
export const clearOriginalSceneModel = async (): Promise<void> => {
	if (!isClient()) {
		return
	}

	try {
		const db = await getPendingSceneDB()
		await db.delete(ORIGINAL_SCENE_STORE_NAME, getTabDraftId())
	} catch (error) {
		console.warn(
			'[pending-scene-idb] failed to clear original scene model',
			error
		)
	}
}
