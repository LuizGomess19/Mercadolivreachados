'use client';

import React, { useState, useEffect } from 'react';
import {
  PRODUTOS_INICIAIS,
  ProdutoAfiliado,
  DepartamentoProduto,
  GeneroLook,
  OcasiaoFesta,
} from '@/data/produtos';

const CATEGORIAS_LOOKS = ['Todos', 'Natal', 'Réveillon', 'Masculino', 'Feminino'] as const;
type FiltroCategoriaLook = (typeof CATEGORIAS_LOOKS)[number];

const SUBCATEGORIAS_DECORACAO = [
  'Todas',
  'Árvores & Guirlandas',
  'Iluminação LED',
  'Mesa Posta & Ceia',
  'Balões & Réveillon',
  'Enfeites & Casa',
] as const;

const SUBCATEGORIAS_TECNOLOGIA = [
  'Todas',
  'Áudio & Caixas de Som',
  'Smartphones & Acessórios',
  'Smartwatches & Presentes',
  'Casa Inteligente & LED',
  'Games & Informática',
] as const;

const AMBIENTES_DECORACAO = [
  'Todos Ambientes',
  'Sala',
  'Mesa de Ceia',
  'Varanda & Área Externa',
  'Festa',
] as const;

type FiltroFaixaPreco = 'todos' | 'ate-50' | '50-a-100' | 'acima-100';
type Ordenacao = 'relevancia' | 'menor-preco' | 'maior-preco';
type SecaoAtiva = 'tudo' | 'looks' | 'decoracao' | 'tecnologia' | 'favoritos' | 'admin';

const CACHE_CATALOGO = 'ml_achados_catalogo_cache';

export default function VitrineAfiliadosPage() {
  // Catálogo carregado do banco de dados (via /api/produtos)
  const [catalogo, setCatalogo] = useState<ProdutoAfiliado[]>(PRODUTOS_INICIAIS);
  const [carregandoCatalogo, setCarregandoCatalogo] = useState<boolean>(true);
  const [statusSalvamento, setStatusSalvamento] = useState<string>('');
  const [salvando, setSalvando] = useState<boolean>(false);
  const [bancoPersistente, setBancoPersistente] = useState<boolean | null>(null);

  // Lista de Favoritos (Salvo no navegador do visitante)
  const [favoritosIds, setFavoritosIds] = useState<string[]>([]);

  // Estado global de navegação e busca
  const [buscaCodigo, setBuscaCodigo] = useState<string>('');
  const [secaoAtiva, setSecaoAtiva] = useState<SecaoAtiva>('tudo');
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('relevancia');

  // Filtros de Looks
  const [categoriaLookAtiva, setCategoriaLookAtiva] = useState<FiltroCategoriaLook>('Todos');

  // Filtros de Decoração
  const [subcategoriaDeco, setSubcategoriaDeco] = useState<string>('Todas');
  const [ocasiaoDeco, setOcasiaoDeco] = useState<'Todas' | 'Natal' | 'Réveillon'>('Todas');
  const [ambienteDeco, setAmbienteDeco] = useState<string>('Todos Ambientes');
  const [faixaPrecoDeco, setFaixaPrecoDeco] = useState<FiltroFaixaPreco>('todos');

  // Filtros de Tecnologia
  const [subcategoriaTech, setSubcategoriaTech] = useState<string>('Todas');
  const [faixaPrecoTech, setFaixaPrecoTech] = useState<FiltroFaixaPreco>('todos');

  // =========================================================================
  // ESTADOS EXCLUSIVOS DO PROPRIETÁRIO (SÓ APARECEM PARA VOCÊ)
  // =========================================================================
  const [adminAutenticado, setAdminAutenticado] = useState<boolean>(false);
  const [modalPinAberto, setModalPinAberto] = useState<boolean>(false);
  const [pinDigitado, setPinDigitado] = useState<string>('');
  const [erroPin, setErroPin] = useState<string>('');
  const [cliquesSecretosLogo, setCliquesSecretosLogo] = useState<number>(0);

  // Campos do Formulário de Adicionar / Editar Produto
  const [idEmEdicao, setIdEmEdicao] = useState<string | null>(null);
  const [novoTitulo, setNovoTitulo] = useState<string>('');
  const [novoCodigo, setNovoCodigo] = useState<string>('');
  const [novoPreco, setNovoPreco] = useState<string>('');
  const [novoPrecoAntigo, setNovoPrecoAntigo] = useState<string>('');
  const [novoLink, setNovoLink] = useState<string>('');
  const [novaImagem, setNovaImagem] = useState<string>('');
  const [novoDepartamento, setNovoDepartamento] = useState<DepartamentoProduto>('looks');
  const [novoGenero, setNovoGenero] = useState<GeneroLook>('Feminino');
  const [novaCategoria, setNovaCategoria] = useState<string>('Feminino');
  const [novaOcasiao, setNovaOcasiao] = useState<OcasiaoFesta>('Natal');
  const [novoAmbiente, setNovoAmbiente] = useState<string>('Sala');
  const [novaLoja, setNovaLoja] = useState<'Shopee' | 'Mercado Livre' | 'Outra'>('Shopee');
  const [autoClassificar, setAutoClassificar] = useState<boolean>(true);
  const [mensagemSucesso, setMensagemSucesso] = useState<string>('');
  const [copiadoId, setCopiadoId] = useState<string>('');
  const [filtroGerenciarDepto, setFiltroGerenciarDepto] = useState<'todos' | DepartamentoProduto>('todos');

  // Carrega produtos do banco e verifica no servidor se o dono está autenticado
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pediuAdmin = params.get('admin') === '1' || params.get('admin') === 'true';

    async function verificarSessao() {
      try {
        const res = await fetch('/api/admin', { cache: 'no-store' });
        const data = await res.json();
        setAdminAutenticado(!!data.autenticado);
        if (pediuAdmin) {
          if (data.autenticado) setSecaoAtiva('admin');
          else setModalPinAberto(true);
        }
      } catch {
        if (pediuAdmin) setModalPinAberto(true);
      }
    }

    const favSalvos = localStorage.getItem('afiliado_favoritos');
    if (favSalvos) {
      try {
        setFavoritosIds(JSON.parse(favSalvos));
      } catch {
        // Ignora
      }
    }

    // Remove chaves antigas que não são mais usadas (o banco é a fonte da verdade)
    localStorage.removeItem('afiliado_admin_auth');
    localStorage.removeItem('afiliado_catalogo_backup');

    async function carregarProdutos() {
      try {
        const res = await fetch('/api/produtos', { cache: 'no-store' });
        if (!res.ok) throw new Error('Falha ao carregar');
        const data = await res.json();
        if (Array.isArray(data.produtos)) {
          setCatalogo(data.produtos);
          setBancoPersistente(!!data.persistente);
          // Cache SOMENTE leitura, usado se a internet/servidor falhar
          localStorage.setItem(CACHE_CATALOGO, JSON.stringify(data.produtos));
        }
      } catch {
        const cache = localStorage.getItem(CACHE_CATALOGO);
        if (cache) {
          try {
            setCatalogo(JSON.parse(cache));
          } catch {
            // mantém PRODUTOS_INICIAIS
          }
        }
      }
      setCarregandoCatalogo(false);
    }

    verificarSessao();
    carregarProdutos();
  }, []);

  const mostrarStatus = (mensagem: string) => {
    setStatusSalvamento(mensagem);
    setTimeout(() => setStatusSalvamento(''), 4000);
  };

  // Envia uma alteração ao banco. Retorna os dados da resposta ou null em caso de erro.
  const enviarAoBanco = async (
    metodo: 'POST' | 'PUT' | 'DELETE',
    corpo?: ProdutoAfiliado,
    id?: string
  ): Promise<{ produto?: ProdutoAfiliado } | null> => {
    setSalvando(true);
    setStatusSalvamento('💾 Salvando no banco de dados...');
    try {
      const url = metodo === 'DELETE' ? `/api/produtos?id=${encodeURIComponent(id || '')}` : '/api/produtos';
      const res = await fetch(url, {
        method: metodo,
        headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setAdminAutenticado(false);
        setModalPinAberto(true);
        mostrarStatus('🔒 Sessão expirada. Entre novamente.');
        return null;
      }
      if (!res.ok || !data.ok) {
        mostrarStatus(`❌ Não foi salvo: ${data.erro || 'erro no servidor'}`);
        return null;
      }
      return data;
    } catch {
      mostrarStatus('❌ Sem conexão com o servidor. Nada foi alterado.');
      return null;
    } finally {
      setSalvando(false);
    }
  };

  // Atalho secreto na Barra de Busca: digitar #admin ou #1234 abre o login / painel do proprietário
  const handleBuscaChange = async (valor: string) => {
    const vLimpo = valor.trim().toLowerCase();
    if (vLimpo === '#1234') {
      setBuscaCodigo('');
      try {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: '1234' }),
        });
        if (res.ok) {
          setAdminAutenticado(true);
          setSecaoAtiva('admin');
          return;
        }
      } catch {
        // Fallback abre modal
      }
      setModalPinAberto(true);
      return;
    }
    if (vLimpo === '#admin') {
      setBuscaCodigo('');
      if (adminAutenticado) {
        setSecaoAtiva('admin');
      } else {
        setModalPinAberto(true);
      }
      return;
    }
    setBuscaCodigo(valor);
  };

  // Atalho secreto clicando 5x na logo AF
  const handleCliqueLogo = () => {
    setBuscaCodigo('');
    if (secaoAtiva === 'admin') {
      setSecaoAtiva('tudo');
      return;
    }
    const proximo = cliquesSecretosLogo + 1;
    if (proximo >= 5) {
      setCliquesSecretosLogo(0);
      if (adminAutenticado) {
        setSecaoAtiva('admin');
      } else {
        setModalPinAberto(true);
      }
    } else {
      setCliquesSecretosLogo(proximo);
    }
  };

  // Alterna Favoritos
  const toggleFavorito = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    let novosFavs: string[];
    if (favoritosIds.includes(id)) {
      novosFavs = favoritosIds.filter((item) => item !== id);
    } else {
      novosFavs = [...favoritosIds, id];
    }
    setFavoritosIds(novosFavs);
    localStorage.setItem('afiliado_favoritos', JSON.stringify(novosFavs));
  };

  // Sugere automaticamente o próximo código disponível quando NÃO está editando um produto existente
  useEffect(() => {
    if (idEmEdicao) return;
    const prefixo =
      novoDepartamento === 'looks' ? 0 : novoDepartamento === 'decoracao' ? 100 : 200;
    const codigosDepto = catalogo
      .filter((p) => p.departamento === novoDepartamento)
      .map((p) => parseInt(p.codigo.replace(/\D/g, ''), 10))
      .filter((n) => !isNaN(n));

    const maior = codigosDepto.length > 0 ? Math.max(...codigosDepto) : prefixo;
    const proximo = String(maior + 1).padStart(3, '0');
    setNovoCodigo(proximo);
  }, [novoDepartamento, catalogo, idEmEdicao]);

  // Inteligência de Classificação Automática ao digitar Título
  const handleTituloChange = (texto: string) => {
    setNovoTitulo(texto);
    if (!autoClassificar) return;

    const t = texto.toLowerCase();

    if (
      t.includes('fone') ||
      t.includes('caixa de som') ||
      t.includes('bluetooth') ||
      t.includes('smartwatch') ||
      t.includes('relógio') ||
      t.includes('celular') ||
      t.includes('iphone') ||
      t.includes('carregador') ||
      t.includes('gamer') ||
      t.includes('fita led') ||
      t.includes('alexa') ||
      t.includes('projetor')
    ) {
      setNovoDepartamento('tecnologia');
      if (t.includes('caixa') || t.includes('som') || t.includes('áudio')) {
        setNovaCategoria('Áudio & Caixas de Som');
      } else if (t.includes('smartwatch') || t.includes('relógio')) {
        setNovaCategoria('Smartwatches & Presentes');
      } else if (t.includes('fita') || t.includes('inteligente') || t.includes('alexa')) {
        setNovaCategoria('Casa Inteligente & LED');
      } else if (t.includes('game') || t.includes('teclado') || t.includes('mouse')) {
        setNovaCategoria('Games & Informática');
      } else {
        setNovaCategoria('Smartphones & Acessórios');
      }
    } else if (
      t.includes('árvore') ||
      t.includes('guirlanda') ||
      t.includes('pisca') ||
      t.includes('cortina') ||
      t.includes('sousplat') ||
      t.includes('mesa posta') ||
      t.includes('taça') ||
      t.includes('guardanapo') ||
      t.includes('balão') ||
      t.includes('balões') ||
      t.includes('almofada') ||
      t.includes('papai noel') ||
      t.includes('enfeite') ||
      t.includes('bola de natal') ||
      t.includes('decoração')
    ) {
      setNovoDepartamento('decoracao');
      if (t.includes('árvore') || t.includes('guirlanda') || t.includes('pinheiro')) {
        setNovaCategoria('Árvores & Guirlandas');
        setNovoAmbiente('Sala');
      } else if (t.includes('led') || t.includes('pisca') || t.includes('luz') || t.includes('cascata')) {
        setNovaCategoria('Iluminação LED');
        setNovoAmbiente('Varanda & Área Externa');
      } else if (t.includes('mesa') || t.includes('sousplat') || t.includes('taça') || t.includes('guardanapo')) {
        setNovaCategoria('Mesa Posta & Ceia');
        setNovoAmbiente('Mesa de Ceia');
      } else if (t.includes('balão') || t.includes('balões')) {
        setNovaCategoria('Balões & Réveillon');
        setNovoAmbiente('Festa');
      } else {
        setNovaCategoria('Enfeites & Casa');
        setNovoAmbiente('Sala');
      }
    } else if (
      t.includes('vestido') ||
      t.includes('camisa') ||
      t.includes('conjunto') ||
      t.includes('macacão') ||
      t.includes('saia') ||
      t.includes('blusa') ||
      t.includes('bermuda') ||
      t.includes('calça') ||
      t.includes('cropped') ||
      t.includes('terno') ||
      t.includes('polo') ||
      t.includes('masculin') ||
      t.includes('feminin')
    ) {
      setNovoDepartamento('looks');
      if (
        t.includes('masculin') ||
        t.includes('bermuda') ||
        t.includes('polo') ||
        t.includes('barba') ||
        t.includes('homem')
      ) {
        setNovoGenero('Masculino');
        setNovaCategoria('Masculino');
      } else {
        setNovoGenero('Feminino');
        setNovaCategoria('Feminino');
      }
    }

    if (t.includes('réveillon') || t.includes('reveillon') || t.includes('ano novo') || t.includes('virada')) {
      setNovaOcasiao('Réveillon');
    } else if (t.includes('natal') || t.includes('noel')) {
      setNovaOcasiao('Natal');
    }
  };

  const handleLinkChange = (url: string) => {
    setNovoLink(url);
    const u = url.toLowerCase();
    if (u.includes('shopee')) {
      setNovaLoja('Shopee');
    } else if (u.includes('mercadolivre') || u.includes('meli')) {
      setNovaLoja('Mercado Livre');
    }
  };

  const extrairNumeroPreco = (valorStr: string): number => {
    const limpo = valorStr.replace(/[^\d,.-]/g, '').replace(',', '.');
    const num = parseFloat(limpo);
    return isNaN(num) ? 0 : num;
  };

  const formatarMoeda = (num: number): string => {
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const precoAtualNum = extrairNumeroPreco(novoPreco);
  const precoAntigoNum = extrairNumeroPreco(novoPrecoAntigo);
  const descontoCalculado =
    precoAntigoNum > precoAtualNum && precoAtualNum > 0
      ? `${Math.round(((precoAntigoNum - precoAtualNum) / precoAntigoNum) * 100)}% OFF`
      : undefined;

  // Carregar produto no formulário para Editar Link / Preço / Dados
  const iniciarEdicaoProduto = (e: React.MouseEvent | null, item: ProdutoAfiliado) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIdEmEdicao(item.id);
    setNovoTitulo(item.titulo);
    setNovoCodigo(item.codigo);
    setNovoPreco(item.preco);
    setNovoPrecoAntigo(item.precoAntigo || '');
    setNovoLink(item.link);
    setNovaImagem(item.imagem);
    setNovoDepartamento(item.departamento);
    setNovoGenero(item.genero || 'Feminino');
    setNovaCategoria(item.categoria);
    setNovaOcasiao(item.ocasiao);
    setNovoAmbiente(item.ambiente || 'Sala');
    setNovaLoja(item.loja);
    setSecaoAtiva('admin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicao = () => {
    setIdEmEdicao(null);
    setNovoTitulo('');
    setNovoPreco('');
    setNovoPrecoAntigo('');
    setNovoLink('');
    setNovaImagem('');
  };

  // Salvar Novo Produto ou Atualizar Produto Editado
  const handleSalvarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    if (!novoTitulo.trim() || !novoPreco.trim() || !novoLink.trim()) return;

    const numPreco = extrairNumeroPreco(novoPreco);
    const precoFormatado = novoPreco.trim().startsWith('R$')
      ? novoPreco.trim()
      : formatarMoeda(numPreco);

    const numAntigo = extrairNumeroPreco(novoPrecoAntigo);
    const precoAntigoFormatado =
      numAntigo > 0
        ? novoPrecoAntigo.trim().startsWith('R$')
          ? novoPrecoAntigo.trim()
          : formatarMoeda(numAntigo)
        : undefined;

    const categoriaFinal =
      novoDepartamento === 'looks' ? novoGenero : novaCategoria;

    const itemSalvo: ProdutoAfiliado = {
      id: idEmEdicao || `${novoDepartamento}-${Date.now()}`,
      codigo: novoCodigo.trim().replace(/^#/, '') || '999',
      titulo: novoTitulo.trim(),
      preco: precoFormatado,
      precoNumerico: numPreco,
      precoAntigo: precoAntigoFormatado,
      desconto: descontoCalculado,
      departamento: novoDepartamento,
      categoria: categoriaFinal,
      genero: novoDepartamento === 'looks' ? novoGenero : undefined,
      ocasiao: novaOcasiao,
      ambiente: novoDepartamento === 'decoracao' ? novoAmbiente : undefined,
      loja: novaLoja,
      avaliacao: '4.9',
      vendidos: idEmEdicao ? 'Oferta Verificada 🔥' : 'Novo na vitrine 🔥',
      emAlta: true,
      freteGratis: true,
      imagem:
        novaImagem.trim() ||
        'https://images.unsplash.com/photo-1513297887119-d46091b24bfa?auto=format&fit=crop&w=700&q=80',
      link: novoLink.trim(),
      criadoEm: new Date().toISOString(),
    };

    // Salva no banco PRIMEIRO; a vitrine só muda se o banco confirmar
    const resposta = await enviarAoBanco(idEmEdicao ? 'PUT' : 'POST', itemSalvo);
    if (!resposta?.produto) return;
    const produtoSalvo = resposta.produto;

    setCatalogo((atual) =>
      idEmEdicao
        ? atual.map((p) => (p.id === idEmEdicao ? produtoSalvo : p))
        : [produtoSalvo, ...atual]
    );
    mostrarStatus(
      idEmEdicao
        ? `✅ Produto #${produtoSalvo.codigo} atualizado no banco!`
        : `✅ Novo link #${produtoSalvo.codigo} salvo no banco!`
    );

    setMensagemSucesso(
      idEmEdicao
        ? `Link/Produto #${produtoSalvo.codigo} alterado e salvo no banco de dados!`
        : `Novo Link #${produtoSalvo.codigo} salvo no banco de dados em "${
            produtoSalvo.departamento === 'looks'
              ? `Moda (${produtoSalvo.genero})`
              : produtoSalvo.departamento === 'decoracao'
              ? `Decoração (${produtoSalvo.categoria})`
              : `Tecnologia (${produtoSalvo.categoria})`
          }"!`
    );

    cancelarEdicao();
    setTimeout(() => setMensagemSucesso(''), 5000);
  };

  // Excluir Produto (Direto do Card na Página ou da Lista Admin)
  const handleExcluirProduto = async (e: React.MouseEvent | null, id: string, codigo?: string) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!window.confirm(`Excluir o produto ${codigo ? `#${codigo}` : ''} da vitrine? Essa ação é permanente.`)) {
      return;
    }
    const resposta = await enviarAoBanco('DELETE', undefined, id);
    if (!resposta) return;
    setCatalogo((atual) => atual.filter((item) => item.id !== id));
    if (idEmEdicao === id) cancelarEdicao();
    mostrarStatus(`🗑️ Produto ${codigo ? `#${codigo}` : ''} excluído do banco!`);
  };

  // Login do proprietário (senha verificada no servidor)
  const handleLoginAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroPin('');
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinDigitado }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setAdminAutenticado(true);
        setModalPinAberto(false);
        setSecaoAtiva('admin');
        setPinDigitado('');
      } else {
        setErroPin(data.erro || 'Senha incorreta.');
      }
    } catch {
      setErroPin('Sem conexão com o servidor.');
    }
  };

  // Logout do proprietário (remove o cookie de sessão no servidor)
  const handleSairAdmin = async () => {
    try {
      await fetch('/api/admin', { method: 'DELETE' });
    } catch {
      // ignora
    }
    setAdminAutenticado(false);
    cancelarEdicao();
    if (secaoAtiva === 'admin') setSecaoAtiva('tudo');
  };

  // Copia mensagem pronta para divulgação
  const copiarMensagemDivulgacao = (item: ProdutoAfiliado) => {
    const texto = `🔥 ACHADINHO EM ALTA #${item.codigo}\n\n✨ ${item.titulo}\n💰 Por apenas ${item.preco} (Frete Grátis ⚡)\n\n👉 Link oficial na loja: ${item.link}`;
    navigator.clipboard.writeText(texto);
    setCopiadoId(item.id);
    setTimeout(() => setCopiadoId(''), 3000);
  };

  // ==========================================================
  // FILTRAGEM E ORDENAÇÃO DOS DEPARTAMENTOS
  // ==========================================================
  const termoLimpo = buscaCodigo.trim().replace(/^#/, '').toLowerCase();

  const ordenarLista = (lista: ProdutoAfiliado[]) => {
    return [...lista].sort((a, b) => {
      if (ordenacao === 'menor-preco') return a.precoNumerico - b.precoNumerico;
      if (ordenacao === 'maior-preco') return b.precoNumerico - a.precoNumerico;
      return 0;
    });
  };

  const looksFiltrados = ordenarLista(
    catalogo.filter((item) => {
      if (item.departamento !== 'looks') return false;
      const matchBusca =
        termoLimpo === '' ||
        item.codigo.toLowerCase().includes(termoLimpo) ||
        item.titulo.toLowerCase().includes(termoLimpo);
      const matchCategoria =
        categoriaLookAtiva === 'Todos' ||
        item.ocasiao === categoriaLookAtiva ||
        item.genero === categoriaLookAtiva ||
        item.categoria === categoriaLookAtiva;
      return matchBusca && matchCategoria;
    })
  );

  const decoracoesFiltradas = ordenarLista(
    catalogo.filter((item) => {
      if (item.departamento !== 'decoracao') return false;
      const matchBusca =
        termoLimpo === '' ||
        item.codigo.toLowerCase().includes(termoLimpo) ||
        item.titulo.toLowerCase().includes(termoLimpo) ||
        item.categoria.toLowerCase().includes(termoLimpo);
      const matchSub =
        subcategoriaDeco === 'Todas' || item.categoria === subcategoriaDeco;
      const matchOcasiao =
        ocasiaoDeco === 'Todas' ||
        item.ocasiao === ocasiaoDeco ||
        item.ocasiao === 'Ambas';
      const matchAmbiente =
        ambienteDeco === 'Todos Ambientes' || item.ambiente === ambienteDeco;
      const matchPreco =
        faixaPrecoDeco === 'todos' ||
        (faixaPrecoDeco === 'ate-50' && item.precoNumerico <= 50) ||
        (faixaPrecoDeco === '50-a-100' && item.precoNumerico > 50 && item.precoNumerico <= 100) ||
        (faixaPrecoDeco === 'acima-100' && item.precoNumerico > 100);
      return matchBusca && matchSub && matchOcasiao && matchAmbiente && matchPreco;
    })
  );

  const tecnologiaFiltrada = ordenarLista(
    catalogo.filter((item) => {
      if (item.departamento !== 'tecnologia') return false;
      const matchBusca =
        termoLimpo === '' ||
        item.codigo.toLowerCase().includes(termoLimpo) ||
        item.titulo.toLowerCase().includes(termoLimpo) ||
        item.categoria.toLowerCase().includes(termoLimpo);
      const matchSub =
        subcategoriaTech === 'Todas' || item.categoria === subcategoriaTech;
      const matchPreco =
        faixaPrecoTech === 'todos' ||
        (faixaPrecoTech === 'ate-50' && item.precoNumerico <= 50) ||
        (faixaPrecoTech === '50-a-100' && item.precoNumerico > 50 && item.precoNumerico <= 100) ||
        (faixaPrecoTech === 'acima-100' && item.precoNumerico > 100);
      return matchBusca && matchSub && matchPreco;
    })
  );

  const favoritosFiltrados = ordenarLista(
    catalogo.filter((item) => favoritosIds.includes(item.id))
  );

  // Renderizador do Card Híbrido (Com botões de Editar e Excluir que SÓ aparecem para o Admin)
  const renderCardProduto = (item: ProdutoAfiliado, isPreview = false) => {
    const isFavorito = favoritosIds.includes(item.id);
    const msgWhats = encodeURIComponent(
      `Olha esse achadinho que encontrei na vitrine! #${item.codigo} - ${item.titulo} por ${item.preco}: ${item.link}`
    );

    return (
      <div
        key={item.id}
        className="group relative flex flex-col bg-white rounded-md sm:rounded-lg shadow-xs hover:shadow-md border border-gray-100 hover:border-[#EE4D2D]/40 transition-all duration-200 overflow-hidden"
      >
        {/* BARRA DE AÇÃO RÁPIDA DIRETO NO CARD (SÓ APARECE PARA VOCÊ QUANDO LOGADO) */}
        {adminAutenticado && !isPreview && (
          <div className="bg-gray-900 text-white px-2 py-1.5 flex items-center justify-between gap-1 text-[11px] font-bold border-b border-gray-800">
            <button
              type="button"
              onClick={(e) => iniciarEdicaoProduto(e, item)}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-1 px-2 rounded-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
              title="Alterar link, preço ou foto deste produto"
            >
              <span>✏️ Editar</span>
            </button>
            <button
              type="button"
              onClick={(e) => handleExcluirProduto(e, item.id, item.codigo)}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white py-1 px-2 rounded-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
              title="Excluir este produto da vitrine"
            >
              <span>🗑️ Excluir</span>
            </button>
          </div>
        )}

        {/* Link do Produto */}
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col flex-1"
        >
          {/* Imagem 3:4 */}
          <div className="relative w-full aspect-[3/4] bg-gray-100 overflow-hidden">
            <img
              src={item.imagem}
              alt={item.titulo}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />

            {/* Tag Código */}
            <span className="absolute top-2 left-2 bg-black/85 text-white text-[11px] sm:text-xs font-extrabold px-2 py-0.5 rounded-xs tracking-wide shadow-2xs">
              #{item.codigo}
            </span>

            {/* Botão de Favoritar (Coração) */}
            {!isPreview && (
              <button
                type="button"
                onClick={(e) => toggleFavorito(e, item.id)}
                aria-label="Salvar nos Favoritos"
                className={`absolute top-2 right-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-transform active:scale-90 shadow-2xs cursor-pointer ${
                  isFavorito
                    ? 'bg-red-500 text-white'
                    : 'bg-white/80 hover:bg-white text-gray-700'
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 fill-current"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </button>
            )}

            {/* Tag Em Alta */}
            {item.emAlta && (
              <span className="absolute bottom-2 left-2 bg-[#EE4D2D] text-white text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-xs shadow-xs">
                Em Alta🔥
              </span>
            )}
          </div>

          {/* Corpo do Card */}
          <div className="flex flex-col flex-1 justify-between p-2.5 sm:p-3.5">
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="inline-block text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-xs">
                  {item.categoria}
                </span>
                <span className="text-[10px] font-bold text-gray-400">
                  {item.loja}
                </span>
              </div>

              <h3 className="text-xs sm:text-sm text-gray-700 font-normal line-clamp-2 leading-snug min-h-[2.25rem] sm:min-h-[2.5rem] group-hover:text-gray-900">
                {item.titulo}
              </h3>

              {item.precoAntigo && (
                <p className="mt-1.5 text-[11px] text-gray-400 line-through leading-none">
                  {item.precoAntigo}
                </p>
              )}

              <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                <p className="text-base sm:text-xl font-extrabold text-gray-900 leading-none">
                  {item.preco}
                </p>
                {item.desconto && (
                  <span className="text-[10px] sm:text-xs font-bold text-[#00A650]">
                    {item.desconto}
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex items-center justify-between text-[11px] sm:text-xs">
                <span className="font-bold text-[#00A650]">Frete Grátis ⚡</span>
                <span className="text-[10px] text-gray-400 hidden sm:inline">
                  ★ {item.avaliacao}
                </span>
              </div>

              <p className="mt-0.5 text-[10px] text-gray-400">{item.vendidos}</p>
            </div>
          </div>
        </a>

        {/* Botões de Ação na Base: Ver na Loja + Compartilhar WhatsApp */}
        <div className="p-2.5 sm:p-3.5 pt-0 flex items-center gap-1.5">
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-[#EE4D2D] hover:bg-[#d84325] text-white text-xs sm:text-sm font-semibold py-2 sm:py-2.5 px-2 rounded-xs sm:rounded-sm flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span>Ver na Loja</span>
          </a>

          <a
            href={`https://api.whatsapp.com/send?text=${msgWhats}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Compartilhar no WhatsApp"
            title="Compartilhar no WhatsApp"
            className="w-8 h-8 sm:w-9 sm:h-9 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xs sm:rounded-sm flex items-center justify-center shrink-0 transition-colors shadow-2xs"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 fill-current"
              viewBox="0 0 24 24"
            >
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.275.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.086s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824z" />
            </svg>
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 text-gray-900">
      {/* =================================================================== */}
      {/* BARRA FLUTUANTE EXCLUSIVA DO PROPRIETÁRIO (SÓ APARECE PARA VOCÊ!)   */}
      {/* =================================================================== */}
      {adminAutenticado && (
        <div className="bg-gray-900 text-white px-3 sm:px-6 py-2 text-xs border-b border-gray-800">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="bg-[#FFE600] text-gray-900 font-extrabold px-2 py-0.5 rounded-xs text-[10px] uppercase">
                👑 Modo Proprietário (Só você vê)
              </span>
              {bancoPersistente === false && (
                <span
                  className="bg-red-600 text-white font-bold px-2 py-0.5 rounded-xs text-[10px]"
                  title="Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para salvar de forma permanente"
                >
                  ⚠️ Banco não configurado — alterações só locais
                </span>
              )}
              {bancoPersistente === true && !statusSalvamento && (
                <span className="text-green-400 font-semibold">🗄️ Banco de dados conectado</span>
              )}
              {statusSalvamento && (
                <span
                  className={`font-bold ${
                    statusSalvamento.startsWith('❌') || statusSalvamento.startsWith('🔒')
                      ? 'text-red-300'
                      : 'text-green-400'
                  }`}
                >
                  {statusSalvamento}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  cancelarEdicao();
                  setSecaoAtiva('admin');
                }}
                className={`px-3 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                  secaoAtiva === 'admin'
                    ? 'bg-[#EE4D2D] text-white'
                    : 'bg-green-600 hover:bg-green-500 text-white'
                }`}
              >
                ➕ Adicionar Novo Link
              </button>

              {secaoAtiva === 'admin' && (
                <button
                  type="button"
                  onClick={() => setSecaoAtiva('tudo')}
                  className="px-3 py-1 rounded-md bg-white/15 hover:bg-white/25 text-white font-semibold cursor-pointer"
                >
                  👁️ Ver Página Principal
                </button>
              )}

              <button
                type="button"
                onClick={handleSairAdmin}
                className="px-2.5 py-1 rounded-md bg-red-500/20 hover:bg-red-500/40 text-red-200 font-semibold cursor-pointer"
                title="Sai do modo proprietário neste aparelho (digite #admin na busca para entrar de novo)"
              >
                Sair do Admin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SECRETO DE PIN (SÓ ABRE QUANDO VOCÊ ATIVA O ATALHO SECRETO) */}
      {modalPinAberto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6 text-center relative">
            <button
              type="button"
              onClick={() => setModalPinAberto(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 font-bold text-sm cursor-pointer"
            >
              ✕
            </button>
            <div className="w-12 h-12 rounded-full bg-gray-900 text-[#FFE600] flex items-center justify-center mx-auto mb-3 text-xl font-bold">
              🔒
            </div>
            <h2 className="text-base font-extrabold text-gray-900">
              Acesso Exclusivo do Proprietário
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Digite sua senha para liberar a adição, edição e exclusão de links neste dispositivo.
            </p>
            <form onSubmit={handleLoginAdmin} className="mt-4 space-y-3">
              <input
                type="password"
                autoFocus
                value={pinDigitado}
                onChange={(e) => setPinDigitado(e.target.value)}
                placeholder="Sua senha de proprietário"
                className="w-full text-center text-base font-bold tracking-widest border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-[#EE4D2D]"
              />
              {erroPin && <p className="text-xs text-red-600 font-semibold">{erroPin}</p>}
              <button
                type="submit"
                className="w-full bg-[#EE4D2D] hover:bg-[#d84325] text-white font-bold text-sm py-2.5 rounded-lg cursor-pointer"
              >
                Liberar Modo Proprietário
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Cabeçalho Responsivo (Estilo Mercado Livre) */}
      <header className="sticky top-0 z-30 w-full bg-[#FFE600] shadow-xs border-b border-yellow-400/60">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 md:gap-6">
            {/* Marca (Clicar 5x ativa o modo secreto do dono) */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleCliqueLogo}
                className="flex items-center gap-2 text-left cursor-pointer select-none"
              >
                <span className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-900 text-[#FFE600] font-black text-sm sm:text-base shadow-2xs">
                  ML
                </span>
                <div>
                  <span className="block text-sm sm:text-base font-extrabold tracking-tight text-gray-900 leading-none">
                    MERCADO LIVRE ACHADOS
                  </span>
                  <span className="block text-[11px] text-gray-700 font-medium mt-0.5">
                    Moda • Decoração • Tecnologia
                  </span>
                </div>
              </button>

              {/* Botões Rápidos no Mobile (Sem botão Admin visível para clientes!) */}
              <div className="flex md:hidden items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSecaoAtiva('favoritos')}
                  className="relative p-1.5 rounded-full bg-white/80 text-red-500 shadow-2xs"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 fill-current"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  {favoritosIds.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-gray-900 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {favoritosIds.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Barra de Pesquisa Embutida */}
            <div className="relative flex items-center w-full md:max-w-xl lg:max-w-2xl bg-white rounded-full shadow-xs px-4 py-2 sm:py-2.5 focus-within:ring-2 focus-within:ring-[#EE4D2D]/40 transition-shadow">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 mr-2.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z"
                />
              </svg>

              <input
                type="text"
                value={buscaCodigo}
                onChange={(e) => handleBuscaChange(e.target.value)}
                placeholder="Buscar código do look (ex: 012)"
                className="w-full bg-transparent text-sm sm:text-base text-gray-800 placeholder-gray-400 focus:outline-none"
              />

              {buscaCodigo && (
                <button
                  type="button"
                  onClick={() => setBuscaCodigo('')}
                  aria-label="Limpar busca"
                  className="text-xs sm:text-sm text-gray-400 hover:text-gray-700 ml-2 font-bold px-1.5 py-0.5 rounded-full hover:bg-gray-100 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Botões Desktop para Clientes: Frete Grátis + Favoritos */}
            <div className="hidden md:flex items-center gap-2.5 shrink-0">
              <div className="flex items-center gap-1.5 bg-white/75 px-3 py-1.5 rounded-full text-xs font-bold text-gray-900 shadow-2xs">
                <span className="text-[#00A650]">⚡</span> Frete Grátis
              </div>

              <button
                type="button"
                onClick={() => setSecaoAtiva('favoritos')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-2xs transition-colors cursor-pointer ${
                  secaoAtiva === 'favoritos'
                    ? 'bg-red-500 text-white'
                    : 'bg-white/80 hover:bg-white text-gray-800'
                }`}
              >
                <span className="text-red-500">❤️</span>
                <span>Favoritos ({favoritosIds.length})</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Barra de Departamentos */}
      <div className="w-full bg-white border-b border-gray-200 sticky top-[93px] md:top-[64px] z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <button
              type="button"
              onClick={() => setSecaoAtiva('tudo')}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                secaoAtiva === 'tudo'
                  ? 'bg-gray-900 text-[#FFE600] border-gray-900 shadow-2xs'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              ✨ Ver Tudo ({looksFiltrados.length + decoracoesFiltradas.length + tecnologiaFiltrada.length})
            </button>

            <button
              type="button"
              onClick={() => setSecaoAtiva('looks')}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                secaoAtiva === 'looks'
                  ? 'bg-[#EE4D2D] text-white border-[#EE4D2D] shadow-2xs'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              👗 Moda ({looksFiltrados.length})
            </button>

            <button
              type="button"
              onClick={() => setSecaoAtiva('decoracao')}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                secaoAtiva === 'decoracao'
                  ? 'bg-[#00A650] text-white border-[#00A650] shadow-2xs'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              🎄 Decoração ({decoracoesFiltradas.length})
            </button>

            <button
              type="button"
              onClick={() => setSecaoAtiva('tecnologia')}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                secaoAtiva === 'tecnologia'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              📱 Tecnologia ({tecnologiaFiltrada.length})
            </button>

            <button
              type="button"
              onClick={() => setSecaoAtiva('favoritos')}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                secaoAtiva === 'favoritos'
                  ? 'bg-red-500 text-white border-red-500 shadow-2xs'
                  : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
              }`}
            >
              ❤️ Salvos ({favoritosIds.length})
            </button>

            {/* A ABA DE GERENCIAR/CADASTRAR SÓ APARECE SE FOR VOCÊ (ADMIN AUTENTICADO) */}
            {adminAutenticado && (
              <button
                type="button"
                onClick={() => setSecaoAtiva('admin')}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                  secaoAtiva === 'admin'
                    ? 'bg-purple-700 text-white border-purple-700 shadow-2xs'
                    : 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100'
                }`}
              >
                ➕ Gerenciar / Adicionar Links
              </button>
            )}
          </div>

          {secaoAtiva !== 'admin' && (
            <div className="flex items-center justify-between sm:justify-end gap-2 text-xs text-gray-500">
              <label htmlFor="ordenar" className="text-gray-500 font-medium">
                Ordenar:
              </label>
              <select
                id="ordenar"
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
                className="bg-gray-50 border border-gray-200 text-gray-700 rounded-md px-2.5 py-1 text-xs font-medium focus:outline-none focus:border-[#EE4D2D] cursor-pointer"
              >
                <option value="relevancia">Mais Relevantes 🔥</option>
                <option value="menor-preco">Menor Preço</option>
                <option value="maior-preco">Maior Preço</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo Principal */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-10">
        {carregandoCatalogo && (
          <div className="text-center py-4 text-xs text-gray-500">
            Carregando catálogo atualizado...
          </div>
        )}

        {/* ========================================================= */}
        {/* ABA EXCLUSIVA DO PROPRIETÁRIO (SÓ APARECE PARA VOCÊ)      */}
        {/* ========================================================= */}
        {secaoAtiva === 'admin' && adminAutenticado && (
          <section className="max-w-5xl mx-auto space-y-8">
            {/* Cabeçalho do Painel Admin */}
            <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white rounded-xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider bg-[#FFE600] text-gray-900 px-2 py-0.5 rounded-xs mb-1">
                  👑 Painel Secreto do Proprietário
                </span>
                <h1 className="text-lg sm:text-2xl font-extrabold">
                  {idEmEdicao
                    ? `✏️ Editando Produto / Link #${novoCodigo}`
                    : '➕ Adicionar Novo Link Afiliado'}
                </h1>
                <p className="text-xs sm:text-sm text-gray-300 mt-0.5">
                  Toda alteração feita aqui salva automaticamente na vitrine e separa por categoria.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                {idEmEdicao && (
                  <button
                    type="button"
                    onClick={cancelarEdicao}
                    className="px-3.5 py-2 rounded-lg bg-yellow-500 text-gray-900 text-xs font-extrabold cursor-pointer"
                  >
                    Cancelar Edição
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSecaoAtiva('tudo')}
                  className="px-3.5 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold cursor-pointer"
                >
                  👁️ Voltar para a Vitrine
                </button>
              </div>
            </div>

            {mensagemSucesso && (
              <div className="bg-green-50 border border-green-300 text-green-900 rounded-lg p-4 text-xs sm:text-sm font-bold flex items-center justify-between shadow-2xs">
                <span>✅ {mensagemSucesso}</span>
                <button
                  type="button"
                  onClick={() => setSecaoAtiva('tudo')}
                  className="bg-[#00A650] text-white px-3 py-1 rounded-md text-xs font-bold cursor-pointer"
                >
                  Ver na vitrine →
                </button>
              </div>
            )}

            {/* Formulário Inteligente + Pré-visualização */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <form
                onSubmit={handleSalvarProduto}
                className="lg:col-span-2 bg-white rounded-xl shadow-xs border border-gray-200 p-4 sm:p-6 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h2 className="text-sm sm:text-base font-extrabold text-gray-900">
                    {idEmEdicao ? '1. Alterar Dados e Link' : '1. Dados do Novo Link'}
                  </h2>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoClassificar}
                      onChange={(e) => setAutoClassificar(e.target.checked)}
                      className="accent-purple-700"
                    />
                    <span>✨ Auto-detectar categoria</span>
                  </label>
                </div>

                {/* Seu Link de Afiliado em Destaque no Topo */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    🔗 Seu Link de Afiliado (Shopee / Mercado Livre) *
                  </label>
                  <input
                    type="url"
                    required
                    value={novoLink}
                    onChange={(e) => handleLinkChange(e.target.value)}
                    placeholder="Cole aqui o seu link de afiliado (https://...)"
                    className="w-full border-2 border-[#EE4D2D]/40 bg-orange-50/20 rounded-lg px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-[#EE4D2D]"
                  />
                </div>

                {/* Título */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Título do Produto *
                  </label>
                  <input
                    type="text"
                    required
                    value={novoTitulo}
                    onChange={(e) => handleTituloChange(e.target.value)}
                    placeholder="Ex: Vestido Longo Vermelho Natal, Camisa Masculina Linho, Caixa de Som Bluetooth..."
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-[#EE4D2D]"
                  />
                </div>

                {/* Preços e Código */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Preço em Oferta (R$) *
                    </label>
                    <input
                      type="text"
                      required
                      value={novoPreco}
                      onChange={(e) => setNovoPreco(e.target.value)}
                      placeholder="Ex: 129,90"
                      className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm font-bold text-gray-900 focus:outline-none focus:border-[#EE4D2D]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Preço Antigo (Opcional)
                    </label>
                    <input
                      type="text"
                      value={novoPrecoAntigo}
                      onChange={(e) => setNovoPrecoAntigo(e.target.value)}
                      placeholder="Ex: 179,90"
                      className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-[#EE4D2D]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Código na Vitrine (#) *
                    </label>
                    <input
                      type="text"
                      required
                      value={novoCodigo}
                      onChange={(e) => setNovoCodigo(e.target.value)}
                      placeholder="Ex: 009"
                      className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm font-extrabold focus:outline-none focus:border-[#EE4D2D]"
                    />
                  </div>
                </div>

                {/* Link da Foto */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    🖼️ Link da Imagem do Produto (URL) *
                  </label>
                  <input
                    type="url"
                    required
                    value={novaImagem}
                    onChange={(e) => setNovaImagem(e.target.value)}
                    placeholder="Cole a URL da foto do produto (https://...)"
                    className="w-full border border-gray-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-[#EE4D2D]"
                  />
                </div>

                {/* Classificação Automática */}
                <div className="pt-3 border-t border-gray-100">
                  <h3 className="text-xs sm:text-sm font-extrabold text-gray-900 mb-2.5">
                    2. Categoria no Site (Separado Automaticamente)
                  </h3>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => {
                        setNovoDepartamento('looks');
                        setNovaCategoria(novoGenero);
                      }}
                      className={`py-2.5 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        novoDepartamento === 'looks'
                          ? 'bg-[#EE4D2D] text-white border-[#EE4D2D] shadow-2xs'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      👗 Moda / Looks
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNovoDepartamento('decoracao');
                        setNovaCategoria('Árvores & Guirlandas');
                      }}
                      className={`py-2.5 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        novoDepartamento === 'decoracao'
                          ? 'bg-[#00A650] text-white border-[#00A650] shadow-2xs'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      🎄 Decoração
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNovoDepartamento('tecnologia');
                        setNovaCategoria('Smartphones & Acessórios');
                      }}
                      className={`py-2.5 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        novoDepartamento === 'tecnologia'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      📱 Tecnologia
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-3.5 rounded-lg border border-gray-200/80">
                    {novoDepartamento === 'looks' && (
                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">
                          Gênero (Masculino / Feminino):
                        </label>
                        <select
                          value={novoGenero}
                          onChange={(e) => {
                            const g = e.target.value as GeneroLook;
                            setNovoGenero(g);
                            setNovaCategoria(g);
                          }}
                          className="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-semibold"
                        >
                          <option value="Feminino">👩 Feminino</option>
                          <option value="Masculino">👨 Masculino</option>
                          <option value="Unissex">✨ Unissex</option>
                        </select>
                      </div>
                    )}

                    {novoDepartamento === 'decoracao' && (
                      <>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            Categoria de Decoração:
                          </label>
                          <select
                            value={novaCategoria}
                            onChange={(e) => setNovaCategoria(e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-semibold"
                          >
                            {SUBCATEGORIAS_DECORACAO.filter((s) => s !== 'Todas').map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            Ambiente:
                          </label>
                          <select
                            value={novoAmbiente}
                            onChange={(e) => setNovoAmbiente(e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-semibold"
                          >
                            {AMBIENTES_DECORACAO.filter((a) => a !== 'Todos Ambientes').map((a) => (
                              <option key={a} value={a}>
                                {a}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {novoDepartamento === 'tecnologia' && (
                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">
                          Categoria de Tecnologia:
                        </label>
                        <select
                          value={novaCategoria}
                          onChange={(e) => setNovaCategoria(e.target.value)}
                          className="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-semibold"
                        >
                          {SUBCATEGORIAS_TECNOLOGIA.filter((t) => t !== 'Todas').map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">
                        Ocasião / Campanha:
                      </label>
                      <select
                        value={novaOcasiao}
                        onChange={(e) => setNovaOcasiao(e.target.value as OcasiaoFesta)}
                        className="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-semibold"
                      >
                        <option value="Natal">🎄 Natal</option>
                        <option value="Réveillon">🥂 Réveillon</option>
                        <option value="Ambas">✨ Natal &amp; Réveillon</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">
                        Loja do Link:
                      </label>
                      <select
                        value={novaLoja}
                        onChange={(e) =>
                          setNovaLoja(e.target.value as 'Shopee' | 'Mercado Livre' | 'Outra')
                        }
                        className="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-semibold"
                      >
                        <option value="Shopee">🧡 Shopee</option>
                        <option value="Mercado Livre">💛 Mercado Livre</option>
                        <option value="Outra">🛒 Outra Loja</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#EE4D2D] hover:bg-[#d84325] text-white font-extrabold text-sm py-3 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {idEmEdicao
                    ? '💾 Salvar Alterações do Link / Produto'
                    : '➕ Adicionar Link e Salvar Automaticamente'}
                </button>
              </form>

              {/* Pré-visualização do Card */}
              <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4 sm:p-5 flex flex-col items-center">
                <span className="text-xs font-extrabold uppercase tracking-wider text-gray-400 mb-3">
                  Pré-visualização Ao Vivo
                </span>

                <div className="w-full max-w-[230px]">
                  {renderCardProduto(
                    {
                      id: 'preview',
                      codigo: novoCodigo || '009',
                      titulo:
                        novoTitulo ||
                        'Título do seu produto aparecerá aqui em até duas linhas...',
                      preco:
                        precoAtualNum > 0
                          ? formatarMoeda(precoAtualNum)
                          : 'R$ 99,90',
                      precoNumerico: precoAtualNum || 99.9,
                      precoAntigo:
                        precoAntigoNum > 0 ? formatarMoeda(precoAntigoNum) : 'R$ 149,90',
                      desconto: descontoCalculado || '33% OFF',
                      departamento: novoDepartamento,
                      categoria:
                        novoDepartamento === 'looks' ? novoGenero : novaCategoria,
                      genero: novoDepartamento === 'looks' ? novoGenero : undefined,
                      ocasiao: novaOcasiao,
                      ambiente: novoAmbiente,
                      loja: novaLoja,
                      avaliacao: '4.9',
                      vendidos: 'Novo na vitrine 🔥',
                      emAlta: true,
                      freteGratis: true,
                      imagem:
                        novaImagem ||
                        'https://images.unsplash.com/photo-1513297887119-d46091b24bfa?auto=format&fit=crop&w=700&q=80',
                      link: novoLink || '#',
                    },
                    true
                  )}
                </div>
              </div>
            </div>

            {/* Lista Completa para Editar ou Excluir Links */}
            <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-gray-100">
                <div>
                  <h2 className="text-base font-extrabold text-gray-900">
                    Gerenciar Todos os Seus Links ({catalogo.length})
                  </h2>
                  <p className="text-xs text-gray-500">
                    Clique em &ldquo;Editar&rdquo; para trocar um link ou preço, ou em &ldquo;Excluir&rdquo; para remover da página.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                  {(['todos', 'looks', 'decoracao', 'tecnologia'] as const).map((dep) => (
                    <button
                      key={dep}
                      type="button"
                      onClick={() => setFiltroGerenciarDepto(dep)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border cursor-pointer ${
                        filtroGerenciarDepto === dep
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                    >
                      {dep === 'todos'
                        ? 'Todos'
                        : dep === 'looks'
                        ? '👗 Moda'
                        : dep === 'decoracao'
                        ? '🎄 Decoração'
                        : '📱 Tecnologia'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-gray-100 mt-2 max-h-96 overflow-y-auto">
                {catalogo
                  .filter(
                    (item) =>
                      filtroGerenciarDepto === 'todos' ||
                      item.departamento === filtroGerenciarDepto
                  )
                  .map((item) => (
                    <div
                      key={item.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={item.imagem}
                          alt={item.titulo}
                          className="w-11 h-14 object-cover rounded-xs bg-gray-100 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-extrabold bg-black text-white px-1.5 py-0.5 rounded-xs">
                              #{item.codigo}
                            </span>
                            <span className="text-[11px] font-bold text-[#EE4D2D] bg-[#EE4D2D]/10 px-2 py-0.5 rounded-full">
                              {item.departamento.toUpperCase()} • {item.categoria}
                            </span>
                            <span className="text-[11px] text-gray-500">
                              ({item.loja})
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm font-medium text-gray-800 truncate mt-0.5">
                            {item.titulo}
                          </p>
                          <p className="text-[11px] text-blue-600 truncate">
                            🔗 {item.link}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => copiarMensagemDivulgacao(item)}
                          className="text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-md border border-gray-200 cursor-pointer"
                        >
                          {copiadoId === item.id ? '✅ Copiado!' : '📋 Copiar'}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => iniciarEdicaoProduto(e, item)}
                          className="text-xs font-semibold text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-md border border-blue-200 cursor-pointer"
                        >
                          ✏️ Editar Link
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleExcluirProduto(e, item.id, item.codigo)}
                          className="text-xs font-semibold text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-md border border-red-200 cursor-pointer"
                        >
                          🗑️ Excluir
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* ABA: MEUS FAVORITOS / SALVOS                              */}
        {/* ========================================================= */}
        {secaoAtiva === 'favoritos' && (
          <section aria-labelledby="titulo-favoritos">
            <div className="bg-white rounded-lg p-3.5 sm:p-5 shadow-xs border border-gray-200/80 mb-4 flex items-center justify-between">
              <div>
                <h2 id="titulo-favoritos" className="text-base sm:text-xl font-extrabold text-gray-900">
                  ❤️ Meus Looks &amp; Achadinhos Salvos
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Itens que você favoritou para conferir ou comprar antes que esgote o estoque.
                </p>
              </div>
              <span className="text-xs font-bold bg-red-50 text-red-600 px-3 py-1 rounded-full border border-red-200">
                {favoritosFiltrados.length} itens
              </span>
            </div>

            {favoritosFiltrados.length === 0 ? (
              <div className="bg-white rounded-lg p-10 text-center shadow-xs max-w-md mx-auto">
                <div className="text-4xl mb-2">❤️</div>
                <p className="text-base font-bold text-gray-800">
                  Você ainda não favoritou nenhum look!
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Clique no coraçãozinho nos cards de produtos para salvá-los aqui.
                </p>
                <button
                  type="button"
                  onClick={() => setSecaoAtiva('tudo')}
                  className="mt-4 px-4 py-2 bg-[#EE4D2D] text-white text-xs font-bold rounded-md cursor-pointer"
                >
                  Explorar Vitrine
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4 lg:gap-5">
                {favoritosFiltrados.map((item) => renderCardProduto(item))}
              </div>
            )}
          </section>
        )}

        {/* ========================================================= */}
        {/* SEÇÃO 1: MODA MASCULINO & FEMININO (LOOKS)                */}
        {/* ========================================================= */}
        {(secaoAtiva === 'tudo' || secaoAtiva === 'looks') && (
          <section aria-labelledby="titulo-looks">
            <div className="bg-white rounded-lg p-3.5 sm:p-5 shadow-xs border border-gray-200/80 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div>
                  <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider text-[#EE4D2D] bg-[#EE4D2D]/10 px-2 py-0.5 rounded-xs mb-1">
                    Moda Fim de Ano • Separado por Masculino &amp; Feminino
                  </span>
                  <h2 id="titulo-looks" className="text-base sm:text-xl font-extrabold text-gray-900">
                    👗 Looks de Natal &amp; Réveillon
                  </h2>
                </div>
                <span className="text-xs text-gray-500">
                  Exibindo <strong>{looksFiltrados.length}</strong> looks
                </span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pt-1">
                {CATEGORIAS_LOOKS.map((categoria) => {
                  const ativo = categoriaLookAtiva === categoria;
                  return (
                    <button
                      key={categoria}
                      type="button"
                      onClick={() => setCategoriaLookAtiva(categoria)}
                      className={`shrink-0 px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium border transition-all duration-150 cursor-pointer ${
                        ativo
                          ? 'text-[#EE4D2D] border-[#EE4D2D] bg-[#EE4D2D]/10 font-semibold shadow-2xs'
                          : 'text-gray-600 border-gray-200 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      {categoria === 'Natal' && '🎄 '}
                      {categoria === 'Réveillon' && '🥂 '}
                      {categoria === 'Masculino' && '👨 '}
                      {categoria === 'Feminino' && '👩 '}
                      {categoria}
                    </button>
                  );
                })}
              </div>
            </div>

            {looksFiltrados.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center shadow-xs">
                <p className="text-sm font-bold text-gray-700">
                  Nenhum look encontrado para este filtro.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4 lg:gap-5">
                {looksFiltrados.map((item) => renderCardProduto(item))}
              </div>
            )}
          </section>
        )}

        {/* ========================================================= */}
        {/* SEÇÃO 2: DECORAÇÕES DE NATAL & RÉVEILLON                  */}
        {/* ========================================================= */}
        {(secaoAtiva === 'tudo' || secaoAtiva === 'decoracao') && (
          <section aria-labelledby="titulo-decoracoes">
            <div className="bg-white rounded-lg p-3.5 sm:p-5 shadow-xs border border-gray-200/80 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-gray-100">
                <div>
                  <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider text-[#00A650] bg-[#00A650]/10 px-2 py-0.5 rounded-xs mb-1">
                    Casa, Ceia &amp; Iluminação
                  </span>
                  <h2 id="titulo-decoracoes" className="text-base sm:text-xl font-extrabold text-gray-900">
                    🎄 Decorações de Natal &amp; Réveillon
                  </h2>
                </div>
                <span className="text-xs bg-gray-100 text-gray-700 font-semibold px-2.5 py-1 rounded-full self-start sm:self-center">
                  {decoracoesFiltradas.length} itens
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                {SUBCATEGORIAS_DECORACAO.map((sub) => {
                  const ativo = subcategoriaDeco === sub;
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSubcategoriaDeco(sub)}
                      className={`shrink-0 px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium border transition-all duration-150 cursor-pointer ${
                        ativo
                          ? 'text-[#EE4D2D] border-[#EE4D2D] bg-[#EE4D2D]/10 font-semibold shadow-2xs'
                          : 'text-gray-600 border-gray-200 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      {sub}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">
                    Ocasião:
                  </label>
                  <div className="flex items-center gap-1.5">
                    {(['Todas', 'Natal', 'Réveillon'] as const).map((oc) => (
                      <button
                        key={oc}
                        type="button"
                        onClick={() => setOcasiaoDeco(oc)}
                        className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium border cursor-pointer ${
                          ocasiaoDeco === oc
                            ? 'border-[#EE4D2D] bg-[#EE4D2D]/10 text-[#EE4D2D] font-bold'
                            : 'border-gray-200 bg-gray-50 text-gray-600'
                        }`}
                      >
                        {oc}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">
                    Ambiente:
                  </label>
                  <select
                    value={ambienteDeco}
                    onChange={(e) => setAmbienteDeco(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-700 rounded-md px-3 py-1.5 text-xs font-medium"
                  >
                    {AMBIENTES_DECORACAO.map((amb) => (
                      <option key={amb} value={amb}>
                        {amb}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">
                    Faixa de Preço:
                  </label>
                  <select
                    value={faixaPrecoDeco}
                    onChange={(e) => setFaixaPrecoDeco(e.target.value as FiltroFaixaPreco)}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-700 rounded-md px-3 py-1.5 text-xs font-medium"
                  >
                    <option value="todos">Qualquer preço</option>
                    <option value="ate-50">Até R$ 50</option>
                    <option value="50-a-100">De R$ 50 a R$ 100</option>
                    <option value="acima-100">Acima de R$ 100</option>
                  </select>
                </div>
              </div>
            </div>

            {decoracoesFiltradas.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center shadow-xs">
                <p className="text-sm font-bold text-gray-700">
                  Nenhuma decoração encontrada com esses filtros.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4 lg:gap-5">
                {decoracoesFiltradas.map((item) => renderCardProduto(item))}
              </div>
            )}
          </section>
        )}

        {/* ========================================================= */}
        {/* SEÇÃO 3: TECNOLOGIA & PRESENTES DE FIM DE ANO             */}
        {/* ========================================================= */}
        {(secaoAtiva === 'tudo' || secaoAtiva === 'tecnologia') && (
          <section aria-labelledby="titulo-tecnologia">
            <div className="bg-white rounded-lg p-3.5 sm:p-5 shadow-xs border border-gray-200/80 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-gray-100">
                <div>
                  <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-xs mb-1">
                    Eletrônicos, Áudio &amp; Presentes
                  </span>
                  <h2 id="titulo-tecnologia" className="text-base sm:text-xl font-extrabold text-gray-900">
                    📱 Tecnologia &amp; Eletrônicos em Oferta
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={faixaPrecoTech}
                    onChange={(e) => setFaixaPrecoTech(e.target.value as FiltroFaixaPreco)}
                    className="bg-gray-50 border border-gray-200 text-gray-700 rounded-md px-3 py-1 text-xs font-medium"
                  >
                    <option value="todos">Qualquer preço</option>
                    <option value="ate-50">Até R$ 50</option>
                    <option value="50-a-100">De R$ 50 a R$ 100</option>
                    <option value="acima-100">Acima de R$ 100</option>
                  </select>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                {SUBCATEGORIAS_TECNOLOGIA.map((sub) => {
                  const ativo = subcategoriaTech === sub;
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSubcategoriaTech(sub)}
                      className={`shrink-0 px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium border transition-all duration-150 cursor-pointer ${
                        ativo
                          ? 'text-[#EE4D2D] border-[#EE4D2D] bg-[#EE4D2D]/10 font-semibold shadow-2xs'
                          : 'text-gray-600 border-gray-200 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      {sub}
                    </button>
                  );
                })}
              </div>
            </div>

            {tecnologiaFiltrada.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center shadow-xs">
                <p className="text-sm font-bold text-gray-700">
                  Nenhum item de tecnologia encontrado para este filtro.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4 lg:gap-5">
                {tecnologiaFiltrada.map((item) => renderCardProduto(item))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Rodapé Responsivo (100% Limpo para os clientes!) */}
      <footer className="w-full bg-white border-t border-gray-200 mt-10 py-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-semibold text-gray-700">
            ✨ Mercado Livre Achados • Moda, Decoração &amp; Tecnologia
          </p>
          <p className="text-gray-400">
            Redirecionamento seguro para lojas oficiais parceiras (Mercado Livre &amp; Shopee).
          </p>
        </div>
      </footer>
    </div>
  );
}
