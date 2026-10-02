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
		  Says the key is valid so nobody rotates a working key, and names the
		  fix without naming the list: echoing the allowed domains would hand an
		  unknown visitor the inventory of every site the owner embeds on. Only
		  reachable after a live key matched this project, and before the scene
		  is looked up, so it discloses nothing about whether the scene exists.
		*/
		description:
			'The key is valid, but this page is not on the allowed domain list for this project. If you own it, add this site to its allowed domains in the Vectreal dashboard.',
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
