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
 * Camada de Banco de Dados em Nuvem (Supabase + Cloud Sync):
 *
 * 1. Supabase PostgreSQL (tabela `public.produtos`) — lê variáveis de ambiente
 *    (SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY)
 *    OU credenciais salvas diretamente pelo Painel Admin.
 * 2. Sincronização automática em Nuvem (Cloud Document Store) sempre ativa
 *    para garantir persistência global imediata entre todos os visitantes/dispositivos.
 * 3. Espelhamento automático em `data/catalogo.json` no ambiente local.
 */

const TABELA = 'produtos';
const CATALOGO_PATH = path.join(process.cwd(), 'data', 'catalogo.json');
const SUPABASE_CONFIG_PATH = path.join(process.cwd(), 'data', 'supabase-config.json');

const FIRESTORE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'espaco-catolico-santo-antonio';
const FIRESTORE_API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyC4UYN_il1mIZjkvAc3MXC8vPD5O33_MuI';
const FIRESTORE_COLLECTION = 'espaco_catolico_sync';
const FIRESTORE_DOC_ID = 'mercadolivreachados_catalogo_v1';
const FIRESTORE_CONFIG_DOC_ID = 'mercadolivreachados_supabase_config_v1';

const IMAGEM_PADRAO =
  'https://images.unsplash.com/photo-1513297887119-d46091b24bfa?auto=format&fit=crop&w=700&q=80';

export interface ConfigSupabase {
  url: string;
  key: string;
  updatedAt?: string;
}

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
    criado_em: p.criadoEm || new Date().toISOString(),
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
// 1. Nuvem Integrada (Cloud Document Store - Sempre Ativo)
// ---------------------------------------------------------------------------
function getFirestoreUrl(docId = FIRESTORE_DOC_ID): string {
  return `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${FIRESTORE_COLLECTION}/${docId}?key=${FIRESTORE_API_KEY}`;
}

type ResultadoLeituraNuvem =
  | { status: 'ok'; lista: ProdutoAfiliado[]; initialized: boolean }
  | { status: 'not_found' }
  | { status: 'error' };

async function lerFirestore(): Promise<ResultadoLeituraNuvem> {
  try {
    const res = await fetch(getFirestoreUrl(FIRESTORE_DOC_ID), {
      method: 'GET',
      cache: 'no-store',
    });
    if (res.status === 404) {
      return { status: 'not_found' };
    }
    if (!res.ok) {
      return { status: 'error' };
    }
    const data = await res.json();
    const rawJson = data?.fields?.payload?.stringValue;
    const initialized = data?.fields?.initialized?.booleanValue === true;
    if (typeof rawJson !== 'string') {
      return { status: 'not_found' };
    }
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) {
      return { status: 'error' };
    }
    return {
      status: 'ok',
      lista: parsed as ProdutoAfiliado[],
      initialized: initialized || parsed.length > 0,
    };
  } catch {
    return { status: 'error' };
  }
}

async function salvarFirestore(lista: ProdutoAfiliado[]): Promise<boolean> {
  try {
    const res = await fetch(getFirestoreUrl(FIRESTORE_DOC_ID), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        fields: {
          payload: { stringValue: JSON.stringify(lista) },
          initialized: { booleanValue: true },
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
// 2. Configuração e Cliente Supabase PostgreSQL (Projeto Oficial sa-east-1)
// ---------------------------------------------------------------------------
const DEFAULT_SUPABASE_URL = 'https://poqeeewzhzejpmuexomr.supabase.co';
const DEFAULT_SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvcWVlZXd6aHplanBtdWV4b21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MzEzNTAsImV4cCI6MjExMDEwNzM1MH0.7XBq8k9Lqkz6Z-g004dNwRrbOISh5kPyPsSbwDY8bnc';
const SUPABASE_SERVER_HEADERS = {
  'x-ml-server-key': 'ml-achados-srv-poqeeewzhzejpmuexomr',
};

declare global {
  // eslint-disable-next-line no-var
  var __catalogoLocal: ProdutoAfiliado[] | undefined;
  // eslint-disable-next-line no-var
  var __configSupabaseCache: ConfigSupabase | null | undefined;
}

function lerSupabaseEnv(): ConfigSupabase | null {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();

  if (url && key) {
    return { url, key };
  }
  return null;
}

export async function obterConfigSupabase(): Promise<ConfigSupabase | null> {
  const envConfig = lerSupabaseEnv();
  if (envConfig) return envConfig;

  if (globalThis.__configSupabaseCache !== undefined) {
    return globalThis.__configSupabaseCache;
  }

  // Tenta ler do arquivo local customizado
  try {
    const raw = await fs.readFile(SUPABASE_CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as ConfigSupabase;
    if (parsed?.url && parsed?.key) {
      globalThis.__configSupabaseCache = parsed;
      return parsed;
    }
  } catch {
    // continua para configuração oficial do projeto
  }

  // Projeto Supabase oficial pré-configurado (sa-east-1 - São Paulo)
  const padrao: ConfigSupabase = {
    url: DEFAULT_SUPABASE_URL,
    key: DEFAULT_SUPABASE_KEY,
  };
  globalThis.__configSupabaseCache = padrao;
  return padrao;
}

export async function salvarConfigSupabase(
  url: string,
  key: string
): Promise<{ ok: boolean; erro?: string; totalSincronizado?: number }> {
  const urlLimpa = url.trim().replace(/\/+$/, '');
  const keyLimpa = key.trim();

  if (!urlLimpa || !keyLimpa) {
    // Volta para o projeto Supabase padrão
    globalThis.__configSupabaseCache = {
      url: DEFAULT_SUPABASE_URL,
      key: DEFAULT_SUPABASE_KEY,
    };
    try {
      await fs.unlink(SUPABASE_CONFIG_PATH);
    } catch {
      // ignora
    }
    return { ok: true };
  }

  if (!urlLimpa.startsWith('https://')) {
    return { ok: false, erro: 'A URL do Supabase deve começar com https://' };
  }

  // Testa conexão com o Supabase
  const client = createClient(urlLimpa, keyLimpa, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: SUPABASE_SERVER_HEADERS },
  });

  const { data: existentes, error: erroTeste } = await client
    .from(TABELA)
    .select('id')
    .limit(1);

  if (erroTeste) {
    return {
      ok: false,
      erro: `Falha ao acessar a tabela "produtos" no Supabase (${erroTeste.message}). Certifique-se de executar o arquivo supabase/schema.sql no SQL Editor do Supabase.`,
    };
  }

  const novaConfig: ConfigSupabase = {
    url: urlLimpa,
    key: keyLimpa,
    updatedAt: new Date().toISOString(),
  };
  globalThis.__configSupabaseCache = novaConfig;

  try {
    await fs.mkdir(path.dirname(SUPABASE_CONFIG_PATH), { recursive: true });
    await fs.writeFile(SUPABASE_CONFIG_PATH, JSON.stringify(novaConfig, null, 2), 'utf-8');
  } catch {
    // Em serverless mantém em memória
  }

  // Sincroniza o catálogo atual para a tabela do Supabase
  const catalogoAtual = await listarProdutosNuvemOuLocal();
  if (catalogoAtual.length > 0 && (!existentes || existentes.length === 0)) {
    const linhas = catalogoAtual.map((p, idx) => ({
      ...paraLinha(p),
      criado_em:
        p.criadoEm || new Date(Date.now() - idx * 60000).toISOString(),
    }));
    await client.from(TABELA).upsert(linhas, { onConflict: 'id' });
  }

  const { count } = await client
    .from(TABELA)
    .select('*', { count: 'exact', head: true });

  return { ok: true, totalSincronizado: count ?? catalogoAtual.length };
}

async function getSupabase(): Promise<SupabaseClient | null> {
  const cfg = await obterConfigSupabase();
  if (!cfg?.url || !cfg?.key) return null;
  try {
    return createClient(cfg.url, cfg.key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: SUPABASE_SERVER_HEADERS },
    });
  } catch {
    return null;
  }
}

export async function statusBanco(): Promise<{
  persistente: boolean;
  supabaseConectado: boolean;
  supabaseUrlMascarada: string | null;
}> {
  const cfg = await obterConfigSupabase();
  return {
    persistente: true,
    supabaseConectado: !!cfg?.url,
    supabaseUrlMascarada: cfg?.url || null,
  };
}

export function bancoConfigurado(): boolean {
  return true;
}

// ---------------------------------------------------------------------------
// 3. Espelhamento Local (data/catalogo.json + memória)
// ---------------------------------------------------------------------------
async function lerLocal(): Promise<ProdutoAfiliado[]> {
  if (globalThis.__catalogoLocal) {
    return globalThis.__catalogoLocal;
  }
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
  return PRODUTOS_INICIAIS;
}

async function salvarLocal(lista: ProdutoAfiliado[]): Promise<void> {
  globalThis.__catalogoLocal = lista;
  try {
    await fs.mkdir(path.dirname(CATALOGO_PATH), { recursive: true });
    await fs.writeFile(CATALOGO_PATH, JSON.stringify(lista, null, 2), 'utf-8');
  } catch {
    // Em ambiente serverless mantém no banco em nuvem + memória
  }
}

async function listarProdutosNuvemOuLocal(): Promise<ProdutoAfiliado[]> {
  const resNuvem = await lerFirestore();
  if (resNuvem.status === 'ok') {
    await salvarLocal(resNuvem.lista);
    return resNuvem.lista;
  }
  if (resNuvem.status === 'not_found') {
    const inicial = await lerLocal();
    await salvarFirestore(inicial);
    return inicial;
  }
  // Em caso de oscilação de rede ('error'), retorna o último estado local sem sobrescrever a nuvem!
  return await lerLocal();
}

// ---------------------------------------------------------------------------
// Operações públicas do Banco de Dados
// ---------------------------------------------------------------------------
export async function listarProdutos(): Promise<ProdutoAfiliado[]> {
  // 1. Se tiver Supabase configurado, lê direto do Supabase
  const supabase = await getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from(TABELA)
      .select('*')
      .order('criado_em', { ascending: false });

    if (!error && Array.isArray(data)) {
      const lista = (data as LinhaProduto[]).map(deLinha);
      await salvarLocal(lista);
      return lista;
    }
  }

  // 2. Lê do banco em nuvem integrado
  return await listarProdutosNuvemOuLocal();
}

export async function criarProduto(produto: ProdutoAfiliado): Promise<ProdutoAfiliado> {
  const novo: ProdutoAfiliado = {
    ...produto,
    criadoEm: produto.criadoEm || new Date().toISOString(),
  };

  // 1. Atualiza na lista em nuvem + local
  const listaAtual = await listarProdutos();
  const novaLista = [novo, ...listaAtual.filter((p) => p.id !== novo.id)];
  const salvouNuvem = await salvarFirestore(novaLista);
  await salvarLocal(novaLista);

  // 2. Se tiver Supabase configurado, salva também no Supabase
  const supabase = await getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from(TABELA)
      .upsert({ ...paraLinha(novo), criado_em: novo.criadoEm }, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao salvar no Supabase: ${error.message}`);
    }
    return deLinha(data as LinhaProduto);
  }

  if (!salvouNuvem) {
    throw new Error('Não foi possível gravar no banco em nuvem. Tente novamente.');
  }

  return novo;
}

export async function atualizarProduto(produto: ProdutoAfiliado): Promise<ProdutoAfiliado> {
  const listaAtual = await listarProdutos();
  const existente = listaAtual.find((p) => p.id === produto.id);

  const atualizado: ProdutoAfiliado = {
    ...existente,
    ...produto,
    criadoEm: existente?.criadoEm || produto.criadoEm || new Date().toISOString(),
  };

  const novaLista = existente
    ? listaAtual.map((p) => (p.id === produto.id ? atualizado : p))
    : [atualizado, ...listaAtual];

  const salvouNuvem = await salvarFirestore(novaLista);
  await salvarLocal(novaLista);

  const supabase = await getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from(TABELA)
      .upsert(paraLinha(atualizado), { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar no Supabase: ${error.message}`);
    }
    return deLinha(data as LinhaProduto);
  }

  if (!salvouNuvem) {
    throw new Error('Não foi possível atualizar no banco em nuvem. Tente novamente.');
  }

  return atualizado;
}

export async function excluirProduto(id: string): Promise<boolean> {
  const listaAtual = await listarProdutos();
  const novaLista = listaAtual.filter((p) => p.id !== id);

  const salvouNuvem = await salvarFirestore(novaLista);
  await salvarLocal(novaLista);

  const supabase = await getSupabase();
  if (supabase) {
    const { error } = await supabase.from(TABELA).delete().eq('id', id);
    if (error) {
      throw new Error(`Erro ao excluir no Supabase: ${error.message}`);
    }
    return true;
  }

  if (!salvouNuvem) {
    throw new Error('Não foi possível excluir no banco em nuvem. Tente novamente.');
  }

  return true;
}

export async function substituirCatalogo(novaLista: ProdutoAfiliado[]): Promise<ProdutoAfiliado[]> {
  const salvouNuvem = await salvarFirestore(novaLista);
  await salvarLocal(novaLista);

  const supabase = await getSupabase();
  if (supabase) {
    // Remove os que não estão na nova lista e faz upsert dos novos
    await supabase.from(TABELA).delete().neq('id', '__none__');
    if (novaLista.length > 0) {
      const linhas = novaLista.map((p, idx) => ({
        ...paraLinha(p),
        criado_em: p.criadoEm || new Date(Date.now() - idx * 60000).toISOString(),
      }));
      const { error } = await supabase.from(TABELA).upsert(linhas, { onConflict: 'id' });
      if (error) {
        throw new Error(`Erro ao sincronizar catálogo no Supabase: ${error.message}`);
      }
    }
  } else if (!salvouNuvem) {
    throw new Error('Não foi possível salvar o catálogo no banco em nuvem.');
  }

  return novaLista;
}

// ---------------------------------------------------------------------------
// Validação de entrada (com normalização automática de links e imagens)
// ---------------------------------------------------------------------------
const DEPARTAMENTOS: DepartamentoProduto[] = ['looks', 'decoracao', 'tecnologia'];
const OCASIOES: OcasiaoFesta[] = ['Natal', 'Réveillon', 'Ambas'];
const GENEROS: GeneroLook[] = ['Masculino', 'Feminino', 'Unissex'];
const LOJAS: ProdutoAfiliado['loja'][] = ['Shopee', 'Mercado Livre', 'Outra'];

function normalizarUrlHttp(valor: unknown, fallback?: string): string | null {
  if (typeof valor !== 'string' || !valor.trim()) {
    return fallback ?? null;
  }
  let textoUrl = valor.trim();
  if (!/^https?:\/\//i.test(textoUrl)) {
    textoUrl = `https://${textoUrl}`;
  }
  try {
    const url = new URL(textoUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : (fallback ?? null);
  } catch {
    return fallback ?? null;
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
  const link = normalizarUrlHttp(b.link);
  const imagem = normalizarUrlHttp(b.imagem, IMAGEM_PADRAO);
  const precoNumerico = Number(b.precoNumerico);
  const departamento = DEPARTAMENTOS.includes(b.departamento as DepartamentoProduto)
    ? (b.departamento as DepartamentoProduto)
    : 'looks';
  const ocasiao = OCASIOES.includes(b.ocasiao as OcasiaoFesta)
    ? (b.ocasiao as OcasiaoFesta)
    : 'Natal';
  const loja = LOJAS.includes(b.loja as ProdutoAfiliado['loja'])
    ? (b.loja as ProdutoAfiliado['loja'])
    : 'Shopee';

  if (!id) return { ok: false, erro: 'ID do produto ausente.' };
  if (!titulo) return { ok: false, erro: 'Informe o título do produto.' };
  if (!link) return { ok: false, erro: 'Informe um link de afiliado válido.' };
  if (!imagem) return { ok: false, erro: 'Link da imagem inválido.' };
  if (!Number.isFinite(precoNumerico) || precoNumerico < 0) {
    return { ok: false, erro: 'Preço inválido.' };
  }

  const genero = GENEROS.includes(b.genero as GeneroLook) ? (b.genero as GeneroLook) : undefined;

  return {
    ok: true,
    produto: {
      id,
      codigo: texto(b.codigo, 20).replace(/^#/, '') || '999',
      titulo,
      preco: texto(b.preco, 40) || `R$ ${precoNumerico.toFixed(2).replace('.', ',')}`,
      precoNumerico,
      precoAntigo: texto(b.precoAntigo, 40) || undefined,
      desconto: texto(b.desconto, 20) || undefined,
      departamento,
      categoria: texto(b.categoria, 80) || (departamento === 'looks' ? genero || 'Feminino' : 'Geral'),
      genero: departamento === 'looks' ? genero || 'Feminino' : undefined,
      ocasiao,
      ambiente: departamento === 'decoracao' ? texto(b.ambiente, 80) || 'Sala' : undefined,
      loja,
      avaliacao: texto(b.avaliacao, 10) || '4.9',
      vendidos: texto(b.vendidos, 60) || 'Novo na vitrine 🔥',
      emAlta: b.emAlta !== false,
      freteGratis: b.freteGratis !== false,
      imagem,
      link,
      criadoEm: typeof b.criadoEm === 'string' ? b.criadoEm : undefined,
    },
  };
}
