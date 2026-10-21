import { McpServer } from '@modelcontextprotocol/server'

import { describeError } from '../errors'
import { type Operation, type OperationContext } from '../operations'

export const SERVER_INSTRUCTIONS = `Vectreal hosts 3D scenes that websites embed.
A typical session: create_scene_from_file with a local GLB, update_scene_settings to change its look, publish_scene with the same GLB, then get_embed_snippet.
Scenes live in projects; tools that take projectId default to the project vectreal init linked.
search_docs and read_doc need no sign-in. When a tool says the session is not signed in, ask the user to run: vectreal login`

/**
 * Serves `operations` as tools on `server`, each against `context`. Nothing
 * here knows the transport: stdio connects the server it returns, and a
 * remote endpoint can do the same with its own context.
 *
 * A failed call is a tool result marked as an error, worded as the CLI words
 * it, so the agent reads why (not signed in, a missing scope, a draft scene)
 * rather than a protocol error.
 */
export function registerOperations(
	server: McpServer,
	operations: readonly Operation[],
	context: OperationContext
): McpServer {
	for (const operation of operations) {
		server.registerTool(
			operation.name,
			{
				title: operation.title,
				description: operation.description,
				inputSchema: operation.input,
				annotations: {
					readOnlyHint: operation.readOnly,
					destructiveHint: operation.destructive,
					idempotentHint: operation.readOnly,
					openWorldHint: true
				}
			},
			async (input) => {
				try {
					const result = await operation.run(input, context)
					return {
						content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
					}
				} catch (error) {
					return {
						isError: true,
						content: [{ type: 'text', text: describeError(error) }]
					}
				}
			}
		)
	}
	return server
}

export function createVectrealMcpServer(
	operations: readonly Operation[],
	context: OperationContext,
	version: string
): McpServer {
	return registerOperations(
		new McpServer(
			{ name: 'vectreal', title: 'Vectreal', version },
			{ instructions: SERVER_INSTRUCTIONS }
		),
		operations,
		context
	)
}
