import { createHash } from 'node:crypto'
import { createServer, type Server } from 'node:http'

import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

import type { SecretStore } from './credentials'

/** A SecretStore in memory, for specs. */
export function memoryStore(): SecretStore & { entries: Map<string, string> } {
	const entries = new Map<string, string>()
	return {
		entries,
		get: (account) => entries.get(account) ?? null,
		set: (account, value) => {
			entries.set(account, value)
		},
		delete: (account) => {
			entries.delete(account)
		}
	}
}

/** A port nothing listens on right now. */
export async function freePort(): Promise<number> {
	const server = createServer()
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
	const { port } = server.address() as { port: number }
	await new Promise((resolve) => server.close(resolve))
	return port
}

export interface FakeAuthorizationServer {
	url: string
	/** Bodies posted to /oauth/token, parsed. */
	tokenRequests: URLSearchParams[]
	/** What /oauth/token answers next, in order; the last one repeats. */
	answers: Array<{ status: number; body: unknown }>
	close: () => Promise<void>
}

/**
 * An authorization server's token endpoint. An authorization_code request
 * gets an invalid_grant unless its verifier hashes to `challenge`, as a real
 * one checks.
 */
export async function fakeAuthorizationServer(
	expected: { challenge?: () => string | undefined } = {}
): Promise<FakeAuthorizationServer> {
	const fake: FakeAuthorizationServer = {
		url: '',
		tokenRequests: [],
		answers: [
			{
				status: 200,
				body: {
					access_token: 'access-1',
					refresh_token: 'refresh-1',
					expires_in: 3600
				}
			}
		],
		close: () => new Promise((resolve) => server.close(() => resolve()))
	}
	const server: Server = createServer((request, response) => {
		let raw = ''
		request.on('data', (chunk) => (raw += chunk))
		request.on('end', () => {
			const body = new URLSearchParams(raw)
			fake.tokenRequests.push(body)
			const challenge = expected.challenge?.()
			const verifier = body.get('code_verifier')
			const verified =
				body.get('grant_type') !== 'authorization_code' ||
				(verifier !== null &&
					createHash('sha256').update(verifier).digest('base64url') ===
						challenge)
			const answer = verified
				? (fake.answers.length > 1 ? fake.answers.shift() : fake.answers[0])!
				: {
						status: 400,
						body: {
							error: 'invalid_grant',
							error_description: 'PKCE check failed'
						}
					}
			response
				.writeHead(answer.status, { 'Content-Type': 'application/json' })
				.end(JSON.stringify(answer.body))
		})
	})
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
	fake.url = `http://127.0.0.1:${(server.address() as { port: number }).port}/auth/v1`
	return fake
}

/** A Document with one mesh whose POSITION is `points`, on its own node in the scene. */
export function meshDocument(points: number[][]) {
	const document = new Document()
	const buffer = document.createBuffer()
	const position = document
		.createAccessor()
		.setType('VEC3')
		.setArray(new Float32Array(points.flat()))
		.setBuffer(buffer)
	const primitive = document
		.createPrimitive()
		.setAttribute('POSITION', position)
	const mesh = document.createMesh().addPrimitive(primitive)
	const node = document.createNode().setMesh(mesh)
	document.createScene().addChild(node)
	return { document, buffer, primitive, mesh, node }
}

/** The eight corners of the box from `min` to `max`. */
export const corners = (min: number[], max: number[]) =>
	[0, 1, 2, 3, 4, 5, 6, 7].map((bits) =>
		[0, 1, 2].map((axis) => ((bits >> axis) & 1 ? max[axis] : min[axis]))
	)

/** A Document as GLB bytes, its extensions written. */
export const glbOf = (document: Document) =>
	new NodeIO().registerExtensions(ALL_EXTENSIONS).writeBinary(document)
