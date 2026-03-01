import { Inject, Injectable } from '@nestjs/common';
import { FIRESTORE } from '../../infrastructure/adapters/firestore/firebase.module.js';
import type * as admin from 'firebase-admin';

type Firestore = admin.firestore.Firestore;

export interface UserSettings {
  baseCurrency: string;
  fxRates: Record<string, number>;
  privacyMode: boolean;
}

const DEFAULTS: UserSettings = {
  baseCurrency: 'CHF',
  fxRates: {},
  privacyMode: false,
};

@Injectable()
export class SettingsService {
  constructor(@Inject(FIRESTORE) private readonly db: Firestore) {}

  private col() {
    return this.db.collection('settings');
  }

  async get(userId: string): Promise<UserSettings> {
    const doc = await this.col().doc(userId).get();
    if (!doc.exists) return { ...DEFAULTS };
    return {
      baseCurrency: (doc.data()!['baseCurrency'] as string) ?? DEFAULTS.baseCurrency,
      fxRates: (doc.data()!['fxRates'] as Record<string, number>) ?? {},
      privacyMode: (doc.data()!['privacyMode'] as boolean) ?? false,
    };
  }

  async update(userId: string, patch: Partial<UserSettings>): Promise<UserSettings> {
    // Strip undefined values — Firestore rejects them
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    await this.col().doc(userId).set(
      { ...clean, updatedAt: new Date() },
      { merge: true },
    );
    return this.get(userId);
  }
}
