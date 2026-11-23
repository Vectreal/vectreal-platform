import { createContext } from 'react-router'

import type { AgentActor } from './agent-actor.server'
import type { RouterContextProvider } from 'react-router'

/**
 * Where `agentGate` leaves the actor it resolved. Pure, so a spec can hand a
 * handler the context the gate would have built without loading the gate.
 */
export const agentActorContext = createContext<AgentActor>()

/**
 * The actor `agentGate` resolved for this request. Throws outside a gated
 * route, so a handler can never run on an actor nobody checked.
 */
export function agentActorFrom(
	context: Readonly<RouterContextProvider>
): AgentActor {
	return context.get(agentActorContext)
}
