import { ModelExporter } from '@vctrl/core/model-exporter'
import { createNodePublishCodecs } from '@vctrl/core/node'

import { type OperationContext } from './operation'

/** The GLB read as the publisher's export reads it, Node's Draco decoder included. */
export const readModelInNode: OperationContext['readModel'] = (glb) =>
	new ModelExporter({
		dracoModules: createNodePublishCodecs().dracoModules
	}).readGlbDocument(glb)

/**
 * The publisher's export, run in Node: the same `exportGlbForPublish`, with
 * the Draco and KTX2 codecs Node needs in place of the browser's.
 */
export const exportForPublishInNode: OperationContext['exportForPublish'] =
	async (glb, { draco, ktx2 }) => {
		const { dracoModules, encodeKtx2 } = createNodePublishCodecs()
		const result = await new ModelExporter({
			dracoModules
		}).exportGlbForPublish(glb, {
			draco: draco ? {} : undefined,
			ktx2: ktx2 ? { encode: encodeKtx2 } : undefined
		})
		return result.data
	}
