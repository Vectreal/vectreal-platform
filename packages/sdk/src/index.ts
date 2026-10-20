export { cliClientSchema } from './cli-client'
export type { CliClient } from './cli-client'

export {
	createVectrealClient,
	VectrealApiError,
	VectrealContractError
} from './client'
export type { VectrealClient, VectrealClientOptions } from './client'

export {
	allowedDomainsSchema,
	createdEmbedKeySchema,
	createEmbedKeyInputSchema,
	embedKeyListSchema,
	embedKeySchema,
	sceneEmbedSchema,
	setAllowedDomainsInputSchema
} from './embed'
export type {
	AllowedDomains,
	CreatedEmbedKey,
	CreateEmbedKeyInput,
	EmbedKey,
	EmbedKeyList,
	SceneEmbed,
	SetAllowedDomainsInput
} from './embed'

export { apiFailureSchema, apiSuccessSchema } from './envelope'
export type { ApiFailure } from './envelope'

export { API_ERROR_CODES } from './errors'
export type { ApiErrorCode } from './errors'

export { meSchema } from './me'
export type { Me } from './me'

export {
	createdProjectSchema,
	createProjectInputSchema,
	projectListSchema
} from './projects'
export type {
	CreatedProject,
	CreateProjectInput,
	ProjectList
} from './projects'

export { endedSessionSchema } from './session'
export type { EndedSession } from './session'

export {
	createdSceneSchema,
	createSceneInputSchema,
	scenePublicationSchema
} from './scenes'
export type {
	CreatedScene,
	CreateSceneInput,
	PublishSceneInput,
	ScenePublication
} from './scenes'
