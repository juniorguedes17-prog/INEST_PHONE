# Escopo Oficial do MVP 1.0

## Objetivo

Este documento registra o escopo oficial do MVP 1.0 da plataforma iNest Phone e estabelece o *feature freeze* dos módulos destinados a evoluções posteriores.

Esta definição não remove nem modifica funcionalidades, módulos, rotas, componentes, APIs, integrações, tabelas ou estruturas existentes. PRD, BRD, SAD e DMS permanecem congelados até o Go Live.

## Módulos Ativos

Os módulos ativos e prioritários do MVP 1.0 são:

1. Dashboard Principal
2. Radar de Preços
3. Precificação
4. Gerador de Ofertas
5. Fornecedores
6. Configurações
7. Clientes, sincronizado com Google Sheets

## Módulos Congelados

Os módulos e capacidades abaixo permanecem existentes no projeto, mas ficam congelados para o MVP 1.0 e planejados para uma versão futura:

- Cadastro manual de Produtos
- Dashboard BI
- Relatórios avançados
- Auditorias complexas
- CRM próprio

Durante o MVP 1.0, esses módulos:

- não receberão novas funcionalidades;
- não receberão melhorias de UX;
- não serão prioridade de desenvolvimento;
- não serão utilizados como referência para novas implementações do MVP.

## Diretriz do Módulo Clientes

O módulo Clientes não funcionará como CRM no MVP 1.0. Seu escopo fica limitado a:

- sincronizar dados com o Google Sheets;
- permitir a consulta dos clientes sincronizados;
- fornecer dados ao Dashboard Principal.

O Google Sheets será a fonte oficial dos dados de clientes durante o MVP 1.0.

## Diretriz do Radar de Preços

O Radar de Preços será o principal módulo operacional do sistema. Sua arquitetura evolutiva será organizada em:

- Brasil
- Paraguai
- EUA

Toda evolução futura relacionada a produtos deverá ocorrer dentro do Radar de Preços, respeitando essa divisão.

## Ordem Oficial de Desenvolvimento

1. Gerador de Ofertas
2. Dashboard Principal
3. Radar de Preços
   - Brasil
   - Paraguai
   - EUA
4. Configuração Financeira USA
5. Integração Clientes com Google Sheets
6. Homologação
7. Go Live

## Regra de Preservação

O *feature freeze* representa apenas uma decisão de prioridade e escopo. Nenhum código, módulo, rota, tabela, componente ou contrato existente deve ser removido em razão deste documento. Qualquer evolução fora do escopo ativo deverá ser planejada para a versão 2.0 ou para um ciclo posterior formalmente aprovado.
