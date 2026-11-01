import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

import { VectrealLightmap } from './light-bake/extension'

/**
 * Every extension a Vectreal model may carry: the ones glTF-Transform ships,
 * and Vectreal's own baked lights. A reader or writer missing one drops it.
 */
export const IO_EXTENSIONS = [...ALL_EXTENSIONS, VectrealLightmap]
