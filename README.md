# ✨ Mercado Livre Achados (Mercadolivreachados)

Vitrine oficial de afiliados desenvolvida com **Next.js 15**, **React 19** e **Tailwind CSS**, combinando a identidade visual de confiança do **Mercado Livre** com gatilhos de conversão e filtros rápidos da **Shopee**.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/LuizGomess19/Mercadolivreachados)

---

## 🚀 Funcionalidades

- **Design Híbrido (Mercado Livre + Shopee)**:
  - Fundo cinza suave (`bg-gray-100`) e container responsivo (`max-w-7xl mx-auto`).
  - Cabeçalho Mercado Livre em amarelo vibrante (`#FFE600`) com busca embutida por código (ex: `001`, `102`).
  - Menu de filtros deslizante Shopee com pílulas laranjas (`#EE4D2D`).
  - Cards de produto com imagem 3:4, código em badge escuro, selo `Em Alta🔥`, frete grátis clássico em verde e botão `Ver na Loja` de largura total.
  - Botão de compartilhamento direto no **WhatsApp** com mensagem pronta de conversão.
  - Sistema de **Favoritos / Salvos (❤️)** salvo no navegador.

- **Categorias & Departamentos**:
  - 👗 **Moda**: Looks de Natal e Réveillon separados por Masculino e Feminino.
  - 🎄 **Decoração**: Árvores, guirlandas, iluminação LED, mesa posta para ceia e balões.
  - 📱 **Tecnologia**: Fones, caixas de som, smartwatches e iluminação inteligente.

- **👑 Modo Proprietário Secreto (Invisível para Clientes)**:
  - Ativação secreta digitando `#1234` ou `#admin` na busca do site.
  - Adição de novos links com auto-classificação inteligente por departamento.
  - Botões `✏️ Editar` e `🗑️ Excluir` direto em cada card de produto da página.
  - Salvamento automático persistente via rota `PUT /api/produtos` e `localStorage`.

---

## 🛠️ Tecnologias

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
- **UI & Interatividade**: [React 19](https://react.dev/)
- **Estilização**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Tipagem**: TypeScript
- **Persistência**: Route Handler `/api/produtos` + `localStorage`

---

## 📦 Como Rodar Localmente

```bash
# 1. Clone o repositório
git clone https://github.com/LuizGomess19/Mercadolivreachados.git

# 2. Acesse a pasta
cd Mercadolivreachados

# 3. Instale as dependências
npm install

# 4. Inicie o servidor local
npm run dev
```

Acesse em seu navegador: [http://localhost:3000](http://localhost:3000)

---

## 🌐 Deploy na Vercel (1 Clique)

Clique no botão abaixo para fazer o deploy instantâneo na Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/LuizGomess19/Mercadolivreachados)
