import { NextResponse } from 'next/server';
import {
  COOKIE_ADMIN,
  COOKIE_MAX_AGE,
  isAdmin,
  senhaAdmin,
  tokenAdmin,
  verificarSenha,
} from '@/lib/auth';
import { bancoConfigurado } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Status da sessão do proprietário
export async function GET() {
  return NextResponse.json({
    autenticado: await isAdmin(),
    adminConfigurado: senhaAdmin() !== null,
    bancoConfigurado: bancoConfigurado(),
  });
}

// Login do proprietário
export async function POST(request: Request) {
  let pin = '';
  try {
    const body = await request.json();
    pin = typeof body?.pin === 'string' ? body.pin : '';
  } catch {
    // corpo inválido
  }

  if (!senhaAdmin()) {
    return NextResponse.json(
      { ok: false, erro: 'Defina a variável ADMIN_PIN no servidor para liberar o modo proprietário.' },
      { status: 503 }
    );
  }

  if (!verificarSenha(pin)) {
    // Atraso proposital para dificultar tentativas em sequência
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ ok: false, erro: 'Senha incorreta.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_ADMIN, tokenAdmin()!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}

// Logout do proprietário
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_ADMIN, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}

