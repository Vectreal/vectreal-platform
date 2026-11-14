/**
 * Parent of every `/api/v1` route. It renders nothing and only carries the
 * middleware that keeps each refusal in the coded envelope, including the
 * 405s and 500s React Router writes itself.
 */

import { agentApiEnvelopeMiddleware } from '../../../lib/domain/agent/agent-api-envelope'

export const middleware = [agentApiEnvelopeMiddleware]
