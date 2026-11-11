import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import {
  PRODUTOS_INICIAIS,
  ProdutoAfiliado,
  DepartamentoProduto,
  GeneroLook,
  OcasiaoFesta,
} from '@/data/produtos';

/**
 * Camada de Banco de Dados em Nuvem (Multi-Camada):
 *
 * 1. Google Cloud Firestore (southamerica-east1 - São Paulo) na coleção dedicada
 *    `mercadolivreachados_db/catalogo_v1` — já configurado e ativo automaticamente
 *    tanto localmente quanto na Vercel (sincroniza PC e Celular em tempo real).
 * 2. Supabase PostgreSQL (tabela `produtos`) caso SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 *    sejam definidos.
 * 3. Espelhamento automático em `data/catalogo.json` no ambiente local.
 */

const TABELA = 'produtos';
const CATALOGO_PATH = path.join(process.cwd(), 'data', 'catalogo.json');

// Configuração Google Cloud Firestore (southamerica-east1)
const FIRESTORE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'espaco-catolico-santo-antonio';
const FIRESTORE_API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyC4UYN_il1mIZjkvAc3MXC8vPD5O33_MuI';
const FIRESTORE_COLLECTION = 'espaco_catolico_sync';
const FIRESTORE_DOC_ID = 'mercadolivreachados_catalogo_v1';

interface LinhaProduto {
  id: string;
  codigo: string;
  titulo: string;
  preco: string;
  preco_numerico: number;
  preco_antigo: string | null;
  desconto: string | null;
  departamento: DepartamentoProduto;
  categoria: string;
  genero: GeneroLook | null;
  ocasiao: OcasiaoFesta;
  ambiente: string | null;
  loja: ProdutoAfiliado['loja'];
  avaliacao: string;
  vendidos: string;
  em_alta: boolean;
  frete_gratis: boolean;
  imagem: string;
  link: string;
  criado_em?: string;
}

function paraLinha(p: ProdutoAfiliado): LinhaProduto {
  return {
    id: p.id,
    codigo: p.codigo,
    titulo: p.titulo,
    preco: p.preco,
    preco_numerico: p.precoNumerico,
    preco_antigo: p.precoAntigo ?? null,
    desconto: p.desconto ?? null,
    departamento: p.departamento,
    categoria: p.categoria,
    genero: p.genero ?? null,
    ocasiao: p.ocasiao,
    ambiente: p.ambiente ?? null,
    loja: p.loja,
    avaliacao: p.avaliacao,
    vendidos: p.vendidos,
    em_alta: p.emAlta,
    frete_gratis: p.freteGratis,
    imagem: p.imagem,
    link: p.link,
  };
}

function deLinha(l: LinhaProduto): ProdutoAfiliado {
  return {
    id: l.id,
    codigo: l.codigo,
    titulo: l.titulo,
    preco: l.preco,
    precoNumerico: Number(l.preco_numerico),
    precoAntigo: l.preco_antigo ?? undefined,
    desconto: l.desconto ?? undefined,
    departamento: l.departamento,
    categoria: l.categoria,
    genero: l.genero ?? undefined,
    ocasiao: l.ocasiao,
    ambiente: l.ambiente ?? undefined,
    loja: l.loja,
    avaliacao: l.avaliacao,
    vendidos: l.vendidos,
    emAlta: l.em_alta,
    freteGratis: l.frete_gratis,
    imagem: l.imagem,
    link: l.link,
    criadoEm: l.criado_em,
  };
}

// ---------------------------------------------------------------------------
// 1. Google Cloud Firestore REST API (Nuvem Principal Ativa)
// ---------------------------------------------------------------------------
function getFirestoreUrl(): string {
  return `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${FIRESTORE_COLLECTION}/${FIRESTORE_DOC_ID}?key=${FIRESTORE_API_KEY}`;
}

async function lerFirestore(): Promise<ProdutoAfiliado[] | null> {
  try {
    const res = await fetch(getFirestoreUrl(), {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rawJson = data?.fields?.payload?.stringValue;
    if (!rawJson) return null;
    const parsed = JSON.parse(rawJson);
    return Array.isArray(parsed) ? (parsed as ProdutoAfiliado[]) : null;
  } catch {
    return null;
  }
}

async function salvarFirestore(lista: ProdutoAfiliado[]): Promise<boolean> {
  try {
    const res = await fetch(getFirestoreUrl(), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          payload: { stringValue: JSON.stringify(lista) },
          updatedAt: { stringValue: new Date().toISOString() },
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 2. Supabase PostgreSQL (Opcional se variáveis estiverem configuradas)
// ---------------------------------------------------------------------------
let clienteSupabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return null;
  if (!clienteSupabase) {
    clienteSupabase = createClient(url, chave, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return clienteSupabase;
}

export function bancoConfigurado(): boolean {
  return true; // Google Cloud Firestore já está configurado e ativo por padrão
}

// ---------------------------------------------------------------------------
// 3. Espelhamento Local (data/catalogo.json + memória)
// ---------------------------------------------------------------------------
declare global {
  // eslint-disable-next-line no-var
  var __catalogoLocal: ProdutoAfiliado[] | undefined;
}

async function lerLocal(): Promise<ProdutoAfiliado[]> {
  try {
    const raw = await fs.readFile(CATALOGO_PATH, 'utf-8');
    const lista = JSON.parse(raw);
    if (Array.isArray(lista)) {
      globalThis.__catalogoLocal = lista;
      return lista;
    }
  } catch {
    // Arquivo inexistente ou FS somente leitura
  }
  return globalThis.__catalogoLocal ?? PRODUTOS_INICIAIS;
}

async function salvarLocal(lista: ProdutoAfiliado[]): Promise<void> {
  globalThis.__catalogoLocal = lista;
  try {
    await fs.mkdir(path.dirname(CATALOGO_PATH), { recursive: true });
    await fs.writeFile(CATALOGO_PATH, JSON.stringify(lista, null, 2), 'utf-8');
  } catch {
    // Em ambiente serverless mantém no Cloud Firestore + memória
  }
}

// ---------------------------------------------------------------------------
// Operações públicas do Banco de Dados
// ---------------------------------------------------------------------------
export async function listarProdutos(): Promise<ProdutoAfiliado[]> {
  // 1. Se tiver Supabase configurado
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from(TABELA)
      .select('*')
      .order('criado_em', { ascending: false });
    if (!error && data) {
      return (data as LinhaProduto[]).map(deLinha);
    }
  }

  // 2. Lê do banco em nuvem Google Cloud Firestore
  const listaNuvem = await lerFirestore();
  if (listaNuvem && listaNuvem.length > 0) {
    await salvarLocal(listaNuvem);
    return listaNuvem;
  }

  // 3. Primeira execução: inicializa o banco em nuvem com o catálogo local
  const inicial = await lerLocal();
  await salvarFirestore(inicial);
  return inicial;
}

export async function criarProduto(produto: ProdutoAfiliado): Promise<ProdutoAfiliado> {
  const novo: ProdutoAfiliado = { ...produto, criadoEm: new Date().toISOString() };

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from(TABELA)
      .insert({ ...paraLinha(novo), criado_em: novo.criadoEm })
      .select()
      .single();
    if (error) throw new Error(`Erro ao salvar no banco: ${error.message}`);
    return deLinha(data as LinhaProduto);
  }

  const listaAtual = await listarProdutos();
  const novaLista = [novo, ...listaAtual.filter((p) => p.id !== novo.id)];
  await Promise.all([salvarFirestore(novaLista), salvarLocal(novaLista)]);
  return novo;
}

export async function atualizarProduto(produto: ProdutoAfiliado): Promise<ProdutoAfiliado | null> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from(TABELA)
      .update(paraLinha(produto))
      .eq('id', produto.id)
      .select()
      .maybeSingle();
    if (error) throw new Error(`Erro ao atualizar no banco: ${error.message}`);
    return data ? deLinha(data as LinhaProduto) : null;
  }

  const listaAtual = await listarProdutos();
  const existente = listaAtual.find((p) => p.id === produto.id);
  if (!existente) return null;

  const atualizado: ProdutoAfiliado = { ...produto, criadoEm: existente.criadoEm };
  const novaLista = listaAtual.map((p) => (p.id === produto.id ? atualizado : p));
  await Promise.all([salvarFirestore(novaLista), salvarLocal(novaLista)]);
  return atualizado;
}

export async function excluirProduto(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.from(TABELA).delete().eq('id', id).select('id');
    if (error) throw new Error(`Erro ao excluir no banco: ${error.message}`);
    return Array.isArray(data) && data.length > 0;
  }

  const listaAtual = await listarProdutos();
  const novaLista = listaAtual.filter((p) => p.id !== id);
  if (novaLista.length === listaAtual.length) return false;

  await Promise.all([salvarFirestore(novaLista), salvarLocal(novaLista)]);
  return true;
}

// ---------------------------------------------------------------------------
// Validação de entrada
// ---------------------------------------------------------------------------
const DEPARTAMENTOS: DepartamentoProduto[] = ['looks', 'decoracao', 'tecnologia'];
const OCASIOES: OcasiaoFesta[] = ['Natal', 'Réveillon', 'Ambas'];
const GENEROS: GeneroLook[] = ['Masculino', 'Feminino', 'Unissex'];
const LOJAS: ProdutoAfiliado['loja'][] = ['Shopee', 'Mercado Livre', 'Outra'];

function urlHttp(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  try {
    const url = new URL(valor.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function texto(valor: unknown, max = 300): string {
  return typeof valor === 'string' ? valor.trim().slice(0, max) : '';
}

export function validarProduto(
  body: unknown
): { ok: true; produto: ProdutoAfiliado } | { ok: false; erro: string } {
  if (!body || typeof body !== 'object') return { ok: false, erro: 'Dados inválidos.' };
  const b = body as Record<string, unknown>;

  const id = texto(b.id, 100);
  const titulo = texto(b.titulo);
  const link = urlHttp(b.link);
  const imagem = urlHttp(b.imagem);
  const precoNumerico = Number(b.precoNumerico);
  const departamento = b.departamento as DepartamentoProduto;
  const ocasiao = b.ocasiao as OcasiaoFesta;
  const loja = b.loja as ProdutoAfiliado['loja'];

  if (!id) return { ok: false, erro: 'ID ausente.' };
  if (!titulo) return { ok: false, erro: 'Informe o título do produto.' };
  if (!link) return { ok: false, erro: 'Link de afiliado inválido (use http:// ou https://).' };
  if (!imagem) return { ok: false, erro: 'Link da imagem inválido (use http:// ou https://).' };
  if (!Number.isFinite(precoNumerico) || precoNumerico < 0) {
    return { ok: false, erro: 'Preço inválido.' };
  }
  if (!DEPARTAMENTOS.includes(departamento)) return { ok: false, erro: 'Departamento inválido.' };
  if (!OCASIOES.includes(ocasiao)) return { ok: false, erro: 'Ocasião inválida.' };
  if (!LOJAS.includes(loja)) return { ok: false, erro: 'Loja inválida.' };

  const genero = GENEROS.includes(b.genero as GeneroLook) ? (b.genero as GeneroLook) : undefined;

  return {
    ok: true,
    produto: {
      id,
      codigo: texto(b.codigo, 20).replace(/^#/, '') || '999',
      titulo,
      preco: texto(b.preco, 40),
      precoNumerico,
      precoAntigo: texto(b.precoAntigo, 40) || undefined,
      desconto: texto(b.desconto, 20) || undefined,
      departamento,
      categoria: texto(b.categoria, 80),
      genero: departamento === 'looks' ? genero : undefined,
      ocasiao,
      ambiente: departamento === 'decoracao' ? texto(b.ambiente, 80) || undefined : undefined,
      loja,
      avaliacao: texto(b.avaliacao, 10) || '4.9',
      vendidos: texto(b.vendidos, 60),
      emAlta: b.emAlta !== false,
      freteGratis: b.freteGratis !== false,
      imagem,
      link,
    },
  };
}
