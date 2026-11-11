// ---------------------------------------------------------------------------
// Agency page (`/agenturen`)
//
// Where an agency letter's short address forwards. German only, like the
// agency letters, and Moritz's own voice.
//
// The funnel-polish copy of 11 Nov (the "German agency page" Work Item), with
// the steps cut to about eight words and the terms led by their numbers, as
// the 11 Nov review asked. The claims are those approved on 10 Nov; changes go
// through a PR.
//
// Its own module rather than a block in `product-copy.ts`, which every
// marketing page bundles: only this route should pay for these strings.
// ---------------------------------------------------------------------------

const HERO_SENTENCE =
	'Aus drei Fotos mache ich ein 3D-Modell, das Kundinnen und Kunden im Shop selbst drehen.'

const GUIDE_HREF =
	'/docs/guides/publish-embed#shopify-a-section-that-tours-the-scene-on-scroll'

/** The ways the scene reaches a client's store, each shown by a loop from the Shopify test page. */
export type AgencyWayId = 'scene-tour' | 'gallery-slide'

export const AGENCY_PAGE_COPY = {
	meta: {
		title: '3D-Modelle für die Shopify-Shops Ihrer Kunden | Vectreal',
		description: HERO_SENTENCE
	},
	/** Opens the hero for a visit from one of our letters; the organization comes from the letter's code. */
	letterGreeting: (organization: string) => `Guten Tag, ${organization}.`,
	hero: {
		heading: '3D-Modelle für die Shopify-Shops Ihrer Kunden, unter Ihrem Namen',
		lead: HERO_SENTENCE,
		video:
			'Ein Handy zeigt eine Produktseite im Beispielshop. Beim Scrollen fährt die 3D-Szene ihre Kameras an, zu jeder Station eine Überschrift.'
	},
	steps: {
		heading: "So geht's",
		items: [
			{
				id: 'photos',
				text: 'Drei Fotos eines Kundenprodukts, mit dem OK Ihres Kunden.',
				image: 'Ein Produkt von vorn, von der Seite und von hinten.'
			},
			{
				id: 'model',
				text: 'In zwei Werktagen ist das Modell fertig, kostenlos.',
				image: 'Das 3D-Modell des Produkts im Viewer.'
			},
			{
				id: 'store',
				text: 'Sie und Ihr Kunde entscheiden, bevor es live geht.',
				image: 'Das Produkt auf einer Produktseite im Beispielshop.'
			}
		]
	},
	ways: {
		heading: 'So sieht die Szene im Shop aus',
		intro:
			'Die GLB- und USDZ-Datei kommt in Shopifys eigenen 3D-Platz. Die 3D-Szene zeigt das Modell zusätzlich so:',
		items: [
			{
				id: 'scene-tour',
				label: 'Als Szene mit Kamerafahrt',
				text: 'Unter den Produktdetails fährt die Szene beim Scrollen ihre Kameras an; hält der Kunde an, kann er selbst drehen.',
				video:
					'Beim Scrollen fährt die Szene eine Kamera nach der anderen an, zu jeder Station eine Überschrift.'
			},
			{
				id: 'gallery-slide',
				label: 'Als Ansicht in der Galerie',
				text: 'Mit einer Zeile Theme-Code steht die Szene in Dawn neben den Fotos.',
				video:
					'In der Produktgalerie folgt auf das Foto die 3D-Szene. Ein Tipp öffnet sie, und das Modell dreht sich.'
			}
		] satisfies readonly {
			id: AgencyWayId
			label: string
			text: string
			video: string
		}[]
	},
	terms: {
		heading: 'Konditionen',
		figures: [
			{ value: '120 €', label: 'pro Produkt' },
			{ value: '30 Produkte', label: 'im Paket über sechs Monate' },
			{ value: '5 Arbeitstage', label: 'bis zur GLB- und USDZ-Datei' }
		],
		lines: [
			'White-Label für die Modelldateien',
			'Gefällt ein Modell nicht: neu oder kostenlos'
		]
	},
	faq: {
		heading: 'Häufige Fragen',
		items: [
			{
				question: 'Was kostet die 3D-Szene, und steht Vectreal darauf?',
				answer: [
					'Die Dateien im 3D-Platz gehören Ihrem Kunden, Shopify hostet sie. Die Szene läuft bei Vectreal, bis zu drei veröffentlichte Szenen kostenlos mit Vectreal-Hinweis; ohne Hinweis und für mehr sprechen Sie mich an.'
				]
			},
			{
				question: 'Wie kommt die Szene in den Shop?',
				answer: [
					'Der Abschnitt kommt einmal als Datei ins Theme und im Theme-Editor unter die Produktdetails. Für die Galerie-Ansicht kommt in Dawn eine Zeile ins Galerie-Snippet.'
				],
				link: { label: 'Anleitung zum Einbauen (englisch)', href: GUIDE_HREF }
			},
			{
				question: 'Gibt es einen Auftragsverarbeitungsvertrag?',
				answer: [
					'Ja, auf Wunsch. Die eingebettete Szene lädt auf der Seite des Shops keine Analyse-Software.'
				]
			},
			{
				question: 'Geht das auch mit Shopware?',
				answer: [
					'Abschnitt und Galerie-Ansicht sind für Shopify gebaut. Für Shopware mache ich auf Wunsch einen Test mit Ihnen.'
				]
			},
			{
				question: 'Welche Produkte eignen sich?',
				answer: [
					'Am besten feste Oberflächen wie Möbel, Leuchten oder Küchenware. Glas, Emaille und Gusseisen sind schwierig; ich sage Ihnen vorher, ob es geht.'
				]
			},
			{
				question: 'Schreiben Sie auch Marken direkt an?',
				answer: [
					'Einigen Marken habe ich direkt geschrieben. Betreuen Sie eine davon, sagen Sie es mir: dann läuft alles Weitere über Sie.'
				]
			}
		] satisfies readonly {
			question: string
			answer: readonly string[]
			link?: { label: string; href: string }
		}[]
	},
	request: {
		heading:
			'Drei Fotos und das Einverständnis Ihres Kunden: Mehr brauche ich für das erste Modell nicht.',
		contact:
			'Ich antworte werktags innerhalb eines Tages per E-Mail; ein Telefonat machen wir gern aus.',
		signature: 'Moritz Becker, Hamburg'
	},
	action: 'Kostenloses Modell anfragen'
} as const
