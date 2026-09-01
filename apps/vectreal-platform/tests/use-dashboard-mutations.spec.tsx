// @vitest-environment jsdom
/**
 * One handle per response, for the dashboard's create/rename/move/delete client.
 *
 * The sequence every defect case below drives is the one React Router actually
 * produces. `fetcher.state` is read from router state, which lands through
 * `startTransition`, while `fetcher.data` is read from a ref the router mutates
 * as it pushes that state - so after a submit the fetcher keeps reading `idle`
 * with the *previous* response for at least one commit, and a revalidation
 * settling in that window re-runs any effect watching the fetcher.
 *
 * That is why `state` is driven explicitly here instead of flipping inside
 * `submit`. Swap in a fixture where submitting is instantaneous and the window
 * disappears, taking the defect with it: every test below then passes against
 * the hook this replaced.
 */

import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDashboardMutations } from '../app/hooks/use-dashboard-mutations'

import type { DashboardMutationsApi } from '../app/hooks/use-dashboard-mutations'
import type {
	DashboardMutationRequest,
	DashboardMutationResponse
} from '../app/lib/domain/dashboard/dashboard-mutations'

const router = vi.hoisted(() => ({
	fetcher: { state: 'idle', data: undefined as unknown },
	revalidation: 'idle' as 'idle' | 'loading',
	revalidate: vi.fn()
}))

vi.mock('react-router', () => {
	let lastRevalidation: string | null = null
	let revalidator: unknown = null

	return {
		useFetcher: () => ({
			state: router.fetcher.state,
			data: router.fetcher.data,
			submit: () => {}
		}),
		useFetchers: () => [],
		/*
		  Memoized on the revalidation state, exactly as the real one is
		  (`useMemo([revalidate, state.revalidation])`). A fixture returning a
		  fresh object every render would re-run the effect on every commit and
		  a fixture returning a frozen one would never re-run it; only this
		  matches when React Router hands out a new identity.
		*/
		useRevalidator: () => {
			if (lastRevalidation !== router.revalidation) {
				lastRevalidation = router.revalidation
				revalidator = {
					state: router.revalidation,
					revalidate: router.revalidate
				}
			}
			return revalidator
		}
	}
})

vi.mock('remix-utils/csrf/react', () => ({
	useAuthenticityToken: () => 'csrf-token'
}))

const toasts = vi.hoisted(() => [] as string[])
vi.mock('sonner', () => ({
	toast: {
		success: (message: string) => toasts.push(`success:${message}`),
		warning: (message: string) => toasts.push(`warning:${message}`),
		error: (message: string) => toasts.push(`error:${message}`)
	}
}))

const handled: DashboardMutationResponse[] = []

function mount() {
	let api!: DashboardMutationsApi

	function Probe() {
		api = useDashboardMutations({
			onSuccess: (response) => handled.push(response)
		})
		return null
	}

	const view = render(<Probe />)
	const commit = () => act(() => void view.rerender(<Probe />))

	return {
		get api() {
			return api
		},
		submit: (request: DashboardMutationRequest) => {
			act(() => api.submit(request))
			commit()
		},
		/** The router's `submitting` state, one commit behind the click. */
		submitting: () => {
			act(() => {
				router.fetcher = { state: 'submitting', data: router.fetcher.data }
			})
			commit()
		},
		settle: (data: unknown) => {
			act(() => {
				router.fetcher = { state: 'idle', data }
			})
			commit()
		},
		revalidation: (state: 'idle' | 'loading') => {
			act(() => {
				router.revalidation = state
			})
			commit()
		}
	}
}

const deleteScene: DashboardMutationRequest = {
	verb: 'delete',
	targets: [{ type: 'scene', id: 'scene-1' }],
	confirmationText: null
}

/** Two deletes of the same scene return byte-identical bodies. */
const deleted = () => ({
	success: true as const,
	data: {
		verb: 'delete' as const,
		results: [{ type: 'scene' as const, id: 'scene-1', success: true }],
		summary: { total: 1, succeeded: 1, failed: 0 }
	}
})

const rejected = () => ({ success: false as const, error: 'Invalid CSRF token' })

beforeEach(() => {
	router.fetcher = { state: 'idle', data: undefined }
	router.revalidation = 'idle'
	router.revalidate.mockClear()
	toasts.length = 0
	handled.length = 0
})

describe('useDashboardMutations', () => {
	it('handles a settled response once', () => {
		const probe = mount()

		probe.submit(deleteScene)
		probe.submitting()
		const response = deleted()
		probe.settle(response)

		expect(handled).toEqual([response.data])
		expect(handled[0]).toBe(response.data)
		expect(toasts).toEqual(['success:Item deleted'])
		expect(router.revalidate).toHaveBeenCalledOnce()
	})

	/*
	  The defect. Deleting the same scene twice - or renaming a folder to the
	  name it already has - returns two responses with identical bodies, and a
	  content signature cannot tell them apart. The revalidation here is the one
	  the hook itself started on the first response; it settles while the fetcher
	  still reads idle with that first response, which is what re-runs the
	  effect inside the window.
	*/
	it('handles the second of two responses whose bodies are identical', () => {
		const probe = mount()

		probe.submit(deleteScene)
		probe.submitting()
		const first = deleted()
		probe.settle(first)
		probe.revalidation('loading')

		probe.submit(deleteScene)
		probe.revalidation('idle')
		probe.submitting()
		const second = deleted()
		probe.settle(second)

		/*
		  By identity, not value: the two bodies are deep-equal, so a hook that
		  handled the first response twice and dropped the second satisfies any
		  structural assertion written here.
		*/
		expect(handled).toHaveLength(2)
		expect(handled[0]).toBe(first.data)
		expect(handled[1]).toBe(second.data)
		expect(router.revalidate).toHaveBeenCalledTimes(2)
	})

	/*
	  The other half of the same defect: with the signature blanked on submit,
	  the response the fetcher is still carrying is handled a second time - the
	  row's spinner clears and the dialog closes before the server has answered.
	*/
	it('does not re-handle the response the fetcher still carries in flight', () => {
		const probe = mount()

		probe.submit(deleteScene)
		probe.submitting()
		probe.settle(deleted())
		probe.revalidation('loading')

		probe.submit(deleteScene)
		probe.revalidation('idle')

		expect(handled).toHaveLength(1)
	})

	/*
	  The identity comparison, which nothing else here reaches. The response a
	  component sees is stickier than the one the router holds: `RouterProvider`
	  copies a fetcher's data into a ref map only when it is not `undefined`
	  and never writes `undefined` back (`components.js:137`), and `useFetcher`
	  reads `data` from that map rather than from router state
	  (`dom/lib.js:997`). So once a response has landed it stays visible even
	  after the router clears the fetcher's own data - which is what answering
	  a submission with a redirect does (`router.js:841,847,850`) - and the
	  state cycling back to idle re-presents the object already handled. The
	  transition alone re-runs the effect; only comparing the object stops it.
	*/
	it('does not re-handle a response the fetcher settles back onto', () => {
		const probe = mount()

		probe.submit(deleteScene)
		probe.submitting()
		const response = deleted()
		probe.settle(response)
		expect(handled).toHaveLength(1)

		probe.submit(deleteScene)
		probe.submitting()
		// Superseded: the router marks the fetcher done carrying the response
		// it already had, rather than a new one.
		probe.settle(response)

		expect(handled).toHaveLength(1)
		expect(router.revalidate).toHaveBeenCalledOnce()
	})

	it('surfaces a rejection', () => {
		const probe = mount()

		probe.submit(deleteScene)
		probe.submitting()
		probe.settle(rejected())

		expect(handled).toHaveLength(0)
		expect(toasts).toEqual(['error:Invalid CSRF token'])
		expect(probe.api.lastError).toBe('Invalid CSRF token')
		expect(router.revalidate).not.toHaveBeenCalled()
	})

	it('does not revalidate when every target failed', () => {
		const probe = mount()

		probe.submit(deleteScene)
		probe.submitting()
		probe.settle({
			success: true as const,
			data: {
				verb: 'delete' as const,
				results: [
					{
						type: 'scene' as const,
						id: 'scene-1',
						success: false,
						code: 'forbidden' as const
					}
				],
				summary: { total: 1, succeeded: 0, failed: 1 }
			}
		})

		expect(handled).toHaveLength(0)
		expect(toasts).toEqual(['warning:0/1 deleted, 1 failed'])
		expect(router.revalidate).not.toHaveBeenCalled()
	})
})
