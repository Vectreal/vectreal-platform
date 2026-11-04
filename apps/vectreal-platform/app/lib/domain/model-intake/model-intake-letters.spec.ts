import {
	formatIntakeLetterMapping,
	parseIntakeLetterList
} from './model-intake-letters'

const HEADER = 'organization,recipient,code'

describe('parseIntakeLetterList', () => {
	it('reads one letter per line, with the code as printed', () => {
		expect(
			parseIntakeLetterList(
				`${HEADER}\nBrand GmbH,Erika Mustermann,k7q2m9\r\n"Müller, Schmidt & Co","Jan ""JJ"" Beck",AB12CD34\n\n`
			)
		).toEqual({
			ok: true,
			letters: [
				{
					organization: 'Brand GmbH',
					recipient: 'Erika Mustermann',
					code: 'K7Q2M9'
				},
				{
					organization: 'Müller, Schmidt & Co',
					recipient: 'Jan "JJ" Beck',
					code: 'AB12CD34'
				}
			]
		})
	})

	it('accepts the byte-order mark a spreadsheet export starts with', () => {
		expect(
			parseIntakeLetterList(`\uFEFF${HEADER}\nBrand GmbH,Erika,K7Q2M9`)
		).toMatchObject({ ok: true })
	})

	it('refuses a list without the header', () => {
		expect(parseIntakeLetterList('Brand GmbH,Erika,K7Q2M9')).toEqual({
			ok: false,
			errors: ['The first line must be organization,recipient,code.']
		})
		expect(parseIntakeLetterList('')).toMatchObject({ ok: false })
	})

	it('names every bad line and keeps none of the list', () => {
		const result = parseIntakeLetterList(
			[
				HEADER,
				'Brand GmbH,Erika,K7Q2M9',
				',Erika,ZZ12345',
				'Shop AG,Jan,ABC',
				'Shop AG,Jan,acme-1',
				'Shop AG,Jan,k7q2m9',
				'Shop AG,Jan'
			].join('\n')
		)
		expect(result).toEqual({
			ok: false,
			errors: [
				'Line 3: the organization is empty.',
				'Line 4: "ABC" is not a code (6 to 12 letters or digits).',
				'Line 5: "acme-1" is not a code (6 to 12 letters or digits).',
				'Line 6: K7Q2M9 is already on an earlier line.',
				'Line 7: expected 3 columns.'
			]
		})
	})
})

describe('formatIntakeLetterMapping', () => {
	it('writes a CSV that reads back the same names', () => {
		const csv = formatIntakeLetterMapping([
			{
				code: 'K7Q2M9',
				organization: 'Müller, Schmidt & Co',
				recipient: 'Jan "JJ" Beck',
				url: 'https://vectreal.com/free-model?c=K7Q2M9&lang=de',
				file: 'K7Q2M9.svg'
			}
		])
		expect(csv).toBe(
			'code,organization,recipient,url,file\n' +
				'K7Q2M9,"Müller, Schmidt & Co","Jan ""JJ"" Beck",https://vectreal.com/free-model?c=K7Q2M9&lang=de,K7Q2M9.svg\n'
		)
	})
})
