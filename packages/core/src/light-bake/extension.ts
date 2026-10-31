import {
	Extension,
	ExtensionProperty,
	PropertyType,
	TextureInfo,
	type IProperty,
	type Nullable,
	type ReaderContext,
	type Texture,
	type WriterContext
} from '@gltf-transform/core'

import { LIGHTMAP_EXTENSION } from '../scene-lighting/baked-lights'

interface ILightmap extends IProperty {
	lightmapTexture: Texture
	lightmapTextureInfo: TextureInfo
	scale: number
	signature: string
}

interface LightmapDef {
	lightmapTexture: { index: number; texCoord?: number }
	scale: number
	signature: string
}

/**
 * A material's baked studio lights: the diffuse light they deliver, read from
 * the first UV set, with the `scale` that turns its encoding back into light
 * and the `signature` of the lights it was baked from.
 */
export class Lightmap extends ExtensionProperty<ILightmap> {
	static override EXTENSION_NAME = LIGHTMAP_EXTENSION
	declare extensionName: typeof LIGHTMAP_EXTENSION
	declare propertyType: 'Lightmap'
	declare parentTypes: [PropertyType.MATERIAL]

	protected init(): void {
		this.extensionName = LIGHTMAP_EXTENSION
		this.propertyType = 'Lightmap'
		this.parentTypes = [PropertyType.MATERIAL]
	}

	protected override getDefaults(): Nullable<ILightmap> {
		return Object.assign(super.getDefaults(), {
			lightmapTexture: null,
			lightmapTextureInfo: new TextureInfo(this.graph, 'lightmapTextureInfo'),
			scale: 1,
			signature: ''
		})
	}

	getTexture(): Texture | null {
		return this.getRef('lightmapTexture')
	}

	getTextureInfo(): TextureInfo | null {
		return this.getRef('lightmapTexture')
			? this.getRef('lightmapTextureInfo')
			: null
	}

	setTexture(texture: Texture | null): this {
		return this.setRef('lightmapTexture', texture)
	}

	getScale(): number {
		return this.get('scale')
	}

	setScale(scale: number): this {
		return this.set('scale', scale)
	}

	getSignature(): string {
		return this.get('signature')
	}

	setSignature(signature: string): this {
		return this.set('signature', signature)
	}
}

/**
 * `VECTREAL_lightmap`: baked studio lights the Vectreal viewer draws, and any
 * other viewer ignores. Registered wherever a document is read or written, or
 * glTF-Transform drops it as unknown.
 */
export class VectrealLightmap extends Extension {
	static override EXTENSION_NAME = LIGHTMAP_EXTENSION
	public override readonly extensionName = LIGHTMAP_EXTENSION

	/*
	  Read and written in the mesh-stage hooks, as glTF-Transform's own
	  texture-carrying extensions are: the texture's definition has to exist
	  before `KHR_texture_basisu` runs, which moves a KTX2 image into its own
	  extension, or a KTX2 light map is written as a plain image no loader can
	  decode, and the whole model fails to load.
	*/
	public override readonly prereadTypes = [PropertyType.MESH]
	public override readonly prewriteTypes = [PropertyType.MESH]

	createLightmap(): Lightmap {
		return new Lightmap(this.document.getGraph())
	}

	read(): this {
		return this
	}

	write(): this {
		return this
	}

	override preread(context: ReaderContext): this {
		const { json } = context.jsonDoc
		const textureDefs = json.textures ?? []
		;(json.materials ?? []).forEach((materialDef, materialIndex) => {
			const def = materialDef.extensions?.[LIGHTMAP_EXTENSION] as
				LightmapDef | undefined
			if (!def) return
			const lightmap = this.createLightmap()
				.setScale(def.scale)
				.setSignature(def.signature)
			const source = textureDefs[def.lightmapTexture.index]?.source
			if (source !== undefined) {
				lightmap.setTexture(context.textures[source])
				context.setTextureInfo(lightmap.getTextureInfo()!, def.lightmapTexture)
			}
			context.materials[materialIndex].setExtension(
				LIGHTMAP_EXTENSION,
				lightmap
			)
		})
		return this
	}

	override prewrite(context: WriterContext): this {
		const { json } = context.jsonDoc
		for (const material of this.document.getRoot().listMaterials()) {
			const lightmap = material.getExtension<Lightmap>(LIGHTMAP_EXTENSION)
			const texture = lightmap?.getTexture()
			if (!lightmap || !texture) continue
			const materialDef =
				json.materials![context.materialIndexMap.get(material)!]
			materialDef.extensions ??= {}
			materialDef.extensions[LIGHTMAP_EXTENSION] = {
				lightmapTexture: context.createTextureInfoDef(
					texture,
					lightmap.getTextureInfo()!
				),
				scale: lightmap.getScale(),
				signature: lightmap.getSignature()
			} satisfies LightmapDef
		}
		return this
	}
}
