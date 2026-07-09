import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ message: '已成功登出' });
  // 清除 session cookie（屬性需與登入時一致，否則 production 清不掉）
  response.cookies.set('session', '', {
    httpOnly: true,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
  });
  return response;
}
