# @vctrl/sdk

The contract for Vectreal's agent API, `/api/v1`: zod schemas for every response and a typed client that parses them. The platform's routes answer through the same schemas, so a change to either side fails the other's type check.

Private for now. It ships to npm with the Vectreal CLI, which is its first consumer.

```ts
import { createVectrealClient } from '@vctrl/sdk'

const vectreal = createVectrealClient({
	baseUrl: 'https://vectreal.com',
	getAccessToken: () => token
})

const { organization, scopes } = await vectreal.me()
```

A refusal from the server throws `VectrealApiError` with its status and message. A body the client cannot read throws `VectrealContractError`, which means the client and server disagree on a shape, not that the request was refused.
