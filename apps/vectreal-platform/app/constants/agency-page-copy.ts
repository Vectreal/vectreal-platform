// ---------------------------------------------------------------------------
// Agency page (`/agenturen`)
//
// Where an agency letter's short address forwards. German only, like the
// agency letters, and Moritz's own voice. Approved by Moritz on 10 Nov; from
// here on this file is the only version, and changes go through a PR.
//
// The page was restructured for the phone on 11 Nov: hero, three steps, the
// three ways as cards, the terms in one card, the details as questions. Every
// sentence below comes from the approved copy, shortened or moved; the
// marketing rewrite replaces them when it lands.
//
// Its own module rather than a block in `product-copy.ts`, which every
// marketing page bundles: only this route should pay for these strings.
// ---------------------------------------------------------------------------

const LEAD =
	'Ich mache aus drei Fotos eines Produkts ein 3D-Modell, das Kundinnen und Kunden im Shop selbst drehen können. Für Agenturen mache ich das unter Ihrem Namen: Sie bieten es Ihren Kunden an, ich liefere Ihnen die Dateien.'

const GUIDE_HREF =
	'/docs/guides/publish-embed#shopify-a-section-that-tours-the-scene-on-scroll'

/** The three ways a model reaches a client's store, each shown by a short loop from the Dawn harness. */
export type AgencyWayId = 'shopify-3d-slot' | 'scene-tour' | 'gallery-slide'

export const AGENCY_PAGE_COPY = {
	meta: {
		title: '3D-Modelle für die Shopify-Shops Ihrer Kunden | Vectreal',
		description: LEAD
	},
	/** Opens the hero for a visit from one of our letters; the organization comes from the letter's code. */
	letterGreeting: (organization: string) => `Guten Tag, ${organization}.`,
	hero: {
		heading: '3D-Modelle für die Shopify-Shops Ihrer Kunden, unter Ihrem Namen',
		/** The hero's one sentence on the phone's first screen, beside the turning product. */
		lead: 'Ich mache aus drei Fotos eines Produkts ein 3D-Modell, das Kundinnen und Kunden im Shop selbst drehen können.',
		sceneLabel: 'Ein Beispielprodukt in 3D, zum Drehen'
	},
	steps: {
		heading: 'So läuft es',
		items: [
			'Sie schicken mir drei Fotos eines Produkts und bestätigen, dass Ihr Kunde einverstanden ist.',
			'Reichen die Fotos, haben Sie das Modell in zwei Werktagen, kostenlos, als GLB- und USDZ-Datei.',
			'Sie und Ihr Kunde entscheiden, ob es gut genug ist, bevor etwas live geht. Ihr Kunde sieht Ihren Namen, nicht meinen.'
		]
	},
	ways: {
		heading: 'So sieht es im Shop Ihres Kunden aus',
		intro: 'Drei Wege, die sich kombinieren lassen.',
		items: [
			{
				id: 'shopify-3d-slot',
				label: 'Shopifys eigener 3D-Platz',
				text: 'Das Modell kommt wie ein Foto in die Produktgalerie. Keine App und keine Theme-Änderung, wenn das Theme 3D-Modelle unterstützt.',
				video:
					'Ein Produkt in der Galerie eines Shopify-Shops auf dem Handy. Ein Wisch, und Shopifys eigener Viewer dreht das Modell.'
			},
			{
				id: 'scene-tour',
				label: 'Die Scroll-Tour',
				text: 'Ein Abschnitt unter den Produktdetails fährt beim Scrollen die Kameras der Szene an, zu jeder Station eine kurze Überschrift.',
				video:
					'Beim Scrollen fährt die Szene eine Kamera nach der anderen an, daneben steht zu jeder Station eine Überschrift.'
			},
			{
				id: 'gallery-slide',
				label: 'Die Szene in der Galerie',
				text: 'Ein Snippet setzt die Szene als eigene Ansicht neben die Fotos. Welche Szene ein Produkt zeigt, steht in einem Metafeld.',
				video:
					'In der Produktgalerie folgt auf die Fotos die 3D-Szene. Ein Tipp, und das Modell dreht sich.'
			}
		] satisfies readonly {
			id: AgencyWayId
			label: string
			text: string
			video: string
		}[],
		link: { label: 'Anleitung zum Einbauen (englisch)', href: GUIDE_HREF }
	},
	terms: {
		heading: 'So arbeiten wir zusammen',
		items: [
			'120 € pro Produkt, im Paket von 30 Produkten über sechs Monate',
			'fertig in fünf Arbeitstagen, als GLB- und USDZ-Datei',
			'White-Label für die Modelldateien',
			'gefällt ein Modell nicht, mache ich es neu, oder es kostet nichts'
		],
		contact:
			'Ich antworte werktags innerhalb eines Tages per E-Mail; ein Telefonat machen wir gern aus.'
	},
	faq: {
		heading: 'Häufige Fragen',
		items: [
			{
				question: 'Was kostet die 3D-Szene, und steht Vectreal darauf?',
				answer: [
					'Die Dateien im 3D-Platz gehören Ihrem Kunden, und Shopify hostet sie.',
					'Die 3D-Szene läuft bei Vectreal: bis zu drei veröffentlichte Szenen kostenlos, mit Vectreal-Hinweis. Ohne Hinweis und für mehr Szenen: sprechen Sie mich an.'
				]
			},
			{
				question: 'Wie wird es eingebaut?',
				answer: [
					'Für den 3D-Platz laden Sie die Dateien wie ein Foto als Produktmedium hoch. Alle Online-Store-2.0-Themes von Shopify zeigen sie.',
					'Die Scroll-Tour kommt einmal pro Theme als neue Datei in den Code-Editor, danach fügen Sie sie im Theme-Editor in die Produktvorlage ein. Die Domains des Shops müssen in den erlaubten Domains der Szene stehen.',
					'Für die Galerie kommt eine Zeile in das Galerie-Snippet des Themes; die Anleitung ist für Dawn, Shopifys Standard-Theme.',
					'Die Szene hat einen Namen und eine Beschreibung, die Screenreader vorlesen, lässt sich mit der Tastatur drehen und berücksichtigt die Einstellung für reduzierte Bewegung. Sie lädt auf der Seite des Shops keine Analyse-Software.'
				],
				link: { label: 'Anleitung zum Einbauen (englisch)', href: GUIDE_HREF }
			},
			{
				question: 'Gibt es einen Auftragsverarbeitungsvertrag?',
				answer: ['Ja, auf Wunsch.']
			},
			{
				question: 'Geht das auch mit Shopware?',
				answer: ['Auf Wunsch teste ich es mit Ihnen in Shopware.']
			},
			{
				question: 'Welche Produkte eignen sich?',
				answer: [
					'Greifbare Produkte mit festen Oberflächen: Möbel, Leuchten, Küche, Kaffee, Tierbedarf, Design. Glas, Emaille und Gusseisen sind schwierig; ob ein Produkt geht, sage ich Ihnen, bevor ich anfange.'
				]
			},
			{
				question: 'Sie haben einer Marke geschrieben, die ich betreue.',
				answer: ['Sagen Sie es mir: dann läuft alles Weitere über Sie.']
			}
		] satisfies readonly {
			question: string
			answer: readonly string[]
			link?: { label: string; href: string }
		}[]
	},
	request: {
		heading: 'Anfrage',
		body: 'Drei Fotos eines Produkts und das Einverständnis Ihres Kunden: Mehr brauche ich für das erste Modell nicht.',
		signature: 'Moritz Becker, Hamburg'
	},
	action: 'Kostenloses Modell anfragen'
} as const
