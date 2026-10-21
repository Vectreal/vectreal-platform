import { Client, InMemoryTransport } from '@modelcontextprotocol/client'
import { createVectrealClient } from '@vctrl/sdk'
import { afterEach, describe, expect, it } from 'vitest'

import { NotSignedInError } from '../errors'
import { OPERATIONS, type OperationContext } from '../operations'
import { createVectrealMcpServer } from './register-operations'

const ORIGIN = 'https://vectreal.test'
const me = {
	user: { id: 'u1', email: 'ada@example.test' },
	organization: { id: 'o1', name: 'Acme', role: 'owner' },
	client: { id: 'cli-client' },
	scopes: ['projects:read'],
	plan: { plan: 'pro', billingState: 'active' }
}

let close: (() => Promise<void>) | undefined
afterEach(async () => {
	await close?.()
	close = undefined
})

/** A connected client, against the API answers in `api`, keyed by method and path. */
async function connect(
	api: Record<string, () => Response>,
	getAccessToken: () => Promise<string> = async () => 'token-1'
) {
	const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = new Request(input, init)
		const answer = api[`${request.method} ${new URL(request.url).pathname}`]
		return answer
			? answer()
			: Response.json({ success: false, error: 'Not found' }, { status: 404 })
	}) as typeof fetch
	const context: OperationContext = {
		origin: ORIGIN,
		client: createVectrealClient({
			baseUrl: ORIGIN,
			fetch: fetchImpl,
			getAccessToken
		}),
		projectDir: '/work',
		fetch: fetchImpl,
		readFile: async () => new Uint8Array(),
		exportForPublish: async (glb) => glb,
		readModel: async () => {
			throw new Error('not read here')
		}
	}
	const server = createVectrealMcpServer(OPERATIONS, context, '0.0.0')
	const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
	await server.connect(serverSide)
	const client = new Client({ name: 'spec', version: '0.0.0' })
	await client.connect(clientSide)
	close = async () => {
		await client.close()
		await server.close()
	}
	return client
}

const text = (result: { content?: unknown }) =>
	(result.content as Array<{ type: string; text: string }>)[0].text

describe('the vectreal MCP server', () => {
	it('lists every operation with its input schema, and marks the reads and the one destructive call', async () => {
		const client = await connect({})

		const { tools } = await client.listTools()

		expect(tools.map(({ name }) => name)).toEqual(
			OPERATIONS.map(({ name }) => name)
		)
		const tool = (name: string) => tools.find((t) => t.name === name)!
		expect(tool('publish_scene').inputSchema).toMatchObject({
			type: 'object',
			required: expect.arrayContaining(['sceneId', 'path'])
		})
		expect(tool('whoami').annotations).toMatchObject({
			readOnlyHint: true,
			destructiveHint: false
		})
		expect(tool('unpublish_scene').annotations).toMatchObject({
			readOnlyHint: false,
			destructiveHint: true
		})
	})

	it("answers a call with the operation's result as JSON", async () => {
		const client = await connect({
			'GET /api/v1/me': () => Response.json({ success: true, data: me })
		})

		const result = await client.callTool({ name: 'whoami', arguments: {} })

		expect(result.isError).toBeFalsy()
		expect(JSON.parse(text(result))).toEqual(me)
	})

	it('answers a refusal as an error result naming its code and reason, such as a missing scope', async () => {
		const client = await connect({
			'GET /api/v1/projects': () =>
				Response.json(
					{
						success: false,
						error: 'This needs the projects:write scope.',
						code: 'insufficient_scope'
					},
					{ status: 403 }
				)
		})

		const result = await client.callTool({
			name: 'list_projects',
			arguments: {}
		})

		expect(result.isError).toBe(true)
		expect(text(result)).toBe(
			'The server refused (403, insufficient_scope): This needs the projects:write scope.'
		)
	})

	it('tells the agent to have the user sign in when there is no session', async () => {
		const client = await connect({}, async () => {
			throw new NotSignedInError(ORIGIN)
		})

		const result = await client.callTool({ name: 'whoami', arguments: {} })

		expect(result.isError).toBe(true)
		expect(text(result)).toBe(`Not signed in to ${ORIGIN}. Run: vectreal login`)
	})

	it('refuses input its schema rejects without calling the API', async () => {
		let called = false
		const client = await connect({
			'PATCH /api/v1/scenes/s1/settings': () => {
				called = true
				return Response.json({ success: true, data: {} })
			}
		})

		const result = await client.callTool({
			name: 'update_scene_settings',
			arguments: { sceneId: 's1', settings: { camera: {} } }
		})

		expect(result.isError).toBe(true)
		expect(called).toBe(false)
	})
})
