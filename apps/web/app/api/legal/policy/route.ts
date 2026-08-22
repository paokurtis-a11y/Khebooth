import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { legalProfileForLocation } from '@/lib/legal-policies';

export const dynamic = 'force-dynamic';

export async function GET() {
  const requestHeaders = await headers();
  const country = requestHeaders.get('x-vercel-ip-country') || requestHeaders.get('cf-ipcountry');
  const subdivision = requestHeaders.get('x-vercel-ip-country-region');
  const profile = legalProfileForLocation(country, subdivision);

  return NextResponse.json(
    {
      ...profile,
      detectedBy: 'network',
      legalUrls: {
        terms: '/terms',
        privacy: '/privacy',
        dataDeletion: '/data-deletion',
      },
    },
    {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
      },
    },
  );
}
