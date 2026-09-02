import { useSetAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'

import { isEmbedKeyUsable } from '../../lib/domain/embed/embed-key-options'
import {
	buildUpgradeModalState,
	upgradeModalAtom
} from '../../lib/stores/upgrade-modal-store'

import type { Plan } from '../../constants/plan-config'
import type { EmbedApiKeyOption } from '../../lib/domain/embed/embed-key-options'
import type {
	EmbedApiKeyCreatedPayload,
	EmbedApiKeysPayload
} from '../../routes/api/projects.$projectId.api-keys'

/**
 * `ApiResponse.success` wraps the payload; `ApiResponse.error` returns a bare
 * `{ success: false, error }`. `ApiResponse.quotaExceeded` adds `quota`, which
 * is what the upgrade modal needs to name the limit that was hit.
 */
interface QuotaEnvelope {
	limitKey: string
	currentValue: number
	limit: number | null
	plan: Plan
	upgradeTo?: Plan | null
}

type Envelope<T> =
	| { success: true; data: T }
	| { success: false; error?: string; quota?: QuotaEnvelope }

export interface EmbedApiKeysApi {
	keys: EmbedApiKeyOption[]
	allowedDomains: string[]
	canCreateKey: boolean
	loadError: string | null
	/**
	 * Ask for the list again after a refused or failed load.
	 *
	 * The request is latched per endpoint by a ref, so without this a single
	 * blip - a 500, or a 401 after the Supabase session rotates - leaves the
	 * panel showing an error notice with no way back. Fetcher loads revalidate
	 * on every navigation and after every fetcher action anywhere in the app,
	 * so one blip is not rare.
	 */
	retry: () => void
	/**
	 * A list request is in flight.
	 *
	 * React Router keeps the previous `data` while re-loading, so a retry over a
	 * failed load changed nothing on screen at all - not the notice, not the
	 * button - and each click aborts the last request, so clicking faster than
	 * the round trip stopped it ever completing.
	 */
	loading: boolean
	/**
	 * Whether this panel knows anything about the project's keys and domains.
	 *
	 * `hasLoaded && !loadError`, derived once. Spelled out at each call site it
	 * was got wrong three separate times in this feature, always in the same
	 * direction: zero keys and zero domains are what a project with none, a
	 * request in flight, a request never dispatched, and a refused request all
	 * look like from here - and a member who may open this panel but may not
	 * read keys was told their project has none, directly above the 403 saying
	 * they are not allowed to know. A statement about the payload belongs behind
	 * this flag, not behind a fresh copy of the conjunction.
	 *
	 * It is also false while a *previous* project's answer is still in the
	 * fetcher. See `payload` below.
	 */
	hasAnswer: boolean
	/**
	 * The selected key's value, or `''` when nothing selectable is chosen.
	 *
	 * Derived, never typed. There was a text field here, and a reveal toggle
	 * beside it, and a warning for when what was typed disagreed with the key
	 * picked next to it - all of it because the token was stored as a one-way
	 * hash and the product could not show you a key you already owned. It can
	 * now, so the paste path is gone rather than kept as an alternative: the
	 * only value this panel will build a snippet from is one it read back from
	 * a key the user picked.
	 */
	token: string
	selectedKeyId: string
	selectKey: (keyId: string) => void
	createKey: () => void
	creating: boolean
	createError: string | null
}

const EMPTY_DOMAINS: string[] = []

/**
 * The embed panel's API key state.
 *
 * Lives outside the panel because it is most of what the panel does: two
 * fetchers, the key that is selected, and the snippet token that follows from
 * it. Leaving it inline made the panel a component with more state than markup.
 */
export function useEmbedApiKeys(params: {
	projectId?: string
	enabled: boolean
}): EmbedApiKeysApi {
	const { projectId, enabled } = params
	const endpoint = projectId ? `/api/projects/${projectId}/api-keys` : null

	/*
	  Keyed by endpoint, both of them.

	  A fetcher holds its last response until it is replaced, so a single fetcher
	  reused across projects reports the project the user just left: its payload,
	  its error, and its in-flight create. Three separate gates were written for
	  that - one on the echoed `projectId`, one labelling the answer, and none at
	  all on the create - and the third was still missing while the second had a
	  race of its own.

	  A key per endpoint removes the sharing instead. Changing the key hands back
	  a fetcher with no data (`deleteFetcher` on the old key, a fresh entry for
	  the new one), so "an answer about a project we have left" is not a state
	  this hook can be in.
	*/
	const listFetcher = useFetcher<Envelope<EmbedApiKeysPayload>>({
		key: `embed-keys:${endpoint ?? 'none'}`
	})
	const createFetcher = useFetcher<Envelope<EmbedApiKeyCreatedPayload>>({
		key: `embed-keys-create:${endpoint ?? 'none'}`
	})
	const csrfToken = useAuthenticityToken()
	const setUpgradeModal = useSetAtom(upgradeModalAtom)

	const [selectedKeyId, setSelectedKeyId] = useState('')
	/**
	 * A just-minted key, held only until the list catches up.
	 *
	 * Stamped with the list response that was current when it was minted, so it
	 * survives exactly until the next one arrives and not one render longer.
	 * Held as a bare option it outlived its own project: `endpoint` changes,
	 * the refreshed list never contains that id again, and a key minted for
	 * project A sat permanently at the top of project B's picker - usable,
	 * auto-selected, with A's value in it. The same resurrection happened
	 * without a project change, because `updateApiKey` rewrites `apiKeyProjects`
	 * wholesale, so un-scoping the key in another tab made it reappear here.
	 */
	const [createdKey, setCreatedKey] = useState<{
		option: EmbedApiKeyOption
		afterListData: unknown
	} | null>(null)

	const requestedEndpointRef = useRef<string | null>(null)
	const handledCreateRef = useRef<unknown>(null)

	useEffect(() => {
		if (!enabled || !endpoint) return
		if (requestedEndpointRef.current === endpoint) return

		requestedEndpointRef.current = endpoint
		listFetcher.load(endpoint)
		// `listFetcher` is deliberately not a dependency: it is a new object every
		// render, so depending on it re-fires the request on each one. The ref is
		// what makes this run once per endpoint.
	}, [enabled, endpoint])

	const retry = useCallback(() => {
		if (!endpoint) return

		/*
		  No need to touch `requestedEndpointRef`: this button only renders behind
		  `loadError`, which is gated on the answer being for `endpoint`, so the
		  ref already holds it. `router.fetch` aborts the previous request for a
		  fetcher key before starting the next, so repeat clicks are safe and the
		  last one is the one that lands.
		*/
		listFetcher.load(endpoint)
	}, [listFetcher, endpoint])

	/**
	 * The answer, but only if it is an answer about this project.
	 *
	 * `endpoint` changes the moment `projectId` does and the load re-fires, but
	 * `listFetcher.data` keeps the previous project's payload until the new one
	 * lands. Unchecked, that window reported `hasAnswer` for the wrong project:
	 * project A's domain chips and key list rendered under project B's scene,
	 * A's key stayed selected because it was still in the list and still usable,
	 * and the Copy button handed over `/embed/<B>/<sceneB>?token=<A's key>` - a
	 * snippet that looks finished and 404s, which is the exact failure this
	 * panel exists to prevent.
	 *
	 * The route already puts `projectId` on the payload; nothing read it.
	 */
	/*
	  The `projectId` echo is kept as a cheap assertion rather than a gate: with
	  a fetcher per endpoint a mismatch should now be impossible, and if one ever
	  appears the panel renders nothing rather than the wrong project's keys.
	*/
	const payload =
		listFetcher.data?.success && listFetcher.data.data.projectId === projectId
			? listFetcher.data.data
			: null

	const hasLoaded = listFetcher.data !== undefined
	const loadError =
		listFetcher.data && !listFetcher.data.success
			? (listFetcher.data.error ?? 'Could not load API keys.')
			: null

	/*
	  Derived here rather than at the return, because the selection effect below
	  depends on it: "the list is empty" and "there is no list" are different
	  facts, and only the first is a reason to move the selection.
	*/
	const hasAnswer = hasLoaded && loadError === null && payload !== null
	const loading = listFetcher.state !== 'idle'

	/**
	 * The list, with a just-created key in it before the reload lands.
	 *
	 * The create response carries the whole option, value included, so the
	 * snippet can be ready in the same commit as the button's own state change
	 * rather than a round trip later. Merged by id rather than appended, so the
	 * refreshed list replaces it instead of showing the key twice.
	 */
	const keys = useMemo(() => {
		const fetched = payload?.keys ?? []
		/*
		  No payload means no list to be optimistic about. The stamp below only
		  asks whether the list has moved on, which it has not while a *previous*
		  project's response is still sitting in the fetcher - so a key minted in
		  project A stayed merged, stayed selected, and built a finished-looking
		  snippet for project B's scene carrying A's token.
		*/
		if (!payload) return fetched
		if (!createdKey || createdKey.afterListData !== listFetcher.data) {
			return fetched
		}
		if (fetched.some((key) => key.id === createdKey.option.id)) return fetched

		return [createdKey.option, ...fetched]
	}, [payload?.keys, createdKey, listFetcher.data])

	/*
	  One rule covers first load, creating a key, and a key revoked in another
	  tab: if the current selection cannot build a snippet, take the first one
	  that can.

	  `toEmbedApiKeyOptions` already sorts usable-first then newest-first, so
	  "the first selectable option" is "the newest key that works". An explicit
	  pick is never overridden, because this only fires when that pick has
	  stopped being selectable.
	*/
	useEffect(() => {
		/*
		  Only once there is something to decide against. `keys` is also empty for
		  a refused load, for a previous project's answer, and before any answer -
		  none of which say anything about the pick. Ungated, a revalidation that
		  401s anywhere in the app (the publisher autosaves, and every fetcher
		  action revalidates this one) cleared a deliberate choice, and the retry
		  then landed on the newest key instead. The user's snippet changed under
		  them.
		*/
		if (!hasAnswer) return

		const selected = keys.find((key) => key.id === selectedKeyId)
		if (selected && isEmbedKeyUsable(selected)) return

		setSelectedKeyId(keys.find(isEmbedKeyUsable)?.id ?? '')
	}, [hasAnswer, keys, selectedKeyId])

	useEffect(() => {
		if (createFetcher.state !== 'idle' || !createFetcher.data) return
		if (handledCreateRef.current === createFetcher.data) return

		if (!createFetcher.data.success) {
			handledCreateRef.current = createFetcher.data

			// The org is out of API keys on its plan. The route forwards what the
			// upgrade prompt needs, so route it there rather than leaving the user
			// with an error string and no way forward - this is what the full
			// create-key form does for the same error.
			const { quota, error } = createFetcher.data
			if (quota) {
				setUpgradeModal(
					buildUpgradeModalState({
						reason: 'quota_exceeded',
						message: error ?? 'API key limit reached for your plan.',
						...quota,
						actionAttempted: 'api_key_create'
					})
				)
			}
			return
		}

		if (!endpoint) return

		/*
		  Stamped here, below both guards. Above them it marked a response handled
		  that the `!endpoint` return then dropped: the key was minted, a quota
		  spent, and the panel could never reprocess it - and because the response
		  succeeded there was no error to show for it either.
		*/
		handledCreateRef.current = createFetcher.data

		const { key } = createFetcher.data.data

		setCreatedKey({ option: key, afterListData: listFetcher.data })
		/*
		  Selected explicitly, not left to the effect above.

		  That effect only moves when the current pick has stopped being usable,
		  which is the right rule for it and the wrong one here: on the common
		  path the project already has a working key, it is auto-selected, and
		  minting another changed nothing on screen. The button returned from
		  "Creating..." to "Create a key", the snippet still carried the old key,
		  and a quota had been spent invisibly. Every create spec started from an
		  empty list, where the selection was '' and the effect happened to pick
		  the new key anyway.
		*/
		setSelectedKeyId(key.id)
		listFetcher.load(endpoint)
	}, [
		createFetcher.state,
		createFetcher.data,
		endpoint,
		listFetcher.data,
		setUpgradeModal
	])

	const createKey = useCallback(() => {
		if (!endpoint) return
		createFetcher.submit(
			{ intent: 'create', csrf: csrfToken },
			{ method: 'post', action: endpoint }
		)
	}, [createFetcher, csrfToken, endpoint])

	const selectKey = useCallback((keyId: string) => {
		setSelectedKeyId(keyId)
	}, [])

	const selected = keys.find((key) => key.id === selectedKeyId)

	return {
		keys,
		allowedDomains: payload?.allowedDomains ?? EMPTY_DOMAINS,
		canCreateKey: payload?.canCreateKey ?? false,
		loadError,
		hasAnswer,
		retry,
		loading,
		/*
		  Gated on `isEmbedKeyUsable`, not just on the value being there. The
		  selection effect above cannot leave an unusable key selected, but this
		  is the value a snippet is built from - so it asks the question itself
		  rather than trusting that an effect has already run.
		*/
		token: selected && isEmbedKeyUsable(selected) ? (selected.value ?? '') : '',
		/*
		  Blank until there is an answer. `selectedKeyId` survives a project change
		  by design - the effect above will not touch it without a list to judge
		  against - but a `Select` whose value matches no item renders an empty
		  trigger rather than its placeholder, so the user got a labelled, blank,
		  disabled combobox instead of "Select a key".
		*/
		selectedKeyId: hasAnswer ? selectedKeyId : '',
		selectKey,
		createKey,
		creating: createFetcher.state !== 'idle',
		createError:
			createFetcher.data &&
			!createFetcher.data.success &&
			!createFetcher.data.quota
				? (createFetcher.data.error ?? null)
				: null
	}
}
