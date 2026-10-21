import { readDoc, searchDocs } from './docs'
import {
	createProject,
	createSceneFromFile,
	describeModel,
	getEmbedSnippet,
	getSceneSettings,
	listProjects,
	listScenes,
	publishScene,
	unpublishScene,
	updateSceneSettings,
	whoami
} from './scenes'

export { type Operation, type OperationContext } from './operation'

/** Every operation an agent can call, in the order a session tends to use them. */
export const OPERATIONS = [
	searchDocs,
	readDoc,
	whoami,
	listProjects,
	createProject,
	listScenes,
	createSceneFromFile,
	describeModel,
	getSceneSettings,
	updateSceneSettings,
	publishScene,
	unpublishScene,
	getEmbedSnippet
]
