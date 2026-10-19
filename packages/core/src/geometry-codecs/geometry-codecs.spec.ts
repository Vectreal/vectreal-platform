import { WebIO } from '@gltf-transform/core'
import { describe, expect, it, vi } from 'vitest'

import { GeometryCodecs } from './geometry-codecs'

const { loadDracoModule } = vi.hoisted(() => ({
	loadDracoModule: vi.fn(async () => ({ from: 'browser scripts' }))
}))
vi.mock('../draco/load-draco-module', () => ({
	loadDracoModule,
	// Node is not a browser; the injected modules must not need one.
	canLoadDracoInBrowser: () => false
}))

describe('GeometryCodecs with Draco modules passed in', () => {
	it('registers each module once, never loading the browser scripts', async () => {
		const io = new WebIO()
		const register = vi.spyOn(io, 'registerDependencies')
		const encoder = { from: 'encoder' }
		const decoder = { from: 'decoder' }
		const dracoModules = {
			encoder: vi.fn(async () => encoder),
			decoder: vi.fn(async () => decoder)
		}
		const codecs = new GeometryCodecs(io, '/draco/', dracoModules)

		await codecs.registerDracoEncoder()
		await codecs.registerDracoEncoder()
		await codecs.registerDecoders(['KHR_draco_mesh_compression'])
		await codecs.registerDecoders(['KHR_draco_mesh_compression'])

		expect(dracoModules.encoder).toHaveBeenCalledOnce()
		expect(dracoModules.decoder).toHaveBeenCalledOnce()
		expect(register).toHaveBeenCalledWith({ 'draco3d.encoder': encoder })
		expect(register).toHaveBeenCalledWith({ 'draco3d.decoder': decoder })
		expect(loadDracoModule).not.toHaveBeenCalled()
	})

	it('still refuses Draco outside a browser when none were passed', async () => {
		const codecs = new GeometryCodecs(new WebIO(), '/draco/')

		await expect(codecs.registerDracoEncoder()).rejects.toThrow(
			/browser.*or Draco modules passed in/
		)
		expect(loadDracoModule).not.toHaveBeenCalled()
	})
})
