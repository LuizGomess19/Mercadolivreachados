import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { PRODUTOS_INICIAIS, ProdutoAfiliado } from '@/data/produtos';
import {
  atualizarProduto,
  criarProduto,
  excluirProduto,
  listarFiltros,
  listarProdutos,
  salvarFiltros,
  statusBanco,
  substituirCatalogo,
  validarProduto,
} from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

function naoAutorizado() {
  return NextResponse.json(
    { ok: false, erro: 'Acesso negado. Entre no modo proprietário novamente.' },
    { status: 401, headers: NO_CACHE_HEADERS }
  );
}

function erroServidor(error: unknown) {
  const mensagem = error instanceof Error ? error.message : String(error);
  console.error('[api/produtos]', mensagem);
  return NextResponse.json({ ok: false, erro: mensagem }, { status: 500, headers: NO_CACHE_HEADERS });
}

// Listar produtos e filtros (público — sempre busca a versão mais recente do banco)
export async function GET() {
  try {
    const [produtos, filtros, status] = await Promise.all([
      listarProdutos(),
      listarFiltros(),
      statusBanco(),
    ]);
    return NextResponse.json(
      {
        produtos,
        filtros,
        persistente: status.persistente,
        supabaseConectado: status.supabaseConectado,
        atualizadoEm: new Date().toISOString(),
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    return erroServidor(error);
  }
}

// Adicionar novo produto/link (somente proprietário)
export async function POST(request: Request) {
  if (!(await isAdmin(request))) return naoAutorizado();
  try {
    const validacao = validarProduto(await request.json());
    if (!validacao.ok) {
      return NextResponse.json(
        { ok: false, erro: validacao.erro },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }
    const produto = await criarProduto(validacao.produto);
    return NextResponse.json({ ok: true, produto }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    return erroServidor(error);
  }
}

// Editar produto/link existente ou substituir catálogo completo (somente proprietário)
export async function PUT(request: Request) {
  if (!(await isAdmin(request))) return naoAutorizado();
  try {
    const body = await request.json();

    // Caso 1: Salvar filtros personalizados (auto-save imediato)
    if (body && typeof body === 'object' && body.filtros && typeof body.filtros === 'object') {
      const filtros = await salvarFiltros(body.filtros);
      return NextResponse.json({ ok: true, filtros }, { headers: NO_CACHE_HEADERS });
    }

    // Caso 2: Restaurar catálogo padrão
    if (body && typeof body === 'object' && body.restaurarPadrao === true) {
      const produtos = await substituirCatalogo(PRODUTOS_INICIAIS);
      return NextResponse.json({ ok: true, produtos }, { headers: NO_CACHE_HEADERS });
    }

    // Caso 2: Substituir lista completa de produtos
    if (body && typeof body === 'object' && Array.isArray(body.catalogo)) {
      const validados: ProdutoAfiliado[] = [];
      for (const item of body.catalogo) {
        const val = validarProduto(item);
        if (val.ok) validados.push(val.produto);
      }
      const produtos = await substituirCatalogo(validados);
      return NextResponse.json({ ok: true, produtos }, { headers: NO_CACHE_HEADERS });
    }

    // Caso 3: Atualizar um único produto (upsert)
    const validacao = validarProduto(body);
    if (!validacao.ok) {
      return NextResponse.json(
        { ok: false, erro: validacao.erro },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }
    const produto = await atualizarProduto(validacao.produto);
    return NextResponse.json({ ok: true, produto }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    return erroServidor(error);
  }
}

// Excluir produto/link ou limpar todos (somente proprietário)
export async function DELETE(request: Request) {
  if (!(await isAdmin(request))) return naoAutorizado();
  try {
    const searchParams = new URL(request.url).searchParams;
    if (searchParams.get('todos') === '1') {
      await substituirCatalogo([]);
      return NextResponse.json({ ok: true, produtos: [] }, { headers: NO_CACHE_HEADERS });
    }

    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { ok: false, erro: 'ID ausente.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }
    await excluirProduto(id);
    return NextResponse.json({ ok: true }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    return erroServidor(error);
  }
}
