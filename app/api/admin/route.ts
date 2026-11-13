import { NextResponse } from 'next/server';
import {
  COOKIE_ADMIN,
  COOKIE_MAX_AGE,
  isAdmin,
  senhaAdmin,
  tokenAdmin,
  verificarSenha,
} from '@/lib/auth';
import { salvarConfigSupabase, statusBanco } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Status da sessão do proprietário e do banco de dados
export async function GET(request: Request) {
  const autenticado = await isAdmin(request);
  const status = await statusBanco();
  return NextResponse.json(
    {
      autenticado,
      adminConfigurado: senhaAdmin() !== null,
      bancoConfigurado: status.persistente,
      supabaseConectado: status.supabaseConectado,
      supabaseUrl: autenticado ? status.supabaseUrlMascarada : null,
      token: autenticado ? tokenAdmin() : undefined,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    }
  );
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
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ ok: false, erro: 'Senha incorreta.' }, { status: 401 });
  }

  const token = tokenAdmin();
  const res = NextResponse.json({ ok: true, token });
  res.cookies.set(COOKIE_ADMIN, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}

// Configurar e conectar Supabase pelo painel Admin
export async function PUT(request: Request) {
  if (!(await isAdmin(request))) {
    return NextResponse.json(
      { ok: false, erro: 'Acesso negado. Entre no modo proprietário novamente.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const url = typeof body?.supabaseUrl === 'string' ? body.supabaseUrl : '';
    const key = typeof body?.supabaseKey === 'string' ? body.supabaseKey : '';

    const resultado = await salvarConfigSupabase(url, key);
    if (!resultado.ok) {
      return NextResponse.json({ ok: false, erro: resultado.erro }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      supabaseConectado: !!url.trim(),
      totalSincronizado: resultado.totalSincronizado,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, erro: msg }, { status: 500 });
  }
}

// Logout do proprietário
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_ADMIN, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
