-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ativo', 'inativo', 'bloqueado');

-- CreateEnum
CREATE TYPE "generic_status" AS ENUM ('ativo', 'inativo');

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('pendente_revisao', 'aprovado', 'rejeitado', 'ativo', 'inativo');

-- CreateEnum
CREATE TYPE "product_type" AS ENUM ('iphone_lacrado', 'iphone_seminovo', 'apple_cpo', 'macbook', 'ipad', 'apple_watch', 'airpods', 'acessorio');

-- CreateEnum
CREATE TYPE "inventory_status" AS ENUM ('disponivel', 'reservado', 'vendido', 'cancelado');

-- CreateEnum
CREATE TYPE "inventory_movement_type" AS ENUM ('entrada', 'saida', 'reserva', 'liberacao', 'venda', 'cancelamento', 'ajuste');

-- CreateEnum
CREATE TYPE "sale_status" AS ENUM ('pendente', 'concluida', 'cancelada');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('pendente', 'pago', 'cancelado', 'estornado');

-- CreateEnum
CREATE TYPE "offer_status" AS ENUM ('rascunho', 'gerada', 'enviada', 'convertida', 'expirada', 'cancelada');

-- CreateEnum
CREATE TYPE "sales_origin_type" AS ENUM ('meta_ads', 'google_ads', 'indicacao', 'organico', 'whatsapp', 'loja', 'outros');

-- CreateEnum
CREATE TYPE "import_status" AS ENUM ('iniciado', 'processando', 'concluido', 'concluido_com_alertas', 'falhou');

-- CreateEnum
CREATE TYPE "audit_operation_type" AS ENUM ('login', 'logout', 'criacao', 'atualizacao', 'exclusao', 'importacao', 'exportacao', 'erro', 'alteracao_configuracao', 'alteracao_permissao');

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,
    "nome" VARCHAR(160) NOT NULL,
    "email" VARCHAR(180) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'ativo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfil" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "descricao" TEXT,
    "status" "generic_status" NOT NULL DEFAULT 'ativo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "perfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissao" (
    "id" UUID NOT NULL,
    "modulo" VARCHAR(80) NOT NULL,
    "acao" VARCHAR(80) NOT NULL,
    "escopo" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfil_permissao" (
    "id" UUID NOT NULL,
    "perfil_id" UUID NOT NULL,
    "permissao_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perfil_permissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pais" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "codigo" VARCHAR(10),
    "moeda_padrao" VARCHAR(10),
    "fuso_horario_padrao" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estado" (
    "id" UUID NOT NULL,
    "pais_id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "sigla" VARCHAR(10),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cidade" (
    "id" UUID NOT NULL,
    "estado_id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "origem_venda" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "tipo" "sales_origin_type" NOT NULL,
    "status" "generic_status" NOT NULL DEFAULT 'ativo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "origem_venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id" UUID NOT NULL,
    "cidade_id" UUID,
    "origem_venda_id" UUID,
    "nome" VARCHAR(160) NOT NULL,
    "telefone" VARCHAR(40),
    "email" VARCHAR(180),
    "documento" VARCHAR(40),
    "status" "generic_status" NOT NULL DEFAULT 'ativo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fornecedor" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(160) NOT NULL,
    "contato" VARCHAR(160),
    "telefone" VARCHAR(40),
    "origem" VARCHAR(120),
    "status" "generic_status" NOT NULL DEFAULT 'ativo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "tipo_produto" "product_type" NOT NULL,
    "status" "generic_status" NOT NULL DEFAULT 'ativo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelo" (
    "id" UUID NOT NULL,
    "categoria_id" UUID NOT NULL,
    "nome" VARCHAR(160) NOT NULL,
    "nome_normalizado" VARCHAR(160) NOT NULL,
    "tipo_produto" "product_type" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "modelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cor" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "nome_normalizado" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacidade" (
    "id" UUID NOT NULL,
    "valor" VARCHAR(80) NOT NULL,
    "unidade" VARCHAR(40),
    "nome_exibicao" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "capacidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produto" (
    "id" UUID NOT NULL,
    "categoria_id" UUID NOT NULL,
    "modelo_id" UUID NOT NULL,
    "cor_id" UUID,
    "capacidade_id" UUID,
    "tipo_produto" "product_type" NOT NULL,
    "status" "product_status" NOT NULL DEFAULT 'pendente_revisao',
    "grade_qualidade" VARCHAR(40),
    "saude_bateria" INTEGER,
    "possui_alerta_interno" BOOLEAN NOT NULL DEFAULT false,
    "possui_pecas_substituidas" BOOLEAN NOT NULL DEFAULT false,
    "possui_defeito_estrutural" BOOLEAN NOT NULL DEFAULT false,
    "observacoes_criticas" TEXT,
    "custo_produto" DECIMAL(12,2),
    "preco_venda" DECIMAL(12,2),
    "preco_oferta" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estoque" (
    "id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "fornecedor_id" UUID,
    "imei" VARCHAR(80),
    "origem" VARCHAR(120),
    "status" "inventory_status" NOT NULL DEFAULT 'disponivel',
    "data_entrada" TIMESTAMP(3),
    "data_venda" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacao_estoque" (
    "id" UUID NOT NULL,
    "estoque_id" UUID NOT NULL,
    "tipo" "inventory_movement_type" NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "motivo" TEXT,
    "metadados" JSONB,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacao_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venda" (
    "id" UUID NOT NULL,
    "cliente_id" UUID,
    "oferta_id" UUID,
    "origem_venda_id" UUID,
    "receita_bruta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "receita_liquida" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lucro_liquido" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valor_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "sale_status" NOT NULL DEFAULT 'pendente',
    "status_pagamento" "payment_status" NOT NULL DEFAULT 'pendente',
    "data_venda" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_venda" (
    "id" UUID NOT NULL,
    "venda_id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "estoque_id" UUID,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "custo_produto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "preco_venda" DECIMAL(12,2) NOT NULL,
    "preco_oferta" DECIMAL(12,2) NOT NULL,
    "lucro_liquido" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oferta" (
    "id" UUID NOT NULL,
    "cliente_id" UUID,
    "template_comercial_id" UUID NOT NULL,
    "precificacao_id" UUID,
    "mensagem" TEXT NOT NULL,
    "status" "offer_status" NOT NULL DEFAULT 'gerada',
    "preco_venda" DECIMAL(12,2) NOT NULL,
    "preco_oferta" DECIMAL(12,2) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "oferta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_oferta" (
    "id" UUID NOT NULL,
    "oferta_id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "preco_venda" DECIMAL(12,2) NOT NULL,
    "preco_oferta" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_oferta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_precos" (
    "id" UUID NOT NULL,
    "fornecedor_id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "lote_importacao_id" UUID,
    "custo_produto" DECIMAL(12,2) NOT NULL,
    "prazo" VARCHAR(120),
    "cidade" VARCHAR(120),
    "contato" VARCHAR(160),
    "observacoes" TEXT,
    "data_cotacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_precos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precificacao" (
    "id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "configuracao_financeira_id" UUID,
    "custo_produto" DECIMAL(12,2) NOT NULL,
    "custo_fixo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "frete" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxa_pagamento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "outros_custos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lucro_liquido_desejado" DECIMAL(12,2) NOT NULL,
    "desconto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "preco_venda" DECIMAL(12,2) NOT NULL,
    "preco_oferta" DECIMAL(12,2) NOT NULL,
    "metadados_calculo" JSONB,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "precificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracao_financeira" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "escopo" VARCHAR(80) NOT NULL DEFAULT 'global',
    "categoria_id" UUID,
    "modelo_id" UUID,
    "custo_fixo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "frete" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxa_pagamento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "outros_custos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lucro_liquido_desejado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "desconto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "generic_status" NOT NULL DEFAULT 'ativo',
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "configuracao_financeira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_comercial" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "tipo_produto" "product_type" NOT NULL,
    "corpo" TEXT NOT NULL,
    "variaveis" JSONB,
    "status" "generic_status" NOT NULL DEFAULT 'ativo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "template_comercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracao_sistema" (
    "id" UUID NOT NULL,
    "chave" VARCHAR(120) NOT NULL,
    "valor" TEXT NOT NULL,
    "tipo" VARCHAR(40) NOT NULL DEFAULT 'texto',
    "escopo" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracao_sistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "descricao" TEXT,
    "modulo" VARCHAR(80) NOT NULL,
    "status" "generic_status" NOT NULL DEFAULT 'ativo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_cache" (
    "id" UUID NOT NULL,
    "dashboard_id" UUID,
    "chave" VARCHAR(180) NOT NULL,
    "valor" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lote_importacao" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "origem" VARCHAR(80) NOT NULL,
    "status" "import_status" NOT NULL DEFAULT 'iniciado',
    "total_registros" INTEGER NOT NULL DEFAULT 0,
    "registros_validos" INTEGER NOT NULL DEFAULT 0,
    "registros_invalidos" INTEGER NOT NULL DEFAULT 0,
    "mensagens_inconsistencia" TEXT,
    "data_importacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lote_importacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracao_financeira_importacao" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "cotacao_dolar" DECIMAL(12,4) NOT NULL DEFAULT 5.35,
    "saida_cde_por_caixa" DECIMAL(12,2) NOT NULL DEFAULT 110,
    "despacho_brasil_por_caixa" DECIMAL(12,2) NOT NULL DEFAULT 50,
    "nota_fiscal_percentual" DECIMAL(5,2) NOT NULL DEFAULT 3,
    "etiqueta_correios" DECIMAL(12,2) NOT NULL DEFAULT 120,
    "status" "generic_status" NOT NULL DEFAULT 'ativo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "configuracao_financeira_importacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regra_redirecionamento_importacao" (
    "id" UUID NOT NULL,
    "configuracao_importacao_id" UUID NOT NULL,
    "tipo_produto" VARCHAR(160) NOT NULL,
    "termos_identificacao" JSONB,
    "custo_redirecionamento" DECIMAL(12,2) NOT NULL,
    "prioridade" INTEGER NOT NULL DEFAULT 0,
    "status" "generic_status" NOT NULL DEFAULT 'ativo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "regra_redirecionamento_importacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_busca_importacao" (
    "id" UUID NOT NULL,
    "consulta" VARCHAR(180) NOT NULL,
    "origem" VARCHAR(120) NOT NULL DEFAULT 'compras_paraguai_mock',
    "status" "import_status" NOT NULL DEFAULT 'concluido',
    "quantidade_resultados" INTEGER NOT NULL DEFAULT 0,
    "metadados" JSONB,
    "data_busca" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_busca_importacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculo_importacao" (
    "id" UUID NOT NULL,
    "configuracao_importacao_id" UUID NOT NULL,
    "regra_redirecionamento_id" UUID,
    "nome_produto" VARCHAR(220) NOT NULL,
    "url_produto" TEXT,
    "tipo_produto" VARCHAR(160),
    "preco_dolar" DECIMAL(12,2) NOT NULL,
    "preco_real" DECIMAL(12,2) NOT NULL,
    "saida_cde" DECIMAL(12,2) NOT NULL,
    "redirecionamento" DECIMAL(12,2) NOT NULL,
    "despacho_brasil" DECIMAL(12,2) NOT NULL,
    "nota_fiscal" DECIMAL(12,2) NOT NULL,
    "etiqueta_correios" DECIMAL(12,2) NOT NULL,
    "total_estimado" DECIMAL(12,2) NOT NULL,
    "detalhamento" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculo_importacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_auditoria" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "tipo_operacao" "audit_operation_type" NOT NULL,
    "entidade" VARCHAR(120) NOT NULL,
    "entidade_id" VARCHAR(120),
    "valor_anterior" JSONB,
    "valor_novo" JSONB,
    "contexto" JSONB,
    "ip_address" VARCHAR(80),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_usuario_email" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "idx_usuario_perfil_id" ON "usuario"("perfil_id");

-- CreateIndex
CREATE INDEX "idx_usuario_status" ON "usuario"("status");

-- CreateIndex
CREATE INDEX "idx_usuario_deleted_at" ON "usuario"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_perfil_nome" ON "perfil"("nome");

-- CreateIndex
CREATE INDEX "idx_perfil_status" ON "perfil"("status");

-- CreateIndex
CREATE INDEX "idx_permissao_modulo" ON "permissao"("modulo");

-- CreateIndex
CREATE UNIQUE INDEX "uq_permissao_modulo_acao" ON "permissao"("modulo", "acao");

-- CreateIndex
CREATE INDEX "idx_perfil_permissao_perfil_id" ON "perfil_permissao"("perfil_id");

-- CreateIndex
CREATE INDEX "idx_perfil_permissao_permissao_id" ON "perfil_permissao"("permissao_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_perfil_permissao_perfil_id_permissao_id" ON "perfil_permissao"("perfil_id", "permissao_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_pais_nome" ON "pais"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "uq_pais_codigo" ON "pais"("codigo");

-- CreateIndex
CREATE INDEX "idx_estado_pais_id" ON "estado"("pais_id");

-- CreateIndex
CREATE INDEX "idx_estado_nome" ON "estado"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "uq_estado_pais_id_nome" ON "estado"("pais_id", "nome");

-- CreateIndex
CREATE INDEX "idx_cidade_estado_id" ON "cidade"("estado_id");

-- CreateIndex
CREATE INDEX "idx_cidade_nome" ON "cidade"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "uq_cidade_estado_id_nome" ON "cidade"("estado_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "uq_origem_venda_nome" ON "origem_venda"("nome");

-- CreateIndex
CREATE INDEX "idx_origem_venda_tipo" ON "origem_venda"("tipo");

-- CreateIndex
CREATE INDEX "idx_origem_venda_status" ON "origem_venda"("status");

-- CreateIndex
CREATE INDEX "idx_cliente_nome" ON "cliente"("nome");

-- CreateIndex
CREATE INDEX "idx_cliente_cidade_id" ON "cliente"("cidade_id");

-- CreateIndex
CREATE INDEX "idx_cliente_origem_venda_id" ON "cliente"("origem_venda_id");

-- CreateIndex
CREATE INDEX "idx_cliente_status" ON "cliente"("status");

-- CreateIndex
CREATE INDEX "idx_cliente_deleted_at" ON "cliente"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_fornecedor_nome" ON "fornecedor"("nome");

-- CreateIndex
CREATE INDEX "idx_fornecedor_status" ON "fornecedor"("status");

-- CreateIndex
CREATE INDEX "idx_fornecedor_deleted_at" ON "fornecedor"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_categoria_nome" ON "categoria"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "uq_categoria_slug" ON "categoria"("slug");

-- CreateIndex
CREATE INDEX "idx_categoria_tipo_produto" ON "categoria"("tipo_produto");

-- CreateIndex
CREATE INDEX "idx_categoria_status" ON "categoria"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_modelo_nome_normalizado" ON "modelo"("nome_normalizado");

-- CreateIndex
CREATE INDEX "idx_modelo_categoria_id" ON "modelo"("categoria_id");

-- CreateIndex
CREATE INDEX "idx_modelo_nome" ON "modelo"("nome");

-- CreateIndex
CREATE INDEX "idx_modelo_tipo_produto" ON "modelo"("tipo_produto");

-- CreateIndex
CREATE UNIQUE INDEX "uq_cor_nome_normalizado" ON "cor"("nome_normalizado");

-- CreateIndex
CREATE INDEX "idx_cor_nome" ON "cor"("nome");

-- CreateIndex
CREATE INDEX "idx_capacidade_valor" ON "capacidade"("valor");

-- CreateIndex
CREATE UNIQUE INDEX "uq_capacidade_valor_unidade" ON "capacidade"("valor", "unidade");

-- CreateIndex
CREATE INDEX "idx_produto_categoria_id" ON "produto"("categoria_id");

-- CreateIndex
CREATE INDEX "idx_produto_modelo_id" ON "produto"("modelo_id");

-- CreateIndex
CREATE INDEX "idx_produto_cor_id" ON "produto"("cor_id");

-- CreateIndex
CREATE INDEX "idx_produto_capacidade_id" ON "produto"("capacidade_id");

-- CreateIndex
CREATE INDEX "idx_produto_status" ON "produto"("status");

-- CreateIndex
CREATE INDEX "idx_produto_tipo_produto" ON "produto"("tipo_produto");

-- CreateIndex
CREATE INDEX "idx_produto_deleted_at" ON "produto"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_produto_modelo_id_capacidade_id_cor_id" ON "produto"("modelo_id", "capacidade_id", "cor_id");

-- CreateIndex
CREATE INDEX "idx_produto_status_tipo_produto" ON "produto"("status", "tipo_produto");

-- CreateIndex
CREATE UNIQUE INDEX "uq_estoque_imei" ON "estoque"("imei");

-- CreateIndex
CREATE INDEX "idx_estoque_produto_id" ON "estoque"("produto_id");

-- CreateIndex
CREATE INDEX "idx_estoque_fornecedor_id" ON "estoque"("fornecedor_id");

-- CreateIndex
CREATE INDEX "idx_estoque_status" ON "estoque"("status");

-- CreateIndex
CREATE INDEX "idx_estoque_deleted_at" ON "estoque"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_estoque_status_produto_id" ON "estoque"("status", "produto_id");

-- CreateIndex
CREATE INDEX "idx_movimentacao_estoque_estoque_id" ON "movimentacao_estoque"("estoque_id");

-- CreateIndex
CREATE INDEX "idx_movimentacao_estoque_created_by" ON "movimentacao_estoque"("created_by");

-- CreateIndex
CREATE INDEX "idx_movimentacao_estoque_tipo" ON "movimentacao_estoque"("tipo");

-- CreateIndex
CREATE INDEX "idx_movimentacao_estoque_created_at" ON "movimentacao_estoque"("created_at");

-- CreateIndex
CREATE INDEX "idx_movimentacao_estoque_estoque_id_created_at" ON "movimentacao_estoque"("estoque_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_venda_oferta_id" ON "venda"("oferta_id");

-- CreateIndex
CREATE INDEX "idx_venda_cliente_id" ON "venda"("cliente_id");

-- CreateIndex
CREATE INDEX "idx_venda_oferta_id" ON "venda"("oferta_id");

-- CreateIndex
CREATE INDEX "idx_venda_origem_venda_id" ON "venda"("origem_venda_id");

-- CreateIndex
CREATE INDEX "idx_venda_status" ON "venda"("status");

-- CreateIndex
CREATE INDEX "idx_venda_status_pagamento" ON "venda"("status_pagamento");

-- CreateIndex
CREATE INDEX "idx_venda_data_venda" ON "venda"("data_venda");

-- CreateIndex
CREATE INDEX "idx_venda_status_data_venda" ON "venda"("status", "data_venda");

-- CreateIndex
CREATE INDEX "idx_venda_deleted_at" ON "venda"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_item_venda_venda_id" ON "item_venda"("venda_id");

-- CreateIndex
CREATE INDEX "idx_item_venda_produto_id" ON "item_venda"("produto_id");

-- CreateIndex
CREATE INDEX "idx_item_venda_estoque_id" ON "item_venda"("estoque_id");

-- CreateIndex
CREATE INDEX "idx_oferta_cliente_id" ON "oferta"("cliente_id");

-- CreateIndex
CREATE INDEX "idx_oferta_template_comercial_id" ON "oferta"("template_comercial_id");

-- CreateIndex
CREATE INDEX "idx_oferta_precificacao_id" ON "oferta"("precificacao_id");

-- CreateIndex
CREATE INDEX "idx_oferta_status" ON "oferta"("status");

-- CreateIndex
CREATE INDEX "idx_oferta_created_at" ON "oferta"("created_at");

-- CreateIndex
CREATE INDEX "idx_oferta_status_created_at" ON "oferta"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_oferta_deleted_at" ON "oferta"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_item_oferta_oferta_id" ON "item_oferta"("oferta_id");

-- CreateIndex
CREATE INDEX "idx_item_oferta_produto_id" ON "item_oferta"("produto_id");

-- CreateIndex
CREATE INDEX "idx_historico_precos_fornecedor_id" ON "historico_precos"("fornecedor_id");

-- CreateIndex
CREATE INDEX "idx_historico_precos_produto_id" ON "historico_precos"("produto_id");

-- CreateIndex
CREATE INDEX "idx_historico_precos_lote_importacao_id" ON "historico_precos"("lote_importacao_id");

-- CreateIndex
CREATE INDEX "idx_historico_precos_data_cotacao" ON "historico_precos"("data_cotacao");

-- CreateIndex
CREATE INDEX "idx_historico_precos_produto_id_data_cotacao" ON "historico_precos"("produto_id", "data_cotacao");

-- CreateIndex
CREATE INDEX "idx_historico_precos_fornecedor_id_data_cotacao" ON "historico_precos"("fornecedor_id", "data_cotacao");

-- CreateIndex
CREATE INDEX "idx_precificacao_produto_id" ON "precificacao"("produto_id");

-- CreateIndex
CREATE INDEX "idx_precificacao_configuracao_financeira_id" ON "precificacao"("configuracao_financeira_id");

-- CreateIndex
CREATE INDEX "idx_precificacao_created_by" ON "precificacao"("created_by");

-- CreateIndex
CREATE INDEX "idx_precificacao_created_at" ON "precificacao"("created_at");

-- CreateIndex
CREATE INDEX "idx_precificacao_produto_id_created_at" ON "precificacao"("produto_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_configuracao_financeira_nome" ON "configuracao_financeira"("nome");

-- CreateIndex
CREATE INDEX "idx_configuracao_financeira_escopo" ON "configuracao_financeira"("escopo");

-- CreateIndex
CREATE INDEX "idx_configuracao_financeira_categoria_id" ON "configuracao_financeira"("categoria_id");

-- CreateIndex
CREATE INDEX "idx_configuracao_financeira_modelo_id" ON "configuracao_financeira"("modelo_id");

-- CreateIndex
CREATE INDEX "idx_configuracao_financeira_status" ON "configuracao_financeira"("status");

-- CreateIndex
CREATE INDEX "idx_configuracao_financeira_deleted_at" ON "configuracao_financeira"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_template_comercial_nome" ON "template_comercial"("nome");

-- CreateIndex
CREATE INDEX "idx_template_comercial_tipo_produto" ON "template_comercial"("tipo_produto");

-- CreateIndex
CREATE INDEX "idx_template_comercial_status" ON "template_comercial"("status");

-- CreateIndex
CREATE INDEX "idx_template_comercial_deleted_at" ON "template_comercial"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_configuracao_sistema_chave" ON "configuracao_sistema"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "uq_configuracao_sistema_chave_escopo" ON "configuracao_sistema"("chave", "escopo");

-- CreateIndex
CREATE INDEX "idx_dashboard_modulo" ON "dashboard"("modulo");

-- CreateIndex
CREATE INDEX "idx_dashboard_status" ON "dashboard"("status");

-- CreateIndex
CREATE INDEX "idx_dashboard_cache_dashboard_id" ON "dashboard_cache"("dashboard_id");

-- CreateIndex
CREATE INDEX "idx_dashboard_cache_chave" ON "dashboard_cache"("chave");

-- CreateIndex
CREATE INDEX "idx_dashboard_cache_expires_at" ON "dashboard_cache"("expires_at");

-- CreateIndex
CREATE INDEX "idx_lote_importacao_usuario_id" ON "lote_importacao"("usuario_id");

-- CreateIndex
CREATE INDEX "idx_lote_importacao_origem" ON "lote_importacao"("origem");

-- CreateIndex
CREATE INDEX "idx_lote_importacao_status" ON "lote_importacao"("status");

-- CreateIndex
CREATE INDEX "idx_lote_importacao_data_importacao" ON "lote_importacao"("data_importacao");

-- CreateIndex
CREATE UNIQUE INDEX "uq_configuracao_importacao_nome" ON "configuracao_financeira_importacao"("nome");

-- CreateIndex
CREATE INDEX "idx_configuracao_importacao_status" ON "configuracao_financeira_importacao"("status");

-- CreateIndex
CREATE INDEX "idx_configuracao_importacao_deleted_at" ON "configuracao_financeira_importacao"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_regra_redirecionamento_configuracao_id" ON "regra_redirecionamento_importacao"("configuracao_importacao_id");

-- CreateIndex
CREATE INDEX "idx_regra_redirecionamento_status" ON "regra_redirecionamento_importacao"("status");

-- CreateIndex
CREATE INDEX "idx_regra_redirecionamento_prioridade" ON "regra_redirecionamento_importacao"("prioridade");

-- CreateIndex
CREATE UNIQUE INDEX "uq_regra_redirecionamento_configuracao_tipo" ON "regra_redirecionamento_importacao"("configuracao_importacao_id", "tipo_produto");

-- CreateIndex
CREATE INDEX "idx_historico_busca_importacao_consulta" ON "historico_busca_importacao"("consulta");

-- CreateIndex
CREATE INDEX "idx_historico_busca_importacao_origem" ON "historico_busca_importacao"("origem");

-- CreateIndex
CREATE INDEX "idx_historico_busca_importacao_data_busca" ON "historico_busca_importacao"("data_busca");

-- CreateIndex
CREATE INDEX "idx_calculo_importacao_configuracao_id" ON "calculo_importacao"("configuracao_importacao_id");

-- CreateIndex
CREATE INDEX "idx_calculo_importacao_regra_id" ON "calculo_importacao"("regra_redirecionamento_id");

-- CreateIndex
CREATE INDEX "idx_calculo_importacao_nome_produto" ON "calculo_importacao"("nome_produto");

-- CreateIndex
CREATE INDEX "idx_calculo_importacao_created_at" ON "calculo_importacao"("created_at");

-- CreateIndex
CREATE INDEX "idx_log_auditoria_usuario_id" ON "log_auditoria"("usuario_id");

-- CreateIndex
CREATE INDEX "idx_log_auditoria_entidade" ON "log_auditoria"("entidade");

-- CreateIndex
CREATE INDEX "idx_log_auditoria_tipo_operacao" ON "log_auditoria"("tipo_operacao");

-- CreateIndex
CREATE INDEX "idx_log_auditoria_created_at" ON "log_auditoria"("created_at");

-- CreateIndex
CREATE INDEX "idx_log_auditoria_entidade_entidade_id" ON "log_auditoria"("entidade", "entidade_id");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfil"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "perfil_permissao" ADD CONSTRAINT "perfil_permissao_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfil"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "perfil_permissao" ADD CONSTRAINT "perfil_permissao_permissao_id_fkey" FOREIGN KEY ("permissao_id") REFERENCES "permissao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "estado" ADD CONSTRAINT "estado_pais_id_fkey" FOREIGN KEY ("pais_id") REFERENCES "pais"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cidade" ADD CONSTRAINT "cidade_estado_id_fkey" FOREIGN KEY ("estado_id") REFERENCES "estado"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_cidade_id_fkey" FOREIGN KEY ("cidade_id") REFERENCES "cidade"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_origem_venda_id_fkey" FOREIGN KEY ("origem_venda_id") REFERENCES "origem_venda"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "modelo" ADD CONSTRAINT "modelo_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "produto" ADD CONSTRAINT "produto_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "produto" ADD CONSTRAINT "produto_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "modelo"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "produto" ADD CONSTRAINT "produto_cor_id_fkey" FOREIGN KEY ("cor_id") REFERENCES "cor"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "produto" ADD CONSTRAINT "produto_capacidade_id_fkey" FOREIGN KEY ("capacidade_id") REFERENCES "capacidade"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "estoque" ADD CONSTRAINT "estoque_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produto"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "estoque" ADD CONSTRAINT "estoque_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedor"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimentacao_estoque" ADD CONSTRAINT "movimentacao_estoque_estoque_id_fkey" FOREIGN KEY ("estoque_id") REFERENCES "estoque"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimentacao_estoque" ADD CONSTRAINT "movimentacao_estoque_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "venda" ADD CONSTRAINT "venda_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "venda" ADD CONSTRAINT "venda_oferta_id_fkey" FOREIGN KEY ("oferta_id") REFERENCES "oferta"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "venda" ADD CONSTRAINT "venda_origem_venda_id_fkey" FOREIGN KEY ("origem_venda_id") REFERENCES "origem_venda"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "item_venda" ADD CONSTRAINT "item_venda_venda_id_fkey" FOREIGN KEY ("venda_id") REFERENCES "venda"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "item_venda" ADD CONSTRAINT "item_venda_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produto"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "item_venda" ADD CONSTRAINT "item_venda_estoque_id_fkey" FOREIGN KEY ("estoque_id") REFERENCES "estoque"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_template_comercial_id_fkey" FOREIGN KEY ("template_comercial_id") REFERENCES "template_comercial"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oferta" ADD CONSTRAINT "oferta_precificacao_id_fkey" FOREIGN KEY ("precificacao_id") REFERENCES "precificacao"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "item_oferta" ADD CONSTRAINT "item_oferta_oferta_id_fkey" FOREIGN KEY ("oferta_id") REFERENCES "oferta"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "item_oferta" ADD CONSTRAINT "item_oferta_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produto"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "historico_precos" ADD CONSTRAINT "historico_precos_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedor"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "historico_precos" ADD CONSTRAINT "historico_precos_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produto"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "historico_precos" ADD CONSTRAINT "historico_precos_lote_importacao_id_fkey" FOREIGN KEY ("lote_importacao_id") REFERENCES "lote_importacao"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "precificacao" ADD CONSTRAINT "precificacao_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produto"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "precificacao" ADD CONSTRAINT "precificacao_configuracao_financeira_id_fkey" FOREIGN KEY ("configuracao_financeira_id") REFERENCES "configuracao_financeira"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "precificacao" ADD CONSTRAINT "precificacao_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "configuracao_financeira" ADD CONSTRAINT "configuracao_financeira_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "configuracao_financeira" ADD CONSTRAINT "configuracao_financeira_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "modelo"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dashboard_cache" ADD CONSTRAINT "dashboard_cache_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "dashboard"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lote_importacao" ADD CONSTRAINT "lote_importacao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "regra_redirecionamento_importacao" ADD CONSTRAINT "regra_redirecionamento_importacao_configuracao_importacao__fkey" FOREIGN KEY ("configuracao_importacao_id") REFERENCES "configuracao_financeira_importacao"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "calculo_importacao" ADD CONSTRAINT "calculo_importacao_configuracao_importacao_id_fkey" FOREIGN KEY ("configuracao_importacao_id") REFERENCES "configuracao_financeira_importacao"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "calculo_importacao" ADD CONSTRAINT "calculo_importacao_regra_redirecionamento_id_fkey" FOREIGN KEY ("regra_redirecionamento_id") REFERENCES "regra_redirecionamento_importacao"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "log_auditoria" ADD CONSTRAINT "log_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

