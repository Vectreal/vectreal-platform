import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'

import { getDbClient } from '../../../db/client'
import { consentRecords } from '../../../db/schema/consent/consent-records'
import {
	type ConsentChoices,
	CONSENT_POLICY_VERSION
} from '../../sessions/consent-session.server'

export interface UpsertConsentParams {
	userId: string | null
	anonymousId: string | null
	choices: ConsentChoices
	version?: string
	ipCountry?: string | null
	userAgent?: string | null
}

export interface ConsentState {
	id: string
	userId: string | null
	anonymousId: string | null
	version: string
	necessary: true
	functional: boolean
	analytics: boolean
	marketing: boolean
	recordedAt: Date
	updatedAt: Date
}

/**
 * Upsert a consent record. Authenticated users are matched by userId;
 * anonymous visitors by anonymousId. Returns the resulting record.
 */
export async function upsertConsent(
	params: UpsertConsentParams
): Promise<ConsentState> {
	const db = getDbClient()
	const { userId, anonymousId, choices, version, ipCountry, userAgent } = params
	const resolvedVersion = version ?? CONSENT_POLICY_VERSION
	const now = new Date()

	const sharedValues = {
		version: resolvedVersion,
		necessary: true as const,
		functional: choices.functional,
		analytics: choices.analytics,
		marketing: choices.marketing,
		ipCountry: ipCountry ?? null,
		userAgent: userAgent ?? null,
		updatedAt: now
	}

	if (userId) {
		// Authenticated path: upsert on userId only.
		// Never store anonymousId on authenticated rows — it may already belong
		// to a prior anonymous consent record, causing a unique-constraint clash.
		const [row] = await db
			.insert(consentRecords)
			.values({ ...sharedValues, userId, anonymousId: null, recordedAt: now })
			.onConflictDoUpdate({
				target: consentRecords.userId,
				set: {
					functional: sharedValues.functional,
					analytics: sharedValues.analytics,
					marketing: sharedValues.marketing,
					version: sharedValues.version,
					ipCountry: sharedValues.ipCountry,
					userAgent: sharedValues.userAgent,
					updatedAt: now
				}
			})
			.returning()

		return row as ConsentState
	} else {
		// Anonymous path: upsert on anonymousId
		const resolvedAnonymousId = anonymousId ?? randomUUID()
		const [row] = await db
			.insert(consentRecords)
			.values({
				...sharedValues,
				userId: null,
				anonymousId: resolvedAnonymousId,
				recordedAt: now
			})
			.onConflictDoUpdate({
				target: consentRecords.anonymousId,
				set: {
					functional: sharedValues.functional,
					analytics: sharedValues.analytics,
					marketing: sharedValues.marketing,
					version: sharedValues.version,
					ipCountry: sharedValues.ipCountry,
					userAgent: sharedValues.userAgent,
					updatedAt: now
				}
			})
			.returning()

		return { ...row, anonymousId: resolvedAnonymousId } as ConsentState
	}
}

/**
 * Read the most recent consent record for a user or anonymous visitor.
 * Returns null if no record exists (banner not yet shown / answered).
 */
export async function getConsent(
	userId: string | null,
	anonymousId: string | null
): Promise<ConsentState | null> {
	const db = getDbClient()

	if (userId) {
		const rows = await db
			.select()
			.from(consentRecords)
			.where(eq(consentRecords.userId, userId))
			.limit(1)

		return (rows[0] as ConsentState | undefined) ?? null
	}

	if (anonymousId) {
		const rows = await db
			.select()
			.from(consentRecords)
			.where(eq(consentRecords.anonymousId, anonymousId))
			.limit(1)

		return (rows[0] as ConsentState | undefined) ?? null
	}

	return null
}
