/* vectreal-core | vctrl/hooks
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>. */

import { EventData, EventHandler, EventTypes } from './types'

const listeners = {} as Record<EventTypes, EventHandler<EventTypes>[]>
const eventSystem = {
	emit<T extends EventTypes>(event: T, data?: EventData[T]): void {
		console.log('Emitting event:', event, data)
		const handlers = listeners[event]
		console.debug(`Event emitted: ${event}`, data)
		if (handlers) {
			handlers.forEach((handler) => handler(data))
		}
	},

	on<T extends EventTypes>(event: T, handler?: EventHandler<T>): void {
		if (!listeners[event]) {
			listeners[event] = []
		}
		listeners[event].push(handler as EventHandler<EventTypes>)
	},

	off<T extends EventTypes>(event: T, handler?: EventHandler<T>): void {
		const handlers = listeners[event]
		if (handlers) {
			listeners[event] = handlers.filter(
				(h) => h !== handler
			) as EventHandler<EventTypes>[]
		}
	}
}

export default eventSystem
