/**
 * Field-level validation for the sign-up form.
 *
 * Pure and free of any server import, so a spec can reach it - the route module
 * that used to hold this cannot be imported by a test, because `getDbClient()`
 * throws at module scope.
 */

export interface SignupFieldErrors {
	email?: string
	password?: string
	confirmPassword?: string
	tos?: string
}

export interface SignupValues {
	name: string
	email: string
	password: string
}

export interface SignupValidation {
	errors: SignupFieldErrors
	data: SignupValues
}

const asString = (value: FormDataEntryValue | null): string =>
	typeof value === 'string' ? value : ''

export function validateSignup(formData: FormData): SignupValidation {
	const errors: SignupFieldErrors = {}

	const name = formData.get('name')
	const email = formData.get('email')
	const password = formData.get('password')
	const confirmPassword = formData.get('confirm_password')
	const tosAccepted = formData.get('tos_accepted')

	/*
	  Name is deliberately absent from this list. Nothing downstream requires it:
	  `ensureUserExistsDb` falls back to the email address and then to a literal,
	  which is what satisfies the NOT NULL `users.name` column, and onboarding
	  falls back to the email's local part. Asking for it was one more field
	  between a visitor and an account.

	  The caller omits an empty name from Supabase's user metadata rather than
	  storing `''`, because those two fallbacks disagree about what "missing"
	  means - one tests truthiness, the other nullishness.
	*/
	if (!email || typeof email !== 'string' || !email.includes('@')) {
		errors.email = 'Please enter a valid email address.'
	}
	if (!password || typeof password !== 'string' || password.length < 8) {
		errors.password = 'Password must be at least 8 characters long.'
	}
	if (
		!confirmPassword ||
		typeof confirmPassword !== 'string' ||
		confirmPassword !== password
	) {
		errors.confirmPassword = 'Passwords do not match.'
	}
	if (!tosAccepted || tosAccepted !== 'on') {
		errors.tos =
			'You must accept the Terms of Service and Privacy Policy to create an account.'
	}

	return {
		errors,
		data: {
			name: asString(name).trim(),
			email: asString(email),
			password: asString(password)
		}
	}
}
