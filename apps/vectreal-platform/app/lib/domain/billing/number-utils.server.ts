/**
 * Converts a bigint to a JavaScript number with an explicit safety guard.
 *
 * @param value - Bigint value loaded from the database.
 * @param fieldName - Field name used in the overflow error message.
 * @returns A safe integer number representation.
 * @throws {Error} When the bigint cannot be represented as a safe integer.
 */
export function toSafeNumberFromBigInt(
	value: bigint,
	fieldName: string
): number {
	const asNumber = Number(value)
	if (!Number.isSafeInteger(asNumber)) {
		throw new Error(
			`${fieldName} exceeds Number.MAX_SAFE_INTEGER and cannot be represented safely`
		)
	}
	return asNumber
}
