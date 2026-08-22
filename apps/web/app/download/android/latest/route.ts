import { NextResponse } from 'next/server';

const ANDROID_APK_URL =
  'https://github.com/paokurtis-a11y/Khebooth/releases/download/android-latest/KHE-Booth-Android-debug.apk';

export async function GET() {
  const response = NextResponse.redirect(ANDROID_APK_URL, 307);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
