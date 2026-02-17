import { relations } from 'drizzle-orm'

import { organizationMemberships } from './core/organization-memberships'
import { organizations } from './core/organizations'
import { users } from './core/users'
import { assets } from './project/assets'
import { folders } from './project/folders'
import { projects } from './project/projects'
import { sceneAssets } from './project/scene-assets'
import { sceneFolders } from './project/scene-folders'
import { scenePublished } from './project/scene-published'
import { sceneSettings } from './project/scene-settings'
import { sceneStats } from './project/scene-stats'
import { scenes } from './project/scenes'

// Organization relations
export const organizationsRelations = relations(
	organizations,
	({ one, many }) => ({
		owner: one(users, {
			fields: [organizations.ownerId],
			references: [users.id]
		}),
		projects: many(projects),
		memberships: many(organizationMemberships)
	})
)

// User relations
export const usersRelations = relations(users, ({ many }) => ({
	sceneFolders: many(sceneFolders),
	sceneSettings: many(sceneSettings),
	sceneStats: many(sceneStats),
	scenePublished: many(scenePublished),
	organizationMemberships: many(organizationMemberships)
}))

// Organization membership relations
export const organizationMembershipsRelations = relations(
	organizationMemberships,
	({ one }) => ({
		user: one(users, {
			fields: [organizationMemberships.userId],
			references: [users.id]
		}),
		organization: one(organizations, {
			fields: [organizationMemberships.organizationId],
			references: [organizations.id]
		}),
		inviter: one(users, {
			fields: [organizationMemberships.invitedBy],
			references: [users.id]
		})
	})
)

// Project relations
export const projectsRelations = relations(projects, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [projects.organizationId],
		references: [organizations.id]
	}),
	scenes: many(scenes),
	sceneFolders: many(sceneFolders)
}))

// Scene relations
export const scenesRelations = relations(scenes, ({ one, many }) => ({
	project: one(projects, {
		fields: [scenes.projectId],
		references: [projects.id]
	}),
	folder: one(sceneFolders, {
		fields: [scenes.folderId],
		references: [sceneFolders.id]
	}),
	sceneSettings: many(sceneSettings),
	sceneStats: many(sceneStats),
	published: one(scenePublished, {
		fields: [scenes.id],
		references: [scenePublished.sceneId]
	})
}))

// Scene folder relations
export const sceneFoldersRelations = relations(
	sceneFolders,
	({ one, many }) => ({
		project: one(projects, {
			fields: [sceneFolders.projectId],
			references: [projects.id]
		}),
		owner: one(users, {
			fields: [sceneFolders.ownerId],
			references: [users.id]
		}),
		parent: one(sceneFolders, {
			fields: [sceneFolders.parentFolderId],
			references: [sceneFolders.id]
		}),
		children: many(sceneFolders),
		scenes: many(scenes)
	})
)

// Scene settings relations
export const sceneSettingsRelations = relations(
	sceneSettings,
	({ one, many }) => ({
		scene: one(scenes, {
			fields: [sceneSettings.sceneId],
			references: [scenes.id]
		}),
		createdByUser: one(users, {
			fields: [sceneSettings.createdBy],
			references: [users.id]
		}),
		sceneAssets: many(sceneAssets)
	})
)

// Scene assets relations
export const sceneAssetsRelations = relations(sceneAssets, ({ one }) => ({
	sceneSettings: one(sceneSettings, {
		fields: [sceneAssets.sceneSettingsId],
		references: [sceneSettings.id]
	}),
	asset: one(assets, {
		fields: [sceneAssets.assetId],
		references: [assets.id]
	})
}))

// Asset relations
export const assetsRelations = relations(assets, ({ one, many }) => ({
	folder: one(folders, {
		fields: [assets.folderId],
		references: [folders.id]
	}),
	owner: one(users, {
		fields: [assets.ownerId],
		references: [users.id]
	}),
	sceneAssets: many(sceneAssets),
	publishedScenes: many(scenePublished)
}))

// Folder relations
export const foldersRelations = relations(folders, ({ one, many }) => ({
	project: one(projects, {
		fields: [folders.projectId],
		references: [projects.id]
	}),
	parent: one(folders, {
		fields: [folders.parentFolderId],
		references: [folders.id]
	}),
	children: many(folders),
	assets: many(assets)
}))

// Scene stats relations
export const sceneStatsRelations = relations(sceneStats, ({ one }) => ({
	scene: one(scenes, {
		fields: [sceneStats.sceneId],
		references: [scenes.id]
	}),
	createdByUser: one(users, {
		fields: [sceneStats.createdBy],
		references: [users.id]
	})
}))

// Scene published relations
export const scenePublishedRelations = relations(scenePublished, ({ one }) => ({
	scene: one(scenes, {
		fields: [scenePublished.sceneId],
		references: [scenes.id]
	}),
	asset: one(assets, {
		fields: [scenePublished.assetId],
		references: [assets.id]
	}),
	sceneSettings: one(sceneSettings, {
		fields: [scenePublished.sceneSettingsId],
		references: [sceneSettings.id]
	}),
	publishedByUser: one(users, {
		fields: [scenePublished.publishedBy],
		references: [users.id]
	})
}))
