import { ServiceUnavailableException } from '@nestjs/common';

export type BlobAuthOptions =
  | { token: string }
  | { oidcToken: string; storeId: string };

export function blobAuthOptions(): BlobAuthOptions {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (token) return { token };

  const oidcToken = process.env.VERCEL_OIDC_TOKEN?.trim();
  const storeId = process.env.BLOB_STORE_ID?.trim();
  if (oidcToken && storeId) return { oidcToken, storeId };

  throw new ServiceUnavailableException(
    'Vercel Blob is not connected to khebooth-api: configure BLOB_READ_WRITE_TOKEN or connect a Blob store with OIDC/BLOB_STORE_ID.',
  );
}
