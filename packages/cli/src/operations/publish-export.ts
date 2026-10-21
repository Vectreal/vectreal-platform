import { ModelExporter } from '@vctrl/core/model-exporter'
import { createNodePublishCodecs } from '@vctrl/core/node'

import { type OperationContext } from './operation'

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
