/* vectreal-core | @vctrl/core
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>. */

/**
 * "The model names files that did not come with it", as a fact rather than a
 * sentence.
 *
 * WHY THIS IS NOT A STRING COMPARISON. The refusal has several producers - the
 * glTF loader here and two in `@vctrl/hooks` - and the consumers that have to
 * tell it apart from a parse failure matched prose to do it. They matched the
 * scene payload builder's wording, so the loader's own refusal was filed as
 * "this file would not parse" and a visitor who dropped a perfectly valid folder
 * was told to check it was a valid glTF. The copy that names the real problem
 * was written, shipped and unreachable, on both the local and the server path.
 *
 * One producer is currently unreachable: `scene-data-builder`'s throw happens
 * inside the optimizer ingest, which logs and swallows it. It carries the marker
 * anyway, because the next person to rethrow it should not have to know.
 *
 * The name survives being wrapped, which the message alone does not: the
 * loader's throw reaches the caller inside a `Failed to load model from File
 * object:` wrapper, so the marker has to be looked for down the cause chain.
 */
const MISSING_ASSETS = 'MissingAssetsError'

/** The refusal, carrying the marker its consumers recognize it by. */
export function missingAssetsError(message: string): Error {
	const error = new Error(message)
	error.name = MISSING_ASSETS
	return error
}

/** Whether this failure, or anything it was wrapped around, is that refusal. */
export function isMissingAssetsError(error: unknown): boolean {
	let current = error

	/*
	  Bounded because this is exported. Nothing in this repo builds a cyclic
	  `cause` - every wrapper is a fresh `Error` - but a caller can, and an
	  unbounded walk hangs rather than answering.
	*/
	for (let hop = 0; hop < 16; hop += 1) {
		if (!(current instanceof Error)) return false
		if (current.name === MISSING_ASSETS) return true
		current = current.cause
	}

	return false
}
