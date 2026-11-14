import type { ViewerMessages } from './en'

/** The viewer's words in German. */
export const de: ViewerMessages = {
	tapToRotate: 'Zum Drehen tippen',
	clickToRotate: 'Zum Drehen klicken',
	doneRotating: 'Fertig',
	doneRotatingLabel: 'Fertig gedreht, zurück zum Scrollen',

	mouseRotate: 'zum Drehen ziehen',
	mouseZoom: 'zum Zoomen scrollen',
	mousePan: 'zum Verschieben mit rechter Maustaste ziehen',
	touchRotate: 'zum Drehen ziehen',
	touchZoom: 'zum Zoomen zwei Finger auf- oder zuziehen',
	touchPan: 'zum Verschieben mit zwei Fingern ziehen',
	keysRotate: 'mit den Pfeiltasten drehen',
	keysZoom: 'mit Plus und Minus zoomen',
	keysPan: 'mit Umschalt und Pfeiltasten verschieben',
	howToMove: 'Bedienung',
	howToMoveMouse: 'Maus',
	howToMoveTouch: 'Touch',
	howToMoveKeys: 'Tastatur',

	keyHelpRotate: 'Die Pfeiltasten drehen die Ansicht.',
	keyHelpPan: 'Umschalt und Pfeiltasten verschieben die Ansicht.',
	keyHelpZoom: 'Plus und Minus zoomen.',
	keyHelpHome: 'Pos1 setzt die Ansicht zurück.',
	viewerRole: '3D-Viewer',

	openInfo: 'Informationen öffnen',
	closeInfo: 'Informationen schließen',

	animationPlayback: 'Animationswiedergabe',
	playAnimation: 'Animation abspielen',
	pauseAnimation: 'Animation anhalten',
	restartAnimation: 'Animation neu starten',

	enterFullscreen: 'Vollbild öffnen',
	exitFullscreen: 'Vollbild beenden',

	cameras: 'Kameras',
	previousCamera: 'Vorherige Kamera',
	nextCamera: 'Nächste Kamera',
	chooseCamera: 'Kamera: {name}. Kamera wählen',
	unnamedCamera: 'Unbenannte Kamera',
	hotspotView: 'Hotspot-Ansicht',

	backToSceneView: 'Zurück zur Szenenansicht',
	viewingHotspot: 'Ansicht: {name}',

	hotspot: 'Hotspot',
	hotspotHidden: '{name}, ausgeblendet',
	hotspotStep: '{name}, Schritt {step} von {count}',

	renderFailed: 'Diese Szene kann auf diesem Gerät nicht angezeigt werden.',
	tryAgain: 'Erneut versuchen',

	loadingThumbnailAlt: 'Vorschaubild, während der Viewer lädt',

	loading: 'Wird geladen',
	loadDownloading: 'Wird heruntergeladen',
	loadReading: 'Modell wird gelesen',
	loadPreparing: 'Szene wird vorbereitet',
	loadBytes: '{loaded} von {total}',
	loadFiles: '{loaded} von {total} Dateien'
}
