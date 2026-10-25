import { describe, expect, it } from 'vitest';
import { assertPublicHost, normalizeHttpUrl } from '../src/security/urlGuard.js';

describe('normalizeHttpUrl', () => {
  it('accepts https URLs', () => {
    const url = normalizeHttpUrl('https://omegax-hackathon.onrender.com/');
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('omegax-hackathon.onrender.com');
  });

  it('rejects non-http schemes', () => {
    expect(() => normalizeHttpUrl('ftp://example.com')).toThrow(/HTTP/);
    expect(() => normalizeHttpUrl('file:///etc/passwd')).toThrow(/HTTP/);
  });

  it('rejects localhost and loopback', () => {
    expect(() => normalizeHttpUrl('http://localhost:8787')).toThrow(/not allowed/);
    expect(() => normalizeHttpUrl('http://127.0.0.1/')).toThrow(/not allowed/);
  });

  it('rejects private IPv4 literals', () => {
    expect(() => normalizeHttpUrl('http://192.168.1.5/')).toThrow(/not allowed/);
    expect(() => normalizeHttpUrl('http://10.0.0.4/secret')).toThrow(/not allowed/);
    expect(() => normalizeHttpUrl('http://169.254.169.254/latest/meta-data')).toThrow(/not allowed/);
  });
});

describe('assertPublicHost', () => {
  it('rejects DNS that resolves to a private address', async () => {
    const lookupImpl = async () => [{ address: '10.1.2.3', family: 4 }];
    await expect(assertPublicHost('https://evil.example', lookupImpl)).rejects.toThrow(/Private/);
  });

  it('allows public DNS results', async () => {
    const lookupImpl = async () => [{ address: '8.8.8.8', family: 4 }];
    const url = await assertPublicHost('https://example.com', lookupImpl);
    expect(url.hostname).toBe('example.com');
  });
});
