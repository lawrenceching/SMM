/**
 * Simple in-memory key-value database with localStorage-like interface
 */
export class Database {
  private store: Map<string, any>;

  constructor() {
    this.store = new Map();
  }

  /**
   * Set a key-value pair
   */
  setItem(key: string, value: any): void {
    this.store.set(key, value);
  }

  /**
   * Get a value by key
   */
  getItem(key: string): any | null {
    const value = this.store.get(key);
    return value !== undefined ? value : null;
  }

  /**
   * Remove a key-value pair
   */
  removeItem(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clear all key-value pairs
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get the number of key-value pairs
   */
  get length(): number {
    return this.store.size;
  }

  /**
   * Get the key at a specific index
   */
  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return index >= 0 && index < keys.length ? (keys[index] ?? null) : null;
  }

  /**
   * Check if a key exists
   */
  hasItem(key: string): boolean {
    return this.store.has(key);
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Get all values
   */
  values(): any[] {
    return Array.from(this.store.values());
  }

  /**
   * Get all entries as key-value pairs
   */
  entries(): [string, any][] {
    return Array.from(this.store.entries());
  }

  /**
   * Get a typed value
   */
  getTyped<T>(key: string): T | null {
    return this.getItem(key) as T | null;
  }
}

// Singleton instance
export const db = new Database();
