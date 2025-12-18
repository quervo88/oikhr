import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(routes), provideFirebaseApp(() => initializeApp({"projectId":"oik-hr","appId":"1:138094038678:web:8db26d090390f5688dfcb7","storageBucket":"oik-hr.firebasestorage.app","apiKey":"AIzaSyDms_Xs1P2YRFOAqSAv4CXlI5cGA4Mjquk","authDomain":"oik-hr.firebaseapp.com","messagingSenderId":"138094038678"})), provideAuth(() => getAuth()), provideFirestore(() => getFirestore()), provideFirebaseApp(() => initializeApp({"projectId":"oik-hr","appId":"1:138094038678:web:8db26d090390f5688dfcb7","storageBucket":"oik-hr.firebasestorage.app","apiKey":"AIzaSyDms_Xs1P2YRFOAqSAv4CXlI5cGA4Mjquk","authDomain":"oik-hr.firebaseapp.com","messagingSenderId":"138094038678"})), provideAuth(() => getAuth()), provideFirestore(() => getFirestore())]
};
