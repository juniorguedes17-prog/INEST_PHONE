# PRD Consolidado - iNest Phone

## 1. Visao do produto

O iNest Phone e um sistema web de gestao comercial para centralizar a operacao da empresa, reduzir controles manuais em planilhas e criar uma base escalavel para crescimento operacional.

O produto deve apoiar a rotina interna de compra, precificacao, oferta, cadastro, consulta e acompanhamento comercial, mantendo a interface simples, responsiva e adequada para uso diario por uma equipe pequena em expansao.

## 2. Objetivos de negocio

- Reduzir tempo operacional em rotinas comerciais.
- Reduzir erros humanos em cadastros, importacoes, calculos e ofertas.
- Aumentar a velocidade de geracao de ofertas.
- Melhorar a organizacao de fornecedores, produtos e precos.
- Apoiar decisoes comerciais com indicadores confiaveis.
- Criar historico estruturado para analises futuras.
- Preparar a empresa para integracoes e automacoes sem refatoracoes grandes.

## 3. Publico-alvo

Usuarios internos da iNest Phone.

Perfis previstos:

- Administrador
- Gestor
- Operador

As permissoes detalhadas pertencem ao BRD.

## 4. Plataforma

- Aplicacao web.
- Compatibilidade com desktop, tablet e mobile.
- Preparacao para Progressive Web App.

## 5. Modulos do sistema

### MVP 1

- Autenticacao.
- Dashboard inicial.
- Radar de precos.
- Importacao via CSV e Excel.
- Cadastro de fornecedores.
- Cadastro de produtos.
- Precificacao.
- Gerador de ofertas.
- Configuracoes financeiras.

### MVP 2

- Integracao com Google Sheets.
- Integracao com WhatsApp Business.
- CRM.
- Controle de estoque por IMEI.
- Financeiro completo.
- Dashboard avancado.
- Business Intelligence.
- Automacoes.
- Integracoes externas.

## 6. Arquitetura funcional

O sistema deve ser modular. Cada modulo deve possuir fronteiras claras de responsabilidade e permitir evolucao independente.

Os modulos devem compartilhar componentes reutilizaveis, contratos de dados padronizados e regras centralizadas conforme o BRD.

## 7. Requisitos funcionais

### Autenticacao

- Permitir login seguro.
- Controlar sessao do usuario.
- Preparar suporte a perfis de acesso.

### Dashboard inicial

- Exibir indicadores iniciais da operacao.
- Apresentar alertas, ultimas atividades e resumo comercial.
- Considerar regras de elegibilidade de indicadores definidas no BRD.

### Radar de precos

- Listar precos importados de fornecedores.
- Permitir busca, filtros e ordenacao.
- Exibir comparativos por produto e fornecedor.
- Preparar visualizacao de historico de cotacoes.

### Importacao CSV e Excel

- Permitir importacao de listas de fornecedores.
- Exibir resultado de processamento.
- Permitir revisao de inconsistencias.

### Fornecedores

- Cadastrar e consultar fornecedores.
- Armazenar dados basicos de contato e origem.
- Relacionar fornecedores a cotacoes e produtos.

### Produtos

- Cadastrar e consultar produtos.
- Manter dados de modelo, categoria, capacidade, cor e status.
- Relacionar produtos a fornecedores e cotacoes.

### Precificacao

- Permitir simulacao de preco.
- Exibir valores calculados e status da simulacao.
- Utilizar exclusivamente as regras de calculo definidas no BRD.

### Gerador de ofertas

- Gerar mensagens comerciais a partir de templates.
- Permitir pre-visualizacao e copia da mensagem.
- Utilizar exclusivamente templates e variaveis definidos no BRD.

### Configuracoes financeiras

- Permitir ajustes administrativos dos parametros financeiros do sistema.
- Centralizar parametros usados pela precificacao.
- Utilizar a nomenclatura padronizada definida no BRD.

## 8. Requisitos nao funcionais

- Alta performance.
- Responsividade.
- Baixo tempo de carregamento.
- Codigo limpo e manutenivel.
- Componentes reutilizaveis.
- Baixo acoplamento entre modulos.
- Alta coesao.
- Preparacao para milhares de registros.
- Segurança em autenticacao, autorizacao e persistencia.
- Logs e auditoria conforme as regras do BRD.

## 9. UX

- Interface simples, objetiva e com poucos cliques.
- Busca rapida.
- Feedback imediato em importacoes, salvamentos e simulacoes.
- Estados de carregamento, vazio, erro e sucesso.
- Navegacao clara entre modulos.
- Telas responsivas para desktop, tablet e mobile.

## 10. UI e identidade visual

O produto deve seguir a identidade visual da iNest Phone:

- Azul Glow: `#5F7CFF`
- Roxo Tech: `#7B2CFF`
- Branco Gelo: `#F5F7FA`
- Preto Profundo: `#050505`

Tipografia:

- Montserrat
- Inter

Estilo:

- Premium.
- Minimalista.
- Tecnologico.
- Editorial.
- Inspirado no ecossistema Apple.

## 11. Tecnologias

Frontend:

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Query
- React Hook Form
- Zod

Backend:

- NestJS
- Node.js
- TypeScript
- Prisma ORM
- JWT
- Swagger

Banco:

- PostgreSQL

Infraestrutura:

- Docker
- GitHub
- Vercel
- Railway

## 12. Criterios de qualidade

O sistema deve ser considerado pronto para cada fase somente quando:

- Os modulos da fase estiverem integrados.
- A interface estiver responsiva.
- Nao houver erros de lint.
- Nao houver erros de TypeScript.
- As APIs da fase estiverem documentadas.
- O codigo seguir arquitetura modular.
- As principais regras da fase possuirem testes automatizados.
- A performance estiver adequada ao volume esperado.

## 13. Fora do escopo do PRD

O PRD nao contem regras detalhadas de negocio, formulas de calculo, politicas comerciais, templates comerciais ou regras de arredondamento.

Esses itens pertencem exclusivamente ao BRD.
