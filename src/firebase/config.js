import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// TODO: Replace this with your own project's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAdc3w9AtJHy4GY_gN1fkETh2q2tio1P6U",
    authDomain: "race-calendar-31795.firebaseapp.com",
    databaseURL: "https://race-calendar-31795-default-rtdb.firebaseio.com",
    projectId: "race-calendar-31795",
    storageBucket: "race-calendar-31795.firebasestorage.app",
    messagingSenderId: "591899921865",
    appId: "1:591899921865:web:680de18443b58c8af2ec18",
    measurementId: "G-64FS2V7ZTR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);

// Use initializeFirestore with settings optimized for Electron stability
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false, // Additional flag to ensure no stream logic is used
});

export const storage = getStorage(app);

export default app;
