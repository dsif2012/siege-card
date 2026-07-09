import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ message: '已成功登出' });
  // 清除 session cookie
  response.cookies.set('session', '', {
    path: '/',
    maxAge: 0,
  });
  return response;
}
