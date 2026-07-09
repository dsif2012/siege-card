import { NextResponse } from 'next/server';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

/** 與登入／登出共用的 session cookie 屬性，避免清不掉或蓋不掉 */
export function sessionCookieOptions(maxAge: number): Partial<ResponseCookie> {
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  return {
    httpOnly: true,
    path: '/',
    secure: isProd,
    sameSite: 'lax',
    maxAge,
  };
}

/** 寫入 session；屬性固定，確保覆寫舊 cookie */
export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set('session', token, sessionCookieOptions(60 * 60 * 24 * 7));
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set('session', '', {
    ...sessionCookieOptions(0),
    expires: new Date(0),
  });
}
