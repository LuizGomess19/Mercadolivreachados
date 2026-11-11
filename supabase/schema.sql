-- =====================================================================
-- Mercado Livre Achados - Banco de dados (Supabase / PostgreSQL)
-- Cole TODO este arquivo no Supabase > SQL Editor > New query > Run
-- =====================================================================

create table if not exists public.produtos (
  id             text primary key,
  codigo         text not null,
  titulo         text not null,
  preco          text not null,
  preco_numerico numeric(10,2) not null default 0,
  preco_antigo   text,
  desconto       text,
  departamento   text not null check (departamento in ('looks', 'decoracao', 'tecnologia')),
  categoria      text not null default '',
  genero         text check (genero in ('Masculino', 'Feminino', 'Unissex')),
  ocasiao        text not null check (ocasiao in ('Natal', 'Réveillon', 'Ambas')),
  ambiente       text,
  loja           text not null check (loja in ('Shopee', 'Mercado Livre', 'Outra')),
  avaliacao      text not null default '4.9',
  vendidos       text not null default '',
  em_alta        boolean not null default true,
  frete_gratis   boolean not null default true,
  imagem         text not null,
  link           text not null,
  criado_em      timestamptz not null default now()
);

create index if not exists produtos_criado_em_idx on public.produtos (criado_em desc);
create index if not exists produtos_departamento_idx on public.produtos (departamento);

-- Segurança: RLS ligado e SEM políticas públicas.
-- Ninguém acessa a tabela direto pelo navegador; somente o servidor do site
-- (via SUPABASE_SERVICE_ROLE_KEY) consegue ler e gravar.
alter table public.produtos enable row level security;

-- Produtos iniciais da vitrine (ignorados se já existirem)
insert into public.produtos (
  id, codigo, titulo, preco, preco_numerico, preco_antigo, desconto, departamento,
  categoria, genero, ocasiao, ambiente, loja, avaliacao, vendidos, em_alta,
  frete_gratis, imagem, link, criado_em
) values
  ('look-001', '001', 'Vestido Midi Acetinado Vermelho Rubi com Fenda Lateral Elegante Festa Natal', 'R$ 129,90', 129.9, 'R$ 179,90', '28% OFF', 'looks', 'Feminino', 'Feminino', 'Natal', null, 'Mercado Livre', '4.9', '+1,2 mil vendidos', true, true, 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=700&q=80', 'https://mercadolivre.com.br', now() - interval '0 minutes'),
  ('look-002', '002', 'Conjunto Alfaiataria Branco Off-White Cropped e Short Saia Réveillon', 'R$ 149,90', 149.9, 'R$ 199,90', '25% OFF', 'looks', 'Feminino', 'Feminino', 'Réveillon', null, 'Shopee', '4.8', '+850 vendidos', true, true, 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=700&q=80', 'https://shopee.com.br', now() - interval '1 minutes'),
  ('look-003', '003', 'Camisa Linho Masculina Manga Curta Branca Premium Virada de Ano Praia', 'R$ 89,90', 89.9, 'R$ 129,90', '31% OFF', 'looks', 'Masculino', 'Masculino', 'Réveillon', null, 'Mercado Livre', '4.9', '+2,4 mil vendidos', true, true, 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=700&q=80', 'https://mercadolivre.com.br', now() - interval '2 minutes'),
  ('look-004', '004', 'Kit Camisa Social Slim Vinho + Calça Chino Bege Masculino Ceia de Natal', 'R$ 164,90', 164.9, 'R$ 229,90', '28% OFF', 'looks', 'Masculino', 'Masculino', 'Natal', null, 'Shopee', '4.7', '+640 vendidos', true, true, 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=700&q=80', 'https://shopee.com.br', now() - interval '3 minutes'),
  ('look-005', '005', 'Macacão Longo Pantalona Verde Esmeralda Decote Transpassado Natal', 'R$ 139,90', 139.9, 'R$ 189,90', '26% OFF', 'looks', 'Feminino', 'Feminino', 'Natal', null, 'Mercado Livre', '4.9', '+920 vendidos', true, true, 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=700&q=80', 'https://mercadolivre.com.br', now() - interval '4 minutes'),
  ('look-006', '006', 'Bermuda Sarja Branca + Camisa Bata Linho Leve Masculina Ano Novo', 'R$ 119,90', 119.9, 'R$ 159,90', '25% OFF', 'looks', 'Masculino', 'Masculino', 'Réveillon', null, 'Shopee', '4.8', '+1,5 mil vendidos', true, true, 'https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&w=700&q=80', 'https://shopee.com.br', now() - interval '5 minutes'),
  ('look-007', '007', 'Vestido Curto Paetê Dourado Brilho Alça Fina Festa Balada Réveillon', 'R$ 159,90', 159.9, 'R$ 219,90', '27% OFF', 'looks', 'Feminino', 'Feminino', 'Réveillon', null, 'Shopee', '5.0', '+3,1 mil vendidos', true, true, 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?auto=format&fit=crop&w=700&q=80', 'https://shopee.com.br', now() - interval '6 minutes'),
  ('look-008', '008', 'Camisa Polo Piquet Vermelho Escuro Masculina Casual Natal em Família', 'R$ 79,90', 79.9, 'R$ 109,90', '27% OFF', 'looks', 'Masculino', 'Masculino', 'Natal', null, 'Mercado Livre', '4.8', '+1,1 mil vendidos', true, true, 'https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?auto=format&fit=crop&w=700&q=80', 'https://mercadolivre.com.br', now() - interval '7 minutes'),
  ('deco-101', '101', 'Árvore de Natal Pinheiro Canadense Cheia 1,80m 450 Galhos + Base Metal', 'R$ 139,90', 139.9, 'R$ 219,90', '36% OFF', 'decoracao', 'Árvores & Guirlandas', null, 'Natal', 'Sala', 'Mercado Livre', '4.9', '+4,5 mil vendidos', true, true, 'https://images.unsplash.com/photo-1544967082-d9d25d867d66?auto=format&fit=crop&w=700&q=80', 'https://mercadolivre.com.br', now() - interval '8 minutes'),
  ('deco-102', '102', 'Cortina 300 LEDs 3x2m Branco Quente 8 Funções Decoração Natal e Réveillon', 'R$ 38,90', 38.9, 'R$ 64,90', '40% OFF', 'decoracao', 'Iluminação LED', null, 'Ambas', 'Varanda & Área Externa', 'Shopee', '4.9', '+8,2 mil vendidos', true, true, 'https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=700&q=80', 'https://shopee.com.br', now() - interval '9 minutes'),
  ('deco-103', '103', 'Kit 6 lugares Mesa Posta Natal Sousplat Dourado + Guardanapo Vermelho e Porta Laço', 'R$ 89,90', 89.9, 'R$ 129,90', '31% OFF', 'decoracao', 'Mesa Posta & Ceia', null, 'Natal', 'Mesa de Ceia', 'Shopee', '5.0', '+1,8 mil vendidos', true, true, 'https://images.unsplash.com/photo-1543589077-47d81606c1bf?auto=format&fit=crop&w=700&q=80', 'https://shopee.com.br', now() - interval '10 minutes'),
  ('deco-104', '104', 'Kit Festa Réveillon Balões Metalizados Dourado e Prata Feliz Ano Novo + Cortina', 'R$ 44,90', 44.9, 'R$ 69,90', '35% OFF', 'decoracao', 'Balões & Réveillon', null, 'Réveillon', 'Festa', 'Mercado Livre', '4.8', '+3,4 mil vendidos', true, true, 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?auto=format&fit=crop&w=700&q=80', 'https://mercadolivre.com.br', now() - interval '11 minutes'),
  ('deco-105', '105', 'Guirlanda de Natal Luxo Porta de Entrada 45cm com Laço Vermelho e Pinhas', 'R$ 69,90', 69.9, 'R$ 99,90', '30% OFF', 'decoracao', 'Árvores & Guirlandas', null, 'Natal', 'Sala', 'Shopee', '4.9', '+2,1 mil vendidos', true, true, 'https://images.unsplash.com/photo-1543258103-a62bdc069871?auto=format&fit=crop&w=700&q=80', 'https://shopee.com.br', now() - interval '12 minutes'),
  ('deco-106', '106', 'Kit 4 Capas de Almofada Natalinas Veludo 45x45cm Estampas Papai Noel e Renas', 'R$ 49,90', 49.9, 'R$ 79,90', '38% OFF', 'decoracao', 'Enfeites & Casa', null, 'Natal', 'Sala', 'Shopee', '4.8', '+5,0 mil vendidos', true, true, 'https://images.unsplash.com/photo-1513297887119-d46091b24bfa?auto=format&fit=crop&w=700&q=80', 'https://shopee.com.br', now() - interval '13 minutes'),
  ('tech-201', '201', 'Caixa de Som Bluetooth Portátil À Prova D’Água 40W Grave Potente Festa e Praia', 'R$ 189,90', 189.9, 'R$ 279,90', '32% OFF', 'tecnologia', 'Áudio & Caixas de Som', null, 'Ambas', null, 'Mercado Livre', '4.9', '+6,8 mil vendidos', true, true, 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=700&q=80', 'https://mercadolivre.com.br', now() - interval '14 minutes'),
  ('tech-202', '202', 'Fone de Ouvido Bluetooth 5.3 TWS Cancelamento de Ruído Display LED Presente Natal', 'R$ 59,90', 59.9, 'R$ 99,90', '40% OFF', 'tecnologia', 'Smartphones & Acessórios', null, 'Natal', null, 'Shopee', '4.8', '+12 mil vendidos', true, true, 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=700&q=80', 'https://shopee.com.br', now() - interval '15 minutes'),
  ('tech-203', '203', 'Smartwatch Relógio Inteligente Amoled Chamadas Bluetooth Monitor Saúde Presente', 'R$ 134,90', 134.9, 'R$ 199,90', '33% OFF', 'tecnologia', 'Smartwatches & Presentes', null, 'Natal', null, 'Mercado Livre', '4.9', '+4,1 mil vendidos', true, true, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80', 'https://mercadolivre.com.br', now() - interval '16 minutes'),
  ('tech-204', '204', 'Fita LED RGB Inteligente Wi-Fi 5m Controle por App e Música Decoração Setup e Sala', 'R$ 47,90', 47.9, 'R$ 79,90', '40% OFF', 'tecnologia', 'Casa Inteligente & LED', null, 'Ambas', null, 'Shopee', '4.8', '+5,4 mil vendidos', true, true, 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=700&q=80', 'https://shopee.com.br', now() - interval '17 minutes')
on conflict (id) do nothing;
