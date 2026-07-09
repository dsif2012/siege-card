import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session-cookie';

export async function POST() {
  const response = NextResponse.json({ message: '已成功登出' });
  clearSessionCookie(response);
  return response;
}
