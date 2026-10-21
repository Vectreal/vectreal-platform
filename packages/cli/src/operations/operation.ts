import { type Document } from '@gltf-transform/core'
import { type VectrealClient } from '@vctrl/sdk'
import { type z } from 'zod'

import { UsageError } from '../errors'

/**
 * Everything an operation reaches outside itself. Supplied by whoever serves
 * the operations: the stdio server builds it from the CLI's session and the
 * local disk, and a remote server would build its own.
 */
export interface OperationContext {
	/** The Vectreal server, such as `https://vectreal.com`. */
	origin: string
	/** Signs its requests with the user's session; fails when there is none. */
	client: VectrealClient
	/** The project `vectreal init` linked, used when a call names none. */
	defaultProjectId?: string
	/** Where relative file paths resolve, and where `vectreal init` ran. */
	projectDir: string
	fetch: typeof fetch
	readFile: (path: string) => Promise<Uint8Array>
	/** The publish export: what visitors load, from the GLB the scene was made from. */
	exportForPublish: (
		glb: Uint8Array,
		options: { draco: boolean; ktx2: boolean }
	) => Promise<Uint8Array>
	/** A GLB as a Document, its Draco or meshopt geometry decoded. */
	readModel: (glb: Uint8Array) => Promise<Document>
}

/** One thing an agent can do, independent of how it is asked. */
export interface Operation<Input extends z.ZodObject = z.ZodObject> {
	name: string
	title: string
	description: string
	input: Input
	/** Whether it only reads; a read is safe to retry and to run unprompted. */
	readOnly: boolean
	/** Whether it can take something away that a later call cannot bring back. */
	destructive: boolean
	run: (input: z.infer<Input>, context: OperationContext) => Promise<unknown>
}

/**
 * Keeps an operation's `run` typed by its own input while the list holds
 * operations of every input shape.
 */
export function defineOperation<Input extends z.ZodObject>(
	operation: Operation<Input>
): Operation {
	return operation as unknown as Operation
}

/** The project a call names, else the linked one. */
export function projectFor(
	projectId: string | undefined,
	context: OperationContext
): string {
	const id = projectId ?? context.defaultProjectId
	if (!id) {
		throw new UsageError(
			`No project: pass projectId, or run vectreal init in ${context.projectDir}.`
		)
	}
	return id
}
