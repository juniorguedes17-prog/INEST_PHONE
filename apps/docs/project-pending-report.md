# Relatorio de Pendencias do Projeto - iNest Phone

## Status Geral

O MVP esta tecnicamente estruturado e validado nas checagens locais disponiveis.

Ja existem:

- documentacao consolidada;
- banco modelado com Prisma;
- frontend Next.js;
- backend NestJS;
- modulos principais implementados;
- QA tecnico inicial;
- preparacao de deploy e Go Live.

O projeto ainda nao deve ser considerado publicado em producao porque existem pendencias operacionais, de homologacao e de integracoes reais.

## Pendencias Criticas para Go Live

### 1. Provisionar banco PostgreSQL real

Prioridade: Critica.

Status: Pendente.

Impacto: Sem banco real, nao e possivel validar migrations, seed, login real, persistencia e integridade referencial em ambiente de homologacao/producao.

Acao recomendada:

- Criar PostgreSQL gerenciado.
- Configurar `DATABASE_URL`.
- Aplicar migrations.
- Executar seed controlado.
- Validar `/api/v1/health`.

### 2. Validar migrations em banco ativo

Prioridade: Critica.

Status: Pendente.

Impacto: O schema Prisma esta valido, mas ainda falta provar a aplicacao das migrations em um banco real.

Acao recomendada:

- Rodar migrations em homologacao.
- Conferir tabelas, indices, constraints e relacionamentos.
- Registrar resultado antes de producao.

### 3. Configurar secrets reais

Prioridade: Critica.

Status: Pendente.

Impacto: As variaveis atuais sao modelos ou placeholders. Producao exige segredos fortes.

Acao recomendada:

- Gerar `JWT_SECRET` e `JWT_REFRESH_SECRET` fortes.
- Cadastrar secrets na Vercel e Render/Railway.
- Remover qualquer uso de senha padrao em producao.

### 4. Configurar deploy real

Prioridade: Critica.

Status: Pendente.

Impacto: O pipeline esta preparado, mas os hooks reais ainda precisam ser conectados.

Acao recomendada:

- Criar projeto na Vercel.
- Criar servico backend no Render ou Railway.
- Configurar `VERCEL_DEPLOY_HOOK_URL`.
- Configurar `BACKEND_DEPLOY_HOOK_URL`.
- Testar deploy em homologacao antes de producao.

### 5. Executar checklist manual de Go Live

Prioridade: Critica.

Status: Pendente.

Impacto: A aplicacao ainda precisa ser validada em ambiente real com frontend, backend e banco conectados.

Acao recomendada:

- Validar login.
- Validar CRUDs.
- Validar Radar de Precos.
- Validar Precificacao.
- Validar Ofertas.
- Validar Dashboard.
- Validar Integracoes preparadas.
- Validar logs e health check.

## Pendencias de Qualidade

### 6. Cobertura formal de testes

Prioridade: Alta.

Status: Pendente.

Impacto: Existem testes unitarios, mas a cobertura percentual ainda nao e medida.

Acao recomendada:

- Instalar/configurar `@vitest/coverage-v8`.
- Rodar coverage.
- Definir meta minima por modulo.
- Evoluir gradualmente ate 80% nas regras criticas.

### 7. Testes E2E

Prioridade: Alta.

Status: Pendente.

Impacto: Os fluxos principais ainda nao possuem validacao automatizada ponta a ponta.

Acao recomendada:

- Definir Playwright como ferramenta E2E.
- Criar testes para:
  - login;
  - cadastro de produto;
  - cadastro de fornecedor;
  - configuracoes;
  - radar;
  - precificacao;
  - geracao de oferta;
  - dashboard.

### 8. Auditoria visual e responsividade

Prioridade: Alta.

Status: Pendente.

Impacto: As rotas respondem e o build passa, mas ainda falta validacao automatizada em desktop, tablet e mobile.

Acao recomendada:

- Criar suite visual com Playwright.
- Capturar screenshots das paginas principais.
- Validar overflow, scroll, cards, sidebar e responsividade.

### 9. Performance em ambiente real

Prioridade: Media.

Status: Pendente.

Impacto: O build local foi aprovado, mas ainda falta medir performance com API e banco reais.

Acao recomendada:

- Executar Lighthouse.
- Medir tempo de resposta das APIs.
- Medir consultas mais pesadas.
- Validar cache do dashboard e integracoes.

## Pendencias de Seguranca

### 10. Rate limiting e protecao contra brute force

Prioridade: Alta.

Status: Preparado conceitualmente, pendente operacionalmente.

Impacto: Login e APIs protegidas precisam de camada de defesa contra abuso.

Acao recomendada:

- Definir estrategia oficial de rate limiting.
- Aplicar em auth e endpoints sensiveis.
- Testar falhas de login repetidas.

### 11. Testes de autorizacao por perfil

Prioridade: Alta.

Status: Pendente.

Impacto: RBAC existe, mas precisa de testes automatizados por perfil.

Acao recomendada:

- Testar Administrador.
- Testar Gestor.
- Testar Operador.
- Validar acesso negado em rotas restritas.

### 12. Hardening de producao

Prioridade: Alta.

Status: Parcial.

Impacto: Headers foram adicionados no frontend, mas producao ainda exige validacao completa.

Acao recomendada:

- HTTPS obrigatorio.
- Swagger desabilitado.
- CORS restrito ao dominio oficial.
- Banco sem acesso publico amplo.
- Secrets somente no provedor.

## Pendencias de Banco de Dados

### 13. Backup e restore testados

Prioridade: Critica.

Status: Pendente.

Impacto: Sem teste de restore, backup ainda nao e garantia real de recuperacao.

Acao recomendada:

- Ativar backup automatico.
- Executar backup manual antes do Go Live.
- Restaurar backup em banco temporario.
- Validar integridade.

### 14. Seed em ambiente real

Prioridade: Alta.

Status: Pendente.

Impacto: Seed existe, mas ainda precisa ser executado e validado em banco real.

Acao recomendada:

- Revisar credenciais iniciais.
- Executar seed em homologacao.
- Validar usuario administrador.
- Trocar senha inicial.

### 15. Pool de conexoes

Prioridade: Media.

Status: Pendente.

Impacto: Ambiente real precisa controlar conexoes para evitar saturacao.

Acao recomendada:

- Configurar pool conforme provedor escolhido.
- Validar limite do plano.
- Monitorar conexoes ativas.

## Pendencias de Integracoes

### 16. Google Sheets real

Prioridade: Media.

Status: Provider preparado, integracao real pendente.

Impacto: Lucros por modelo e tabelas auxiliares ainda dependem de credenciais e planilha oficial.

Acao recomendada:

- Definir planilha oficial.
- Configurar credenciais.
- Mapear abas e colunas.
- Testar sincronizacao.

### 17. WhatsApp Business API

Prioridade: Media.

Status: Links preparados, API oficial pendente.

Impacto: O sistema abre links de WhatsApp, mas ainda nao envia mensagens por API oficial.

Acao recomendada:

- Definir conta WhatsApp Business.
- Configurar provider oficial futuramente.
- Manter links atuais como fallback.

### 18. Compras Paraguai real

Prioridade: Media.

Status: Provider mock/preparado.

Impacto: Radar de Importacao ainda nao consome dados reais do site.

Acao recomendada:

- Verificar existencia de API oficial.
- Caso nao exista, avaliar politica e viabilidade de scraping.
- Implementar provider real sem acoplar ao modulo.

### 19. Monitoramento de integracoes

Prioridade: Media.

Status: Parcial.

Impacto: Logs e retry existem, mas faltam alertas reais.

Acao recomendada:

- Configurar Sentry ou equivalente.
- Configurar alerta para falha de sync.
- Monitorar tempo de resposta dos providers.

## Pendencias de Observabilidade

### 20. Sentry

Prioridade: Alta.

Status: Pendente.

Impacto: Erros em producao nao terao rastreio centralizado.

Acao recomendada:

- Criar projeto Sentry.
- Configurar DSN por ambiente.
- Validar captura de erro backend/frontend.

### 21. Uptime monitor

Prioridade: Alta.

Status: Pendente.

Impacto: Indisponibilidade pode passar despercebida.

Acao recomendada:

- Configurar UptimeRobot ou equivalente.
- Monitorar frontend e `/api/v1/health`.
- Criar alertas.

### 22. Logs centralizados

Prioridade: Media.

Status: Pendente.

Impacto: Logs locais nao bastam para diagnostico em producao.

Acao recomendada:

- Definir Better Stack ou equivalente.
- Separar logs por ambiente.
- Criar retencao minima.

## Pendencias de Documentacao Operacional

### 23. Runbook de incidentes

Prioridade: Media.

Status: Pendente.

Impacto: Ainda falta um passo a passo especifico para incidentes reais.

Acao recomendada:

- Criar runbook para queda da API.
- Criar runbook para banco indisponivel.
- Criar runbook para rollback.
- Criar runbook para falha de integracao.

### 24. Manual de operacao do usuario

Prioridade: Baixa.

Status: Pendente.

Impacto: Usuarios finais ainda nao possuem guia de operacao.

Acao recomendada:

- Criar manual simples por perfil.
- Criar guia rapido para Precificacao, Radar e Ofertas.

## Pendencias para Roadmap v2

Estas pendencias nao bloqueiam o MVP, mas devem entrar em ciclo futuro:

- CRM completo.
- Controle financeiro completo.
- Estoque avancado por IMEI.
- Aplicativo mobile.
- IA para sugestao de precos.
- BI preditivo.
- Notificacoes em tempo real.
- ERP e emissao de nota fiscal.
- Marketplace de fornecedores.
- Multiempresa.
- Internacionalizacao.

## Priorizacao Recomendada

### Antes de Homologacao

1. Provisionar banco PostgreSQL de homologacao.
2. Configurar secrets de homologacao.
3. Aplicar migrations.
4. Rodar seed.
5. Validar login e health check.

### Antes de Producao

1. Provisionar banco de producao.
2. Configurar Vercel.
3. Configurar Render/Railway.
4. Ativar backups.
5. Ativar monitoramento.
6. Executar checklist manual de Go Live.

### Depois do Go Live

1. Configurar coverage.
2. Criar E2E.
3. Ativar integracoes reais.
4. Evoluir observabilidade.
5. Planejar Roadmap v2.

## Conclusao

O projeto esta em estado avancado de MVP e pronto para entrar em homologacao tecnica.

O principal bloco pendente nao e de desenvolvimento funcional, mas de operacao:

- ambiente real;
- banco real;
- secrets;
- migrations;
- monitoramento;
- backups;
- checklist manual de Go Live.

Com essas etapas concluidas, o sistema podera seguir para publicacao controlada da versao 1.0.
