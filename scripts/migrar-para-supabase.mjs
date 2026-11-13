/**
 * Migra o catálogo atual (salvo no Google Cloud Firestore) para o Supabase.
 *
 * Uso:
 *   node --env-file=.env.local scripts/migrar-para-supabase.mjs
 *
 * Requer em .env.local:
 *   SUPABASE_URL=https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... (ou sb_secret_...)
 *
 * O Supabase passa a ficar IGUAL ao catálogo atual: produtos existentes são
 * atualizados, novos são inseridos e itens que você já excluiu são removidos.
 */
import { createClient } from '@supabase/supabase-js';

const FIRESTORE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'espaco-catolico-santo-antonio';
const FIRESTORE_API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyC4UYN_il1mIZjkvAc3MXC8vPD5O33_MuI';
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/espaco_catolico_sync/mercadolivreachados_catalogo_v1?key=${FIRESTORE_API_KEY}`;

const url = process.env.SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error('❌ Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no arquivo .env.local');
  process.exit(1);
}

const supabase = createClient(url, chave, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 1. Lê o catálogo atual do Firestore
const res = await fetch(FIRESTORE_URL, { cache: 'no-store' });
if (!res.ok) {
  console.error(`❌ Não foi possível ler o Firestore (HTTP ${res.status}).`);
  process.exit(1);
}
const doc = await res.json();
const catalogo = JSON.parse(doc?.fields?.payload?.stringValue ?? '[]');
if (!Array.isArray(catalogo) || catalogo.length === 0) {
  console.error('❌ Catálogo vazio no Firestore. Nada para migrar.');
  process.exit(1);
}
console.log(`📦 ${catalogo.length} produtos encontrados no Firestore.`);

// 2. Converte para o formato da tabela (snake_case), preservando a ordem
const agora = Date.now();
const linhas = catalogo.map((p, i) => ({
  id: p.id,
  codigo: p.codigo,
  titulo: p.titulo,
  preco: p.preco,
  preco_numerico: Number(p.precoNumerico) || 0,
  preco_antigo: p.precoAntigo ?? null,
  desconto: p.desconto ?? null,
  departamento: p.departamento,
  categoria: p.categoria ?? '',
  genero: p.genero ?? null,
  ocasiao: p.ocasiao,
  ambiente: p.ambiente ?? null,
  loja: p.loja,
  avaliacao: p.avaliacao ?? '4.9',
  vendidos: p.vendidos ?? '',
  em_alta: p.emAlta !== false,
  frete_gratis: p.freteGratis !== false,
  imagem: p.imagem,
  link: p.link,
  // Mantém a ordem da vitrine (o primeiro da lista é o mais recente)
  criado_em: p.criadoEm ?? new Date(agora - i * 60_000).toISOString(),
}));

// 3. Upsert de todos os produtos
const { error: erroUpsert } = await supabase.from('produtos').upsert(linhas, { onConflict: 'id' });
if (erroUpsert) {
  console.error('❌ Erro ao gravar no Supabase:', erroUpsert.message);
  if (/relation .* does not exist|Could not find the table/i.test(erroUpsert.message)) {
    console.error('   ➜ Rode antes o arquivo supabase/schema.sql no SQL Editor do Supabase.');
  }
  process.exit(1);
}

// 4. Remove do Supabase o que não existe mais no catálogo (itens excluídos)
const ids = linhas.map((l) => l.id);
const { data: removidos, error: erroDelete } = await supabase
  .from('produtos')
  .delete()
  .not('id', 'in', `(${ids.map((id) => `"${id}"`).join(',')})`)
  .select('id');
if (erroDelete) {
  console.error('⚠️  Produtos migrados, mas falhou a limpeza de itens antigos:', erroDelete.message);
}

const { count } = await supabase.from('produtos').select('id', { count: 'exact', head: true });
console.log(`✅ Migração concluída! ${count ?? linhas.length} produtos no Supabase.`);
if (removidos?.length) console.log(`🧹 ${removidos.length} itens antigos removidos.`);

