import { Module, Global } from '@nestjs/common';
import * as admin from 'firebase-admin';

export const FIRESTORE = 'FIRESTORE';
export const FIREBASE_AUTH = 'FIREBASE_AUTH';

@Global()
@Module({
  providers: [
    {
      provide: FIRESTORE,
      useFactory: (): FirebaseFirestore.Firestore => {
        if (!admin.apps.length) {
          admin.initializeApp({
            projectId: process.env['FIREBASE_PROJECT_ID'] ?? 'my-compta-dev',
          });
        }
        return admin.firestore();
      },
    },
    {
      provide: FIREBASE_AUTH,
      useFactory: (): admin.auth.Auth => {
        if (!admin.apps.length) {
          admin.initializeApp({
            projectId: process.env['FIREBASE_PROJECT_ID'] ?? 'my-compta-dev',
          });
        }
        return admin.auth();
      },
    },
  ],
  exports: [FIRESTORE, FIREBASE_AUTH],
})
export class FirebaseModule {}
