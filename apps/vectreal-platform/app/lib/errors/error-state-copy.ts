import { isRouteErrorResponse } from 'react-router'

/**
 * What every public and embed error state says, in one place.
 *
 * Two surfaces, two tables. The public site can name what went wrong and
 * offer links. The embed renders inside somebody else's page, so it offers at
 * most one action and never a link, and its 404s say nothing about which
 * check failed: the person looking at a broken embed is not always the person
 * who owns it, and telling them whether a scene or key exists would make the
 * embed an id oracle.
 *
 * Both tables are total `Record`s, so a new kind does not compile until it
 * has copy. Pure, with no db import and no `.server` suffix, so a spec can
 * reach it.
 */

export interface ErrorCopy {
	heading: string
	description: string
}

export type PublicErrorKind = 'not_found' | 'forbidden' | 'server_error'

/** Also what the dashboard's route boundary says: one set of words per kind. */

export const PUBLIC_ERROR_COPY: Record<PublicErrorKind, ErrorCopy> = {
	not_found: {
		heading: 'This page does not exist',
		// The site 404 echoes the requested path into this sentence itself.
		description: 'The link may be out of date, or the address mistyped.'
	},
	forbidden: {
		heading: 'You do not have access to this page',
		description:
			'It exists, but not for this account. Sign in with another one, or ask whoever shared the link.'
	},
	server_error: {
		heading: 'Something went wrong on our side',
		description: 'The page did not load. Trying again usually works.'
	}
}

export function publicErrorKind(error: unknown): PublicErrorKind {
	if (isRouteErrorResponse(error)) {
		if (error.status === 404) return 'not_found'
		if (error.status === 403) return 'forbidden'
	}
	return 'server_error'
}

/**
 * Copy a loader wrote on purpose, when it threw a response with a string body.
 * An uncaught exception's message is never shown: it is written for whoever
 * reads a stack trace, and can name a module or carry a token.
 */
export function routeErrorDetail(error: unknown): string | undefined {
	if (!isRouteErrorResponse(error)) return undefined
	if (typeof error.data !== 'string') return undefined
	const detail = error.data.trim()
	return detail.length > 0 ? detail : undefined
}

/**
 * Where the guide explains the allowed embed domains, written out as text
 * because the embed frame never carries a link. The one address embed copy
 * may name: it is ours, the same for every project, and says nothing about
 * any project's list.
 */
export const EMBED_ALLOWED_DOMAINS_GUIDE =
	'vectreal.com/docs/guides/publish-embed#allowed-embed-domains'

/**
 * What a refused domain tells the person looking at the frame: which host was
 * refused, that the key is fine, and where the owner adds the host. The host is
 * the requesting page's own, so it discloses nothing that page did not know.
 * It reaches the page as React text, which escapes it.
 *
 * With no host, the page sent neither `Referer` nor `Origin`, and no entry on
 * the list can match a request that names no host. So that copy sends the
 * owner to the page's referrer policy instead of the list.
 */
export function domainNotAllowedDescription(host: string | null): string {
	const guide = `The guide covers it at ${EMBED_ALLOWED_DOMAINS_GUIDE}.`
	if (host === null) {
		return `This page did not say which site it is on, so it cannot be matched against this project's allowed embed domains. The key is valid. If you own the page, let it send its address: a no-referrer policy on the page or on the iframe blocks it. ${guide}`
	}
	return `${host} is not on this project's allowed embed domains. The key is valid. If you own the project, add ${host} to Allowed embed domains in the project's settings on the Vectreal dashboard. ${guide}`
}

export type EmbedErrorKind =
	'not_available' | 'domain_not_allowed' | 'busy' | 'load_failed'

export interface EmbedErrorCopy extends ErrorCopy {
	/** Only a failure that might be transient offers a way to try again. */
	retryable: boolean
}

export const EMBED_ERROR_COPY: Record<EmbedErrorKind, EmbedErrorCopy> = {
	not_available: {
		heading: 'This embed is not available',
		description: 'Check the embed code on this page.',
		retryable: false
	},
	domain_not_allowed: {
		heading: 'This site is not allowed to show this embed',
		/*
		  The host-less form, for a request that sent no `Referer` or `Origin`;
		  `domainNotAllowedDescription` names the host when there is one. Both
		  say the key is valid so nobody rotates a working key, and neither
		  names the list: echoing the allowed domains would hand an
		  unknown visitor the inventory of every site the owner embeds on.
		*/
		description: domainNotAllowedDescription(null),
		retryable: false
	},
	busy: {
		heading: 'This embed is busy right now',
		description: 'Too many requests reached it at once.',
		retryable: true
	},
	load_failed: {
		heading: 'This embed did not load',
		description:
			'The scene could not be fetched. It may be a passing network problem.',
		retryable: true
	}
}

/** The reason the embed loader states on every refusal it throws. */
export type EmbedRefusalReason = Exclude<EmbedErrorKind, 'load_failed'>

export function embedErrorKind(error: unknown): EmbedErrorKind {
	if (isRouteErrorResponse(error)) {
		const reason = (error.data as { reason?: unknown } | null)?.reason
		if (reason === 'domain_not_allowed') return 'domain_not_allowed'
		if (error.status === 429) return 'busy'
		if (error.status < 500) return 'not_available'
	}
	return 'load_failed'
}

/**
 * The host a domain refusal named, or `null` for any other error, so a host
 * is only ever shown beside the copy that explains it.
 */
export function embedRefusedHost(error: unknown): string | null {
	if (embedErrorKind(error) !== 'domain_not_allowed') return null
	const host = (error as { data: { host?: unknown } }).data.host
	return typeof host === 'string' && host.length > 0 ? host : null
}
