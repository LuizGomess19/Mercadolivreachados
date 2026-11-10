import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { PRODUTOS_INICIAIS, ProdutoAfiliado } from '@/data/produtos';

const CATALOGO_PATH = path.join(process.cwd(), 'data', 'catalogo.json');

async function lerCatalogo(): Promise<ProdutoAfiliado[]> {
  try {
    const raw = await fs.readFile(CATALOGO_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // Se não existir ainda, cria com os produtos iniciais
  }
  await salvarCatalogo(PRODUTOS_INICIAIS);
  return PRODUTOS_INICIAIS;
}

async function salvarCatalogo(lista: ProdutoAfiliado[]): Promise<void> {
  const dir = path.dirname(CATALOGO_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(CATALOGO_PATH, JSON.stringify(lista, null, 2), 'utf-8');
}

export async function GET() {
  const lista = await lerCatalogo();
  return NextResponse.json({ produtos: lista });
}

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

