import { describe, expect, test } from 'bun:test';
import { resolveUiPageUrl } from './ui-page-url.ts';

describe('resolveUiPageUrl', () => {
  test('defaults to localhost with port from apps/ui/vite.config.ts', () => {
    const prev = process.env.SMM_AUTH_TOKEN;
    delete process.env.SMM_AUTH_TOKEN;

    try {
      expect(resolveUiPageUrl()).toBe('http://localhost:8000');
    } finally {
      if (prev === undefined) {
        delete process.env.SMM_AUTH_TOKEN;
      } else {
        process.env.SMM_AUTH_TOKEN = prev;
      }
    }
  });

  test('appends SMM_AUTH_TOKEN as query param', () => {
    const prev = process.env.SMM_AUTH_TOKEN;
    process.env.SMM_AUTH_TOKEN = 'ChangeMe123';

    try {
      expect(resolveUiPageUrl()).toBe('http://localhost:8000?token=ChangeMe123');
    } finally {
      if (prev === undefined) {
        delete process.env.SMM_AUTH_TOKEN;
      } else {
        process.env.SMM_AUTH_TOKEN = prev;
      }
    }
  });

  test('uses explicit url when provided and still appends token', () => {
    const prev = process.env.SMM_AUTH_TOKEN;
    process.env.SMM_AUTH_TOKEN = 'tok';

    try {
      expect(resolveUiPageUrl('http://127.0.0.1:9000/')).toBe(
        'http://127.0.0.1:9000/?token=tok',
      );
    } finally {
      if (prev === undefined) {
        delete process.env.SMM_AUTH_TOKEN;
      } else {
        process.env.SMM_AUTH_TOKEN = prev;
      }
    }
  });
});
