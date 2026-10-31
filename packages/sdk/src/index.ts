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

export {
	ENVIRONMENT_PRESETS,
	sceneBoundsSchema,
	sceneControlsSchema,
	SCENE_LIGHT_ROLES,
	sceneEnvironmentSchema,
	sceneLightingSchema,
	sceneLookSchema,
	sceneNormalizationSchema,
	sceneSettingsSchema,
	sceneShadowsSchema,
	updateSceneSettingsInputSchema
} from './scene-settings'
export type {
	SceneLook,
	SceneSettingsDocument,
	UpdateSceneSettingsInput
} from './scene-settings'

export { endedSessionSchema } from './session'
export type { EndedSession } from './session'

export {
	createdSceneSchema,
	createSceneInputSchema,
	sceneListSchema,
	scenePublicationSchema
} from './scenes'
export type {
	CreatedScene,
	CreateSceneInput,
	PublishSceneInput,
	SceneList,
	ScenePublication
} from './scenes'
