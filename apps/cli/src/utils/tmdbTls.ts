/**
 * When TRUST_ALL_TMDB_CERT is true (e.g. "true", "1", "yes"), TMDB outbound HTTPS
 * uses Node `https` with rejectUnauthorized: false (see `tmdbOutboundFetch.ts`).
 * Use only in development when upstream uses a custom or misconfigured certificate.
 */
export function trustAllTmdbCertEnabled(): boolean {
  const v = process.env.TRUST_ALL_TMDB_CERT?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

/**
 * Bun on Windows (and some builds) still fails HTTPS with UNKNOWN_CERTIFICATE_VERIFICATION_ERROR
 * even when fetch uses tls.rejectUnauthorized: false (see oven-sh/bun#11821).
 * Node-compatible mitigation: disable TLS verification for the whole CLI process.
 * Call once at startup after loading .env, only when {@link trustAllTmdbCertEnabled} is true.
 */
export function applyTmdbTlsDevBypassToProcessIfEnabled(): void {
  if (!trustAllTmdbCertEnabled()) {
    return;
  }
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}
