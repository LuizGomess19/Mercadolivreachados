import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import {
  atualizarProduto,
  bancoConfigurado,
  criarProduto,
  excluirProduto,
  listarProdutos,
  validarProduto,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

function naoAutorizado() {
  return NextResponse.json(
    { ok: false, erro: 'Acesso negado. Entre no modo proprietário novamente.' },
    { status: 401 }
  );
}

function erroServidor(error: unknown) {
  const mensagem = error instanceof Error ? error.message : String(error);
  console.error('[api/produtos]', mensagem);
  return NextResponse.json({ ok: false, erro: mensagem }, { status: 500 });
}

// Listar produtos (público)
export async function GET() {
  try {
    const produtos = await listarProdutos();
    return NextResponse.json({ produtos, persistente: bancoConfigurado() });
  } catch (error) {
    return erroServidor(error);
  }
}

// Adicionar novo produto/link (somente proprietário)
export async function POST(request: Request) {
  if (!(await isAdmin())) return naoAutorizado();
  try {
    const validacao = validarProduto(await request.json());
    if (!validacao.ok) {
      return NextResponse.json({ ok: false, erro: validacao.erro }, { status: 400 });
    }
    const produto = await criarProduto(validacao.produto);
    return NextResponse.json({ ok: true, produto });
  } catch (error) {
    return erroServidor(error);
  }
}

// Editar produto/link existente (somente proprietário)
export async function PUT(request: Request) {
  if (!(await isAdmin())) return naoAutorizado();
  try {
    const validacao = validarProduto(await request.json());
    if (!validacao.ok) {
      return NextResponse.json({ ok: false, erro: validacao.erro }, { status: 400 });
    }
    const produto = await atualizarProduto(validacao.produto);
    if (!produto) {
      return NextResponse.json({ ok: false, erro: 'Produto não encontrado.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, produto });
  } catch (error) {
    return erroServidor(error);
  }
}

// Excluir produto/link (somente proprietário)
export async function DELETE(request: Request) {
  if (!(await isAdmin())) return naoAutorizado();
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
      return NextResponse.json({ ok: false, erro: 'ID ausente.' }, { status: 400 });
    }
    const removido = await excluirProduto(id);
    if (!removido) {
      return NextResponse.json({ ok: false, erro: 'Produto não encontrado.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return erroServidor(error);
  }
}
