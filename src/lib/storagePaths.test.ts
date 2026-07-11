import { describe, it, expect } from 'vitest';
import {
  AUDIO_EXT_BY_MIME,
  buildComplaintStoragePath,
  sanitizeStorageExtension,
} from '@/lib/uploadPolicies';

// Storage object keys accept only a narrow ASCII charset; these helpers are
// the single place where user-controlled filenames may influence a key.

describe('sanitizeStorageExtension', () => {
  it('keeps plain ASCII extensions and lowercases them', () => {
    expect(sanitizeStorageExtension('report.PDF')).toBe('pdf');
    expect(sanitizeStorageExtension('scan.jpeg')).toBe('jpeg');
  });

  it('strips non-ASCII (Armenian) characters that the Storage API rejects', () => {
    expect(sanitizeStorageExtension('փաստաթուղթ.պդֆ')).toBe('bin');
    expect(sanitizeStorageExtension('doc.pdfԴ')).toBe('pdf');
  });

  it('never lets path separators or traversal fragments survive', () => {
    expect(sanitizeStorageExtension('evil.p/../df')).toBe('df');
    expect(sanitizeStorageExtension('x.././../etc/passwd')).toBe('etcpasswd');
    expect(sanitizeStorageExtension('noext')).toBe('noext');
    expect(sanitizeStorageExtension('trailingdot.')).toBe('bin');
  });

  it('falls back for empty or oversized extensions', () => {
    expect(sanitizeStorageExtension('')).toBe('bin');
    expect(sanitizeStorageExtension('a.' + 'x'.repeat(24))).toBe('bin');
  });
});

describe('buildComplaintStoragePath', () => {
  it('produces a user-scoped complaints key with a generated name', () => {
    const path = buildComplaintStoragePath('user-1', 'претензия окончательная.docx');
    expect(path).toMatch(/^user-1\/complaints\/\d+-[a-z0-9]+\.docx$/);
  });

  it('is safe for hostile filenames (traversal, non-ASCII, no extension)', () => {
    for (const name of ['../../../etc/passwd', 'ԴԱՏԱԿԱՆ ՀԱՄԱԿԱՐԳ.pdf', 'plain']) {
      const path = buildComplaintStoragePath('user-1', name);
      expect(path).toMatch(/^user-1\/complaints\/\d+-[a-z0-9]+\.[a-z0-9]+$/);
      expect(path).not.toContain('..');
    }
  });
});

describe('AUDIO_EXT_BY_MIME', () => {
  it('covers every normalized audio MIME with a canonical ASCII extension', () => {
    expect(AUDIO_EXT_BY_MIME).toEqual({
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/mp4': 'm4a',
      'audio/ogg': 'ogg',
    });
    for (const ext of Object.values(AUDIO_EXT_BY_MIME)) {
      expect(ext).toMatch(/^[a-z0-9]+$/);
    }
  });
});
