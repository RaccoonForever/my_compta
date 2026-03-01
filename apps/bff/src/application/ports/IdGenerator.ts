/** Generates unique IDs. Swappable in tests for deterministic IDs. */
export interface IdGenerator {
  generate(): string;
}

export const ID_GENERATOR = Symbol('IdGenerator');

import { v4 as uuidv4 } from 'uuid';

export class UuidGenerator implements IdGenerator {
  generate(): string {
    return uuidv4();
  }
}
