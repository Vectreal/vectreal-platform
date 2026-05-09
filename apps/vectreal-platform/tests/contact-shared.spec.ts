import {
	getContactSubmissionView,
	type ContactActionData
} from '../app/lib/domain/contact/contact-shared'

describe('getContactSubmissionView', () => {
	it('returns success for successful submissions', () => {
		const actionData: ContactActionData = {
			status: 'success'
		}

		expect(getContactSubmissionView(actionData)).toBe('success')
	})

	it('returns form when validation errors are present', () => {
		const actionData: ContactActionData = {
			status: 'error',
			formError: 'Invalid message',
			fieldErrors: {
				message: 'Please add at least 10 characters.'
			}
		}

		expect(getContactSubmissionView(actionData)).toBe('form')
	})

	it('returns error for terminal form errors without field errors', () => {
		const actionData: ContactActionData = {
			status: 'error',
			formError: 'We could not send your message right now.'
		}

		expect(getContactSubmissionView(actionData)).toBe('error')
	})
})
