import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { PRODUTOS_INICIAIS, ProdutoAfiliado } from '@/data/produtos';

const CATALOGO_PATH = path.join(process.cwd(), 'data', 'catalogo.json');

// Fallback em memória caso rode em ambiente serverless read-only
declare global {
  // eslint-disable-next-line no-var
  var __catalogoMemoria: ProdutoAfiliado[] | undefined;
}

async function lerCatalogo(): Promise<ProdutoAfiliado[]> {
  try {
    const raw = await fs.readFile(CATALOGO_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      globalThis.__catalogoMemoria = parsed;
      return parsed;
    }
  } catch {
    // Se falhar leitura em disco, tenta memória ou produtos iniciais
  }

  if (globalThis.__catalogoMemoria) {
    return globalThis.__catalogoMemoria;
  }

  await salvarCatalogo(PRODUTOS_INICIAIS);
  return PRODUTOS_INICIAIS;
}

async function salvarCatalogo(lista: ProdutoAfiliado[]): Promise<void> {
  globalThis.__catalogoMemoria = lista;
  try {
    const dir = path.dirname(CATALOGO_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(CATALOGO_PATH, JSON.stringify(lista, null, 2), 'utf-8');
  } catch {
    // Em produção serverless (read-only fs), mantém em globalThis.__catalogoMemoria
  }
}

export async function GET() {
  const lista = await lerCatalogo();
  return NextResponse.json({ produtos: lista });
}

// Adicionar Novo Produto / Link
export async function POST(request: Request) {
  try {
    const novoProduto: ProdutoAfiliado = await request.json();
    const listaAtual = await lerCatalogo();

    const novaLista = [novoProduto, ...listaAtual];
    await salvarCatalogo(novaLista);

    return NextResponse.json({ ok: true, produtos: novaLista });
  } catch (error) {
    return NextResponse.json(
      { ok: false, erro: String(error) },
      { status: 400 }
    );
  }
}

// Editar Produto / Link Existente
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const listaAtual = await lerCatalogo();

    // Se enviou uma lista inteira para sincronizar
    if (Array.isArray(body.produtos)) {
      await salvarCatalogo(body.produtos);
      return NextResponse.json({ ok: true, produtos: body.produtos });
    }

    // Se enviou um único produto editado
    const produtoEditado: ProdutoAfiliado = body;
    const novaLista = listaAtual.map((item) =>
      item.id === produtoEditado.id ? produtoEditado : item
    );

    await salvarCatalogo(novaLista);
    return NextResponse.json({ ok: true, produtos: novaLista });
  } catch (error) {
    return NextResponse.json(
      { ok: false, erro: String(error) },
      { status: 400 }
    );
  }
}

// Excluir Produto / Link
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const listaAtual = await lerCatalogo();

    const novaLista = listaAtual.filter((p) => p.id !== id);
    await salvarCatalogo(novaLista);

    return NextResponse.json({ ok: true, produtos: novaLista });
  } catch (error) {
    return NextResponse.json(
      { ok: false, erro: String(error) },
      { status: 400 }
    );
  }
}
