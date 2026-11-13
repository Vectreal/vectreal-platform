// ---------------------------------------------------------------------------
// Agency page (`/agenturen`)
//
// Where an agency letter's short address forwards. German only, like the
// agency letters. The page speaks without "ich" or "wir", unlike the letters
// (Moritz, 11 Nov): the product, the model, "Sie" and plain statements.
//
// The funnel-polish copy of 11 Nov (the "German agency page" Work Item), not
// yet read by Moritz, who approves it through the PR's screenshots. The terms
// lead with their numbers, as the 11 Nov review asked. Changes go through a PR.
//
// Its own module rather than a block in `product-copy.ts`, which every
// marketing page bundles: only this route should pay for these strings.
// ---------------------------------------------------------------------------

const HERO_SENTENCE =
	'Aus drei Fotos wird unter Ihrem Namen ein 3D-Modell, das Kundinnen und Kunden im Shop selbst drehen.'

const GUIDE_HREF =
	'/docs/guides/publish-embed#shopify-a-section-that-tours-the-scene-on-scroll'

/** The ways the model reaches a client's store, each shown by a loop from a Shopify store. */
export type AgencyWayId = 'shopify-slot' | 'scene-tour' | 'gallery-slide'

export const AGENCY_PAGE_COPY = {
	meta: {
		title: '3D-Modelle für die Shopify-Shops Ihrer Kunden | Vectreal',
		description: HERO_SENTENCE
	},
	/** Opens the hero for a visit from one of our letters; the organization comes from the letter's code. */
	letterGreeting: (organization: string) => `Guten Tag, ${organization}.`,
	hero: {
		heading: '3D-Modelle für Ihre Shopify-Kunden',
		lead: HERO_SENTENCE,
		sceneLabel: 'Ein Beispielprodukt in 3D, zum Drehen'
	},
	steps: {
		heading: "So geht's",
		items: [
			{
				id: 'photos',
				text: 'Sie schicken drei Fotos, mit dem Einverständnis Ihres Kunden.',
				image: 'Ein Produkt von vorn, von der Seite und von hinten.'
			},
			{
				id: 'model',
				text: 'Reichen die Fotos, kommt das Modell in zwei Werktagen.',
				image: 'Das 3D-Modell des Produkts im Viewer.'
			},
			{
				id: 'store',
				text: 'Erst wenn es passt, geht es im Shop live.',
				image: 'Das Produkt auf einer Produktseite im Beispielshop.'
			}
		] as readonly {
			id: string
			text: string
			/** Describes the step's still, which is also a loop's poster. */
			image: string
			/** What the step's loop shows, for a screen reader; a step without one shows its still. */
			video?: string
		}[]
	},
	ways: {
		heading: 'Drei Wege in den Shop',
		items: [
			{
				// Text only until the sample store exists: its capture then goes in as
				// `shopify-slot.mp4` and `.webp`, with a `video` line like the others.
				id: 'shopify-slot',
				label: 'Shopifys eigener 3D-Platz',
				text: 'Das Modell kommt wie ein Foto in die Galerie, ohne App und bei Shopifys eigenen Themes ohne Theme-Änderung.'
			},
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
			/** What the card's loop shows, for a screen reader; a card without one has no loop yet. */
			video?: string
		}[]
	},
	terms: {
		heading: 'Konditionen',
		/**
		 * Set large, each with its own line once it has one; until then the
		 * lines below say the same in words.
		 */
		figures: [
			{ value: '120 €' },
			{ value: '30 Produkte' },
			{ value: '5 Arbeitstage' }
		],
		lines: [
			'120 € pro Produkt, 30 Produkte über sechs Monate',
			'fertig in fünf Arbeitstagen, als GLB und USDZ',
			'White-Label für die Modelldateien',
			'gefällt ein Modell nicht: neu oder kostenlos'
		],
		/** Worked examples under the lines, such as what a delivery of five costs. */
		examples: []
	} as {
		heading: string
		figures: readonly { value: string; line?: string }[]
		lines: readonly string[]
		examples: readonly string[]
	},
	faq: {
		heading: 'Häufige Fragen',
		items: [
			{
				question: 'Was kostet die 3D-Szene, und steht Vectreal darauf?',
				answer: [
					'Die Dateien im 3D-Platz gehören Ihrem Kunden, Shopify hostet sie. Die Szene läuft bei Vectreal: bis zu drei veröffentlichte Szenen kostenlos mit Vectreal-Hinweis, ohne Hinweis und für mehr Szenen auf Anfrage.'
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
					'Abschnitt und Galerie-Ansicht sind für Shopify gebaut. Für Shopware ist auf Wunsch ein Test mit Ihnen möglich.'
				]
			},
			{
				question: 'Welche Produkte eignen sich?',
				answer: [
					'Am besten feste Oberflächen wie Möbel, Leuchten oder Küchenware. Glas, Emaille und Gusseisen sind schwierig; ob ein Produkt geht, erfahren Sie vor dem Start.'
				]
			},
			{
				question: 'Bekommen auch Marken direkt Post?',
				answer: [
					'Einige Marken haben einen Brief von Vectreal bekommen. Betreut Ihre Agentur eine davon, genügt eine kurze Nachricht: Dann läuft alles Weitere über Sie.'
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
			'Drei Fotos und das Einverständnis Ihres Kunden: Mehr braucht es für das erste Modell nicht.',
		contact:
			'Antwort werktags innerhalb eines Tages per E-Mail; ein Telefonat lässt sich gern vereinbaren.',
		signature: 'Vectreal, Hamburg'
	},
	action: 'Kostenloses Modell anfragen'
} as const
