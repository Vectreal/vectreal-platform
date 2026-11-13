// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { createRoutesStub } from 'react-router'
import { AuthenticityTokenProvider } from 'remix-utils/csrf/react'
import { describe, expect, it, vi } from 'vitest'

import { ModelIntakeForm } from './model-intake-form'
import { MODEL_INTAKE_CLIENT_CONSENT_COPY } from '../../constants/model-intake-client-consent-copy'

import type { ModelIntakeActionData } from '../../lib/domain/model-intake/model-intake-shared'

vi.mock('../turnstile-widget', () => ({ TurnstileWidget: () => null }))
// Radix's checkbox measures itself with a ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
}

const clientConsent = MODEL_INTAKE_CLIENT_CONSENT_COPY.de

const refusedFor = (
	fieldErrors: NonNullable<
		Extract<ModelIntakeActionData, { status: 'error' }>['fieldErrors']
	>
): ModelIntakeActionData => ({
	status: 'error',
	formError: 'validation',
	fieldErrors
})

function renderForm(
	asksClientConsent: boolean,
	actionData?: ModelIntakeActionData
) {
	const Stub = createRoutesStub([
		{
			path: '/free-model',
			Component: () => (
				<AuthenticityTokenProvider token="csrf">
					<ModelIntakeForm
						locale="de"
						batch="2026-10-30-agencies"
						letterCode="A7Q2M9AB"
						asksClientConsent={asksClientConsent}
						turnstileSiteKey=""
						turnstileToken={null}
						onTurnstileSuccess={() => {}}
						onTurnstileError={() => {}}
						turnstileFailed={false}
						turnstileResetNonce={0}
						isSubmitting={false}
						actionData={actionData}
					/>
				</AuthenticityTokenProvider>
			)
		}
	])
	render(<Stub initialEntries={['/free-model']} />)
}

describe('ModelIntakeForm, the client consent', () => {
	it('asks an agency for its client OK, as a required box', () => {
		renderForm(true)
		const box = screen.getByRole('checkbox', { name: clientConsent })
		expect(box).toBeRequired()
	})

	it('asks a brand nothing more', () => {
		renderForm(false)
		expect(
			screen.queryByRole('checkbox', { name: clientConsent })
		).not.toBeInTheDocument()
		expect(screen.getAllByRole('checkbox')).toHaveLength(2)
	})

	it('shows the box when the server refused its absence, even if the page lookup missed', () => {
		renderForm(false, refusedFor({ consentClient: 'consent' }))
		expect(
			screen.getByRole('checkbox', { name: clientConsent })
		).toBeInTheDocument()
	})

	it('keeps the box once shown when the next refusal is about something else', () => {
		function Refusals() {
			const [actionData, setActionData] = useState(
				refusedFor({ consentClient: 'consent' })
			)
			return (
				<AuthenticityTokenProvider token="csrf">
					<button
						type="button"
						onClick={() => setActionData(refusedFor({ photos: 'photosCount' }))}
					>
						next refusal
					</button>
					<ModelIntakeForm
						locale="de"
						batch="2026-10-30-agencies"
						letterCode="A7Q2M9AB"
						asksClientConsent={false}
						turnstileSiteKey=""
						turnstileToken={null}
						onTurnstileSuccess={() => {}}
						onTurnstileError={() => {}}
						turnstileFailed={false}
						turnstileResetNonce={0}
						isSubmitting={false}
						actionData={actionData}
					/>
				</AuthenticityTokenProvider>
			)
		}
		const Stub = createRoutesStub([
			{ path: '/free-model', Component: Refusals }
		])
		render(<Stub initialEntries={['/free-model']} />)
		fireEvent.click(screen.getByRole('button', { name: 'next refusal' }))
		expect(
			screen.getByRole('checkbox', { name: clientConsent })
		).toBeInTheDocument()
	})
})

describe('ModelIntakeForm, the link and the photos', () => {
	const photoInputs = () =>
		Array.from(
			document.querySelectorAll<HTMLInputElement>('input[name="photos"]')
		)

	it('requires the three photos while no link is given', () => {
		renderForm(false)
		expect(photoInputs()).toHaveLength(3)
		for (const input of photoInputs()) expect(input).toBeRequired()
	})

	it('stops requiring the photos once a link is typed, and requires them again when it is cleared', () => {
		renderForm(false)
		const link = screen.getByRole('textbox', { name: /Link zu 3D/ })
		fireEvent.change(link, { target: { value: 'https://cad.example.com' } })
		for (const input of photoInputs()) expect(input).not.toBeRequired()
		expect(
			screen.getByText(/Drei Fotos des Produkts \(optional\)/)
		).toBeInTheDocument()

		fireEvent.change(link, { target: { value: '' } })
		for (const input of photoInputs()) expect(input).toBeRequired()
	})

	it('names a refused link and keeps what was typed', () => {
		renderForm(false, {
			status: 'error',
			formError: 'validation',
			fieldErrors: { link: 'link' },
			fields: {
				name: '',
				email: '',
				company: '',
				productType: '',
				link: 'http://cad.example.com',
				height: '',
				width: '',
				depth: '',
				message: ''
			}
		})
		const link = screen.getByRole('textbox', { name: /Link zu 3D/ })
		expect(link).toHaveValue('http://cad.example.com')
		expect(link).toHaveAccessibleDescription(
			'Bitte geben Sie einen gültigen Link ein.'
		)
	})
})
