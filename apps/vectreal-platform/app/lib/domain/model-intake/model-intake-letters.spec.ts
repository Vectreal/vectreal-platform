import {
	formatIntakeLetterMapping,
	parseIntakeLetterList
} from './model-intake-letters'

const HEADER = 'organization,recipient,category,code'

function minter(...codes: string[]) {
	return () => {
		const next = codes.shift()
		if (!next) throw new Error('out of codes')
		return next
	}
}

describe('parseIntakeLetterList', () => {
	it('keeps a printed code and mints one for a row without', () => {
		expect(
			parseIntakeLetterList(
				`${HEADER}\nBrand GmbH,Erika Mustermann,shoes,k7q2m9ab\r\n"Müller, Schmidt & Co","Jan ""JJ"" Beck",furniture,\n\n`,
				minter('NEWCQDE2')
			)
		).toEqual({
			ok: true,
			letters: [
				{
					organization: 'Brand GmbH',
					recipient: 'Erika Mustermann',
					category: 'shoes',
					code: 'K7Q2M9AB'
				},
				{
					organization: 'Müller, Schmidt & Co',
					recipient: 'Jan "JJ" Beck',
					category: 'furniture',
					code: 'NEWCQDE2'
				}
			]
		})
	})

	it('finds columns by name, without a code column at all', () => {
		expect(
			parseIntakeLetterList(
				'category,organization,recipient\nbags,Shop AG,Jan',
				minter('AAAAAAAA')
			)
		).toEqual({
			ok: true,
			letters: [
				{
					organization: 'Shop AG',
					recipient: 'Jan',
					category: 'bags',
					code: 'AAAAAAAA'
				}
			]
		})
	})

	it('never mints a code the list already prints, nor the same one twice', () => {
		const result = parseIntakeLetterList(
			`${HEADER}\nA GmbH,Erika,shoes,\nB GmbH,Jan,shoes,K7Q2M9AB\nC GmbH,Ina,shoes,`,
			minter('K7Q2M9AB', 'BBBBBBBB', 'BBBBBBBB', 'CCCCCCCC')
		)
		expect(result.ok && result.letters.map((letter) => letter.code)).toEqual([
			'BBBBBBBB',
			'K7Q2M9AB',
			'CCCCCCCC'
		])
	})

	it('reads the mapping it writes, so a reprint keeps the codes', () => {
		const mapping = formatIntakeLetterMapping([
			{
				code: 'K7Q2M9AB',
				organization: 'Müller, Schmidt & Co',
				recipient: 'Jan "JJ" Beck',
				category: 'furniture',
				address: 'vectreal.com/c/K7Q2M9AB',
				file: 'K7Q2M9AB.svg'
			}
		])
		expect(parseIntakeLetterList(mapping, minter())).toEqual({
			ok: true,
			letters: [
				{
					organization: 'Müller, Schmidt & Co',
					recipient: 'Jan "JJ" Beck',
					category: 'furniture',
					code: 'K7Q2M9AB'
				}
			]
		})
	})

	it('accepts the byte-order mark a spreadsheet export starts with', () => {
		expect(
			parseIntakeLetterList(
				`${String.fromCharCode(0xfeff)}${HEADER}\nBrand GmbH,Erika,shoes,K7Q2M9AB`
			)
		).toMatchObject({ ok: true })
	})

	it('refuses a list without the named columns', () => {
		expect(parseIntakeLetterList('Brand GmbH,Erika,shoes')).toMatchObject({
			ok: false,
			errors: [
				expect.stringContaining('Missing: organization, recipient, category')
			]
		})
		expect(parseIntakeLetterList('')).toMatchObject({ ok: false })
	})

	it('names every bad line and keeps none of the list', () => {
		const result = parseIntakeLetterList(
			[
				HEADER,
				'Brand GmbH,Erika,shoes,K7Q2M9AB',
				',Erika,shoes,',
				'Shop AG,Jan,glass,',
				'Shop AG,Jan,shoes,K7Q2M9A0',
				'Shop AG,Jan,shoes,k7q2m9ab',
				'Shop AG,Jan,shoes',
				'"Two\nLines",Jan,shoes,'
			].join('\n'),
			minter()
		)
		expect(result).toEqual({
			ok: false,
			errors: [
				'Line 3: the organization is empty or spans lines.',
				expect.stringContaining('Line 4: "glass" is not a category'),
				'Line 5: "K7Q2M9A0" is not a letter code; leave it empty for a new one.',
				'Line 6: K7Q2M9AB is already on an earlier line.',
				'Line 7: expected 4 columns.',
				'Line 8: the organization is empty or spans lines.'
			]
		})
	})

	it('refuses a stray quote rather than reading the next lines into one field', () => {
		expect(
			parseIntakeLetterList(
				`${HEADER}\nCafé "Post,Erika,shoes,AAAAAAAA\nShop B",Jan,shoes,BBBBBBBB`
			)
		).toEqual({
			ok: false,
			errors: [
				'Line 2: a quote inside a field needs the whole field quoted, with the quote doubled.'
			]
		})
		expect(parseIntakeLetterList(`${HEADER}\n"Shop`)).toMatchObject({
			ok: false,
			errors: ['Line 2: a quoted field is never closed.']
		})
		expect(
			parseIntakeLetterList(`${HEADER}\n"Shop" AG,Jan,shoes,`)
		).toMatchObject({
			ok: false,
			errors: ['Line 2: text after a closing quote.']
		})
	})
})

describe('formatIntakeLetterMapping', () => {
	it('writes the address to print and escapes what needs it', () => {
		expect(
			formatIntakeLetterMapping([
				{
					code: 'K7Q2M9AB',
					organization: 'Müller, Schmidt & Co',
					recipient: 'Jan "JJ" Beck',
					category: 'furniture',
					address: 'vectreal.com/c/K7Q2M9AB',
					file: 'K7Q2M9AB.svg'
				}
			])
		).toBe(
			'code,organization,recipient,category,address,file\n' +
				'K7Q2M9AB,"Müller, Schmidt & Co","Jan ""JJ"" Beck",furniture,vectreal.com/c/K7Q2M9AB,K7Q2M9AB.svg\n'
		)
	})
})
