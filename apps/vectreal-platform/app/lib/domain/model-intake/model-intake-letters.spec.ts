import {
	formatIntakeLetterMapping,
	type IntakeLetterRow,
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

function parse(text: string, ...codes: string[]) {
	return parseIntakeLetterList(text, 'de', minter(...codes))
}

describe('parseIntakeLetterList', () => {
	it('keeps a printed code and mints one for a row without', () => {
		expect(
			parse(
				`${HEADER}\nBrand GmbH,Erika Mustermann,shoes,k7q2m9ab\r\n"Müller, Schmidt & Co","Jan ""JJ"" Beck",furniture,\n\n`,
				'NEWCQDE2'
			)
		).toEqual({
			ok: true,
			passThrough: [],
			letters: [
				{
					organization: 'Brand GmbH',
					recipient: 'Erika Mustermann',
					audience: 'brand',
					category: 'shoes',
					showcase: null,
					code: 'K7Q2M9AB',
					locale: 'de',
					passThrough: []
				},
				{
					organization: 'Müller, Schmidt & Co',
					recipient: 'Jan "JJ" Beck',
					audience: 'brand',
					category: 'furniture',
					showcase: null,
					code: 'NEWCQDE2',
					locale: 'de',
					passThrough: []
				}
			]
		})
	})

	it('finds columns by name, and a row language wins over the run default', () => {
		expect(
			parse(
				'locale,category,organization,recipient\nen,bags,Shop AG,Jan\n,shoes,Laden GmbH,Ina',
				'AAAAAAAA',
				'BBBBBBBB'
			)
		).toEqual({
			ok: true,
			passThrough: [],
			letters: [
				{
					organization: 'Shop AG',
					recipient: 'Jan',
					audience: 'brand',
					category: 'bags',
					showcase: null,
					code: 'AAAAAAAA',
					locale: 'en',
					passThrough: []
				},
				{
					organization: 'Laden GmbH',
					recipient: 'Ina',
					audience: 'brand',
					category: 'shoes',
					showcase: null,
					code: 'BBBBBBBB',
					locale: 'de',
					passThrough: []
				}
			]
		})
	})

	it('never mints a code the list already prints, nor the same one twice', () => {
		const result = parse(
			`${HEADER}\nA GmbH,Erika,shoes,\nB GmbH,Jan,shoes,K7Q2M9AB\nC GmbH,Ina,shoes,`,
			'K7Q2M9AB',
			'BBBBBBBB',
			'BBBBBBBB',
			'CCCCCCCC'
		)
		expect(result.ok && result.letters.map((letter) => letter.code)).toEqual([
			'BBBBBBBB',
			'K7Q2M9AB',
			'CCCCCCCC'
		])
	})

	it('reads the Notion Letters export: headers in any case, its codes kept, every other column passed through', () => {
		const result = parse(
			[
				'Organization,Recipient,Salutation,Address,Audience,Category,Showcase,Code,Batch,First line',
				'Brand GmbH,Erika Mustermann,Sehr geehrte Frau Mustermann,"Hafenstr. 2, 20457 Hamburg",brand,shoes,lamp,k7q2m9ab,2026-11, Ihre Schuhe ',
				'Studio KG,Jan Beck,Hallo Jan,"Musterweg 1, 20095 Hamburg",agency,furniture,,,2026-11,Kurz gesagt'
			].join('\n'),
			'NEWCQDE2'
		)
		expect(result).toEqual({
			ok: true,
			passThrough: ['Salutation', 'postal_address', 'Batch', 'First line'],
			letters: [
				{
					organization: 'Brand GmbH',
					recipient: 'Erika Mustermann',
					audience: 'brand',
					category: 'shoes',
					showcase: 'lamp',
					code: 'K7Q2M9AB',
					locale: 'de',
					passThrough: [
						'Sehr geehrte Frau Mustermann',
						'Hafenstr. 2, 20457 Hamburg',
						'2026-11',
						' Ihre Schuhe '
					]
				},
				{
					organization: 'Studio KG',
					recipient: 'Jan Beck',
					audience: 'agency',
					category: 'furniture',
					showcase: null,
					code: 'NEWCQDE2',
					locale: 'de',
					passThrough: [
						'Hallo Jan',
						'Musterweg 1, 20095 Hamburg',
						'2026-11',
						'Kurz gesagt'
					]
				}
			]
		})
	})

	it('writes the postal Address as postal_address, keeping address for the short URL', () => {
		const result = parse(
			'organization,recipient,category,code,Address\nBrand GmbH,Erika,shoes,K7Q2M9AB,Hafenstr. 2'
		)
		if (!result.ok) throw new Error(result.errors.join())
		const mapping = formatIntakeLetterMapping(
			result.letters.map((letter) => ({
				...letter,
				address: 'vectreal.com/c/K7Q2M9AB',
				file: 'K7Q2M9AB.svg'
			})),
			result.passThrough
		)
		expect(mapping.split('\n')[0]).toBe(
			'code,organization,recipient,audience,category,showcase,locale,address,file,postal_address'
		)
		expect(mapping.split('\n')[1]).toContain(
			'vectreal.com/c/K7Q2M9AB,K7Q2M9AB.svg,Hafenstr. 2'
		)
	})

	it("passes an export's Address through as postal_address, beside its other columns", () => {
		expect(
			parse(
				'Organization,Recipient,Category,Address,Notes\nBrand GmbH,Erika,shoes,Hafenstr. 2,x',
				'AAAAAAAA'
			)
		).toMatchObject({ ok: true, passThrough: ['postal_address', 'Notes'] })
	})

	it.each([
		[
			'Organization,Recipient,Category,Address,file\nBrand GmbH,Erika,shoes,Hafenstr. 2,a.pdf',
			'file'
		],
		[
			'Organization,Recipient,Category,Address,File\nBrand GmbH,Erika,shoes,Hafenstr. 2,a.pdf',
			'File'
		],
		[
			'Organization,Recipient,Category,Address,Postal_Address\nBrand GmbH,Erika,shoes,Hafenstr. 2,x',
			'Postal_Address'
		],
		[
			'Organization,Recipient,Category,Notes,notes\nBrand GmbH,Erika,shoes,x,y',
			'notes'
		]
	])(
		'refuses a list whose column would appear twice in letters.csv',
		(text, column) => {
			expect(parse(text)).toEqual({
				ok: false,
				errors: [
					`The column "${column}" would appear twice in letters.csv. Rename it in the list.`
				]
			})
		}
	)

	it('writes its own address and file afresh when a mapping from before postal_address is fed back', () => {
		expect(
			parse(
				'code,organization,recipient,audience,category,locale,address,file\nK7Q2M9AB,Brand GmbH,Erika,brand,shoes,de,vectreal.com/c/K7Q2M9AB,K7Q2M9AB.svg'
			)
		).toMatchObject({
			ok: true,
			passThrough: [],
			letters: [{ passThrough: [] }]
		})
	})

	it('reads the mapping it writes, so a reprint keeps code, audience, showcase and language', () => {
		const letter: IntakeLetterRow = {
			code: 'K7Q2M9AB',
			organization: 'Müller, Schmidt & Co',
			recipient: 'Jan "JJ" Beck',
			audience: 'agency',
			category: 'furniture',
			showcase: 'lamp',
			locale: 'en',
			passThrough: ['Musterweg 1, 20095 Hamburg', 'Sehr geehrter Herr Beck,']
		}
		const mapping = formatIntakeLetterMapping(
			[{ ...letter, address: 'vectreal.com/c/K7Q2M9AB', file: 'K7Q2M9AB.svg' }],
			['postal_address', 'Salutation']
		)
		expect(parse(mapping)).toEqual({
			ok: true,
			letters: [letter],
			passThrough: ['postal_address', 'Salutation']
		})
	})

	it('reads an audience per row, and a row without one is a brand', () => {
		const result = parse(
			'organization,recipient,category,audience\nStudio KG,Jan,shoes,agency\nLaden GmbH,Ina,shoes,\nShop AG,Eva,bags,brand',
			'AAAAAAAA',
			'BBBBBBBB',
			'CCCCCCCC'
		)
		expect(
			result.ok && result.letters.map((letter) => letter.audience)
		).toEqual(['agency', 'brand', 'brand'])
		expect(
			parse('organization,recipient,category\nLaden GmbH,Ina,shoes', 'AAAAAAAA')
		).toMatchObject({ ok: true, letters: [{ audience: 'brand' }] })
	})

	it('reads a showcase per row, and a row without one has none', () => {
		const result = parse(
			'organization,recipient,category,showcase\nLaden GmbH,Ina,shoes,lamp\nShop AG,Eva,bags,',
			'AAAAAAAA',
			'BBBBBBBB'
		)
		expect(
			result.ok && result.letters.map((letter) => letter.showcase)
		).toEqual(['lamp', null])
	})

	it('refuses a showcase it does not know', () => {
		expect(
			parse(
				'organization,recipient,category,showcase\nLaden GmbH,Ina,shoes,sofa'
			)
		).toEqual({
			ok: false,
			errors: [
				'Line 2: "sofa" is not a showcase (lamp, fire, coffee, furniture).'
			]
		})
	})

	it('refuses an audience it does not know', () => {
		expect(
			parse(
				'organization,recipient,category,audience\nStudio KG,Jan,shoes,agentur'
			)
		).toEqual({
			ok: false,
			errors: ['Line 2: "agentur" is not an audience (brand, agency).']
		})
	})

	it('accepts the byte-order mark a spreadsheet export starts with', () => {
		expect(
			parse(
				`${String.fromCharCode(0xfeff)}${HEADER}\nBrand GmbH,Erika,shoes,K7Q2M9AB`
			)
		).toMatchObject({ ok: true })
	})

	it('refuses a list without the named columns', () => {
		expect(parse('Brand GmbH,Erika,shoes')).toMatchObject({
			ok: false,
			errors: [
				expect.stringContaining('Missing: organization, recipient, category')
			]
		})
		expect(parse('')).toMatchObject({ ok: false })
	})

	it('names every bad line and keeps none of the list', () => {
		expect(
			parse(
				[
					`${HEADER},locale`,
					'Brand GmbH,Erika,shoes,K7Q2M9AB,de',
					',Erika,shoes,,de',
					'Shop AG,Jan,glass,,de',
					'Shop AG,Jan,shoes,K7Q2M9A0,de',
					'Shop AG,Jan,shoes,k7q2m9ab,de',
					'Shop AG,Jan,shoes',
					'"Two\nLines",Jan,shoes,,de',
					'Shop AG,Jan,shoes,,fr'
				].join('\n')
			)
		).toEqual({
			ok: false,
			errors: [
				'Line 3: the organization is empty or spans lines.',
				expect.stringContaining('Line 4: "glass" is not a category'),
				'Line 5: "K7Q2M9A0" is not a letter code; leave it empty for a new one.',
				'Line 6: K7Q2M9AB is already on an earlier line.',
				'Line 7: expected 5 columns.',
				'Line 8: the organization is empty or spans lines.',
				'Line 9: "fr" is not a language (en, de).'
			]
		})
	})

	it('refuses a stray quote rather than reading the next lines into one field', () => {
		expect(
			parse(
				`${HEADER}\nCafé "Post,Erika,shoes,AAAAAAAA\nShop B",Jan,shoes,BBBBBBBB`
			)
		).toEqual({
			ok: false,
			errors: [
				'Line 2: a quote inside a field needs the whole field quoted, with the quote doubled.'
			]
		})
		expect(parse(`${HEADER}\n"Shop`)).toEqual({
			ok: false,
			errors: ['Line 2: a quoted field is never closed.']
		})
		expect(parse(`${HEADER}\n"Shop" AG,Jan,shoes,`)).toEqual({
			ok: false,
			errors: ['Line 2: text after a closing quote.']
		})
	})
})

describe('formatIntakeLetterMapping', () => {
	it('writes the address to print and escapes what needs it', () => {
		expect(
			formatIntakeLetterMapping(
				[
					{
						code: 'K7Q2M9AB',
						organization: 'Müller, Schmidt & Co',
						recipient: 'Jan "JJ" Beck',
						audience: 'agency',
						category: 'furniture',
						showcase: null,
						locale: 'de',
						passThrough: ['Musterweg 1, 20095 Hamburg'],
						address: 'vectreal.com/c/K7Q2M9AB',
						file: 'K7Q2M9AB.svg'
					}
				],
				['postal_address']
			)
		).toBe(
			'code,organization,recipient,audience,category,showcase,locale,address,file,postal_address\n' +
				'K7Q2M9AB,"Müller, Schmidt & Co","Jan ""JJ"" Beck",agency,furniture,,de,vectreal.com/c/K7Q2M9AB,K7Q2M9AB.svg,"Musterweg 1, 20095 Hamburg"\n'
		)
	})
})
