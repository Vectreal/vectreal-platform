import { initializeApp } from 'firebase/app'
import { getStorage } from 'firebase/storage'
// import { getAnalytics } from "firebase/analytics";

// interface IFirebase {
// 	app: ReturnType<typeof initializeApp>
// 	storage: ReturnType<typeof getStorage>
// }
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
	projectId: 'digitize-image',
	storageBucket: 'digitize-image.firebasestorage.app',
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY
}

export const firebase = initializeApp(firebaseConfig)
export const storage = getStorage(firebase)
