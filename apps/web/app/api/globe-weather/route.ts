import { NextResponse, type NextRequest } from 'next/server';

const MAX_LOCATIONS = 40;
const CACHE_SECONDS = 600;
const FREE_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

function coordinates(value: string | null, minimum: number, maximum: number) {
  if (!value) return null;
  const entries = value.split(',');
  if (!entries.length || entries.length > MAX_LOCATIONS) return null;
  const numbers = entries.map(Number);
  return numbers.every((item) => Number.isFinite(item) && item >= minimum && item <= maximum) ? numbers : null;
}

export async function GET(request: NextRequest) {
  const latitude = coordinates(request.nextUrl.searchParams.get('latitude'), -90, 90);
  const longitude = coordinates(request.nextUrl.searchParams.get('longitude'), -180, 180);
  if (!latitude || !longitude || latitude.length !== longitude.length) {
    return NextResponse.json({ message:'Invalid weather coordinates' }, { status:400 });
  }

  const endpoint = process.env.OPEN_METEO_API_URL?.trim() || FREE_ENDPOINT;
  const apiKey = process.env.OPEN_METEO_API_KEY?.trim();
  const production = process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== 'preview';
  if (production && !apiKey && process.env.OPEN_METEO_ALLOW_FREE !== 'true') {
    return NextResponse.json({ message:'Commercial weather provider not configured' }, { status:503 });
  }

  const parameters = new URLSearchParams({
    latitude:latitude.join(','), longitude:longitude.join(','),
    current:'temperature_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    timezone:'auto',
  });
  if (apiKey) parameters.set('apikey', apiKey);

  const response = await fetch(`${endpoint}?${parameters}`, { next:{ revalidate:CACHE_SECONDS } });
  if (!response.ok) return NextResponse.json({ message:'Weather provider unavailable' }, { status:response.status >= 500 ? 503 : response.status });
  const data = await response.json();
  return NextResponse.json(data, { headers:{ 'Cache-Control':`public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=300` } });
}
