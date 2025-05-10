import { USDZLoader } from 'three/examples/jsm/loaders/USDZLoader'

import eventSystem from '../event-system'

function createUsdzLoader() {
	const usdzLoader = new USDZLoader()

	usdzLoader.manager.onError = (url) => {
		eventSystem.emit('load-error', `Failed to load file ${url}`)
	}

	return usdzLoader
}

export default createUsdzLoader
