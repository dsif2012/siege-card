import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: '請輸入電子郵件與密碼' },
        { status: 400 }
      );
    }

    // 尋找使用者
    let user = await db.user.findUnique({
      where: { email },
    });

    let isNewUser = false;
    if (!user) {
      // 帳號不存在，自動註冊並登入
      const passwordHash = await bcrypt.hash(password, 10);
      user = await db.user.create({
        data: {
          email,
          passwordHash,
        },
      });
      isNewUser = true;
    } else {
      // 帳號已存在，驗證密碼
      const passwordMatch = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatch) {
        return NextResponse.json(
          { error: '密碼不正確' },
          { status: 400 }
        );
      }
    }

    // 簽發 JWT Token
    const token = signToken({ id: user.id, email: user.email });

    // 建立回應並設定 HTTP-only Cookie
    const response = NextResponse.json({
      message: '登入成功',
      user: {
        id: user.id,
        email: user.email,
      },
    });

    response.cookies.set('session', token, {
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 天
    });

    return response;
  } catch (error: any) {
    console.error('登入錯誤:', error);
    return NextResponse.json(
      { error: '登入過程發生錯誤，請稍後再試' },
      { status: 500 }
    );
  }
}
