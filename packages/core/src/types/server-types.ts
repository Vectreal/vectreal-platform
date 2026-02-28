/* vectreal-core | @vctrl/core
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>. */

/**
 * Configuration options for server-based operations.
 * Used across loading, optimization, and other server-dependent features.
 */
export interface ServerOptions {
	/** Whether to use the server for the operation */
	enabled?: boolean
	/** Server endpoint URL */
	endpoint?: string
	/** API key for authentication (if required) */
	apiKey?: string
	/** Search parameters to include in requests */
	searchParams?: Record<string, string>
	/** Additional headers to include in requests */
	headers?: Record<string, string>
}

/**
 * Standard API envelope for transport-level responses.
 * Supports both strict API responses and partially-wrapped payloads.
 */
export interface ApiEnvelope<T = unknown> {
	success?: boolean
	data?: T
	error?: string
	message?: string
}

/** HTTP status codes commonly used in API responses. */
export enum HttpStatusCode {
	OK = 200,
	CREATED = 201,
	BAD_REQUEST = 400,
	UNAUTHORIZED = 401,
	FORBIDDEN = 403,
	NOT_FOUND = 404,
	METHOD_NOT_ALLOWED = 405,
	INTERNAL_SERVER_ERROR = 500
}

/** Content types for API requests and responses. */
export enum ContentType {
	JSON = 'application/json',
	FORM_DATA = 'multipart/form-data',
	FORM_URLENCODED = 'application/x-www-form-urlencoded'
}
