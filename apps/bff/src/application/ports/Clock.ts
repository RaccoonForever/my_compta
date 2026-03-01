/** Provides the current wall-clock time. Swappable in tests. */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('Clock');

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
