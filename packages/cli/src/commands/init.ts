import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { z } from 'zod'

import {
	type CliContext,
	type GlobalOptions,
	report,
	signedInClient,
	targetOrigin
} from '../context'
import { readJson } from '../credentials'
import { UsageError } from '../errors'

/** Where a directory records its project: read by `vectreal mcp` and the scene commands. */
export const PROJECT_FILE = join('.vectreal', 'project.json')

const projectLinkSchema = z.object({
	origin: z.string(),
	projectId: z.string()
})

/** The project `vectreal init` linked `dir` to, or null. */
export function readProjectLink(
	dir: string
): z.infer<typeof projectLinkSchema> | null {
	const parsed = projectLinkSchema.safeParse(readJson(join(dir, PROJECT_FILE)))
	return parsed.success ? parsed.data : null
}

/**
 * Links the current directory to a project in the signed-in organization:
 * one named by `--project`, a new one from `--create`, or one picked from the
 * list.
 */
export async function init(
	context: CliContext,
	options: GlobalOptions & { project?: string; create?: string }
): Promise<number> {
	if (options.project && options.create) {
		throw new UsageError('Pass --project or --create, not both.')
	}
	const origin = targetOrigin(context, options)
	const client = signedInClient(context, origin)

	let project: { id: string; name: string }
	if (options.create) {
		project = (await client.createProject({ name: options.create })).project
	} else {
		const { projects } = await client.projects()
		if (options.project) {
			const found = projects.find(({ id }) => id === options.project)
			if (!found) {
				throw new UsageError(
					`No project ${options.project} in this organization.`
				)
			}
			project = found
		} else {
			project = await pickProject(context, projects, (name) =>
				client.createProject({ name }).then((created) => created.project)
			)
		}
	}

	mkdirSync(join(context.cwd, '.vectreal'), { recursive: true })
	writeFileSync(
		join(context.cwd, PROJECT_FILE),
		`${JSON.stringify({ origin, projectId: project.id }, null, '\t')}\n`
	)
	report(
		context,
		options,
		{ origin, project },
		`This directory now uses ${project.name} (${project.id}).`
	)
	return 0
}

async function pickProject(
	context: CliContext,
	projects: ReadonlyArray<{ id: string; name: string }>,
	create: (name: string) => Promise<{ id: string; name: string }>
): Promise<{ id: string; name: string }> {
	const { ask } = context
	if (!ask) {
		throw new UsageError(
			'No terminal to choose on: pass --project <id> or --create <name>.'
		)
	}
	context.err(
		[
			...projects.map(
				({ name, id }, index) => `  ${index + 1}. ${name} (${id})`
			),
			`  ${projects.length + 1}. Create a new project`
		].join('\n')
	)
	const choice = Number(await ask('Project number: '))
	if (choice >= 1 && choice <= projects.length) return projects[choice - 1]
	if (choice === projects.length + 1) {
		return create((await ask('Name for the new project: ')).trim())
	}
	throw new UsageError('Pick one of the numbers listed.')
}
