import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: '請輸入電子郵件與密碼' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: '密碼長度必須至少為 6 個字元' },
        { status: 400 }
      );
    }

    // 檢查使用者是否已存在
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: '該電子郵件已被註冊' },
        { status: 400 }
      );
    }

    // 雜湊密碼
    const passwordHash = await bcrypt.hash(password, 10);

    // 建立新使用者
    const user = await db.user.create({
      data: {
        email,
        passwordHash,
      },
    });

    return NextResponse.json({
      message: '註冊成功',
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error: any) {
    console.error('註冊錯誤:', error);
    return NextResponse.json(
      { error: '註冊過程發生錯誤，請稍後再試' },
      { status: 500 }
    );
  }
}
