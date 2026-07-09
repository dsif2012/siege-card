import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'siege_card_secret_key_12345';

export interface JWTPayload {
  id: string;
  email: string;
}

// 簽發 JWT Token
export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// 驗證 JWT Token
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

// 從 NextRequest 中取得目前登入的使用者資訊
export async function getCurrentUser(req: NextRequest): Promise<JWTPayload | null> {
  const token = req.cookies.get('session')?.value;
  if (!token) return null;
  return verifyToken(token);
}
