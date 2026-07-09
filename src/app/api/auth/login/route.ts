import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { signToken } from '@/lib/auth';
import { setSessionCookie } from '@/lib/session-cookie';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    const rawEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const rawPassword = typeof password === 'string' ? password : '';

    if (!rawEmail || !rawPassword) {
      return NextResponse.json(
        { error: '請輸入電子郵件與密碼' },
        { status: 400 }
      );
    }

    let user = await db.user.findUnique({
      where: { email: rawEmail },
    });

    let isNewUser = false;
    if (!user) {
      const passwordHash = await bcrypt.hash(rawPassword, 10);
      user = await db.user.create({
        data: {
          email: rawEmail,
          passwordHash,
        },
      });
      isNewUser = true;
    } else {
      const passwordMatch = await bcrypt.compare(rawPassword, user.passwordHash);
      if (!passwordMatch) {
        return NextResponse.json(
          { error: '密碼不正確' },
          { status: 400 }
        );
      }
    }

    const token = signToken({ id: user.id, email: user.email });

    const response = NextResponse.json({
      message: isNewUser ? '已自動註冊並登入' : '登入成功',
      user: {
        id: user.id,
        email: user.email,
      },
    });

    // 強制覆寫舊 session，避免 UI 顯示新帳號但 cookie 仍是舊帳號
    setSessionCookie(response, token);

    return response;
  } catch (error: any) {
    console.error('登入錯誤:', error);
    return NextResponse.json(
      { error: '登入過程發生錯誤，請稍後再試' },
      { status: 500 }
    );
  }
}
