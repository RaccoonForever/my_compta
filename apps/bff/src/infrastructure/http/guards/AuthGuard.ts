import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { auth } from 'firebase-admin';
import { FIREBASE_AUTH } from '../../adapters/firestore/firebase.module.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(FIREBASE_AUTH) private readonly firebaseAuth: auth.Auth,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: { uid: string };
    }>();

    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);
    try {
      // In emulator mode, FIREBASE_AUTH_EMULATOR_HOST must be set
      const decoded = await this.firebaseAuth.verifyIdToken(token);
      request.user = { uid: decoded.uid };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired Firebase ID token');
    }
  }
}
