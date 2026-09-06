'use client';

import { FormEvent, useCallback, useRef, useState } from 'react';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  LoadingState,
  SearchInput,
  StatusBadge,
} from '@/components/shared';
import {
  confirmUsaManufacturer,
  executeUsaPricedOffer,
  preflightUsaCost,
  registerUsaShippingWeight,
  resolveUsaEnrichment,
  resolveUsaShippingWeight,
  UsaEnrichmentDecision,
  UsaCostPreflightResponse,
  UsaPricedOfferResponse,
  UsaRedirectorSelection,
  UsaShippingWeightResolution,
  searchUsaSourceProducts,
} from '@/features/import-radar/services/import-radar-service';
import { UsaSourceProduct } from '@/features/import-radar/types/import-radar';

export function UsaRadarOrigin() {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<UsaSourceProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<UsaSourceProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weightResolution, setWeightResolution] = useState<UsaShippingWeightResolution | null>(
    null,
  );
  const [weightInput, setWeightInput] = useState('');
  const [weightLoading, setWeightLoading] = useState(false);
  const [weightOperation, setWeightOperation] = useState<
    'resolving' | 'saving' | 'reprocessing' | null
  >(null);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [decision, setDecision] = useState<UsaEnrichmentDecision | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [manufacturerInput, setManufacturerInput] = useState('');
  const [manufacturerLoading, setManufacturerLoading] = useState(false);
  const [manufacturerError, setManufacturerError] = useState<string | null>(null);
  const [redirector, setRedirector] = useState<'' | 'RED_DELAWARE' | 'REI_DO_IMPORTADO'>('');
  const [preflight, setPreflight] = useState<UsaCostPreflightResponse | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<UsaPricedOfferResponse | null>(null);
  const weightRequestRef = useRef(0);
  const flowRequestRef = useRef(0);
  const preflightRequestRef = useRef(0);

  const resetOperationalState = useCallback(() => {
    flowRequestRef.current += 1;
    preflightRequestRef.current += 1;
    setPreflight(null);
    setPreflightLoading(false);
    setPreflightError(null);
    setDecision(null);
    setDecisionLoading(false);
    setDecisionError(null);
    setManufacturerInput('');
    setManufacturerLoading(false);
    setManufacturerError(null);
    setRedirector('');
    setExecutionLoading(false);
    setExecutionError(null);
    setExecutionResult(null);
  }, []);

  const resetWeightState = useCallback(() => {
    weightRequestRef.current += 1;
    setWeightResolution(null);
    setWeightInput('');
    setWeightLoading(false);
    setWeightOperation(null);
    setWeightError(null);
  }, []);

  const resolveSelectedWeight = useCallback(
    async (product: UsaSourceProduct, operation: 'resolving' | 'reprocessing' = 'resolving') => {
      const requestId = ++weightRequestRef.current;
      setWeightLoading(true);
      setWeightOperation(operation);
      setWeightError(null);
      try {
        const resolution = await resolveUsaShippingWeight(product, { kind: 'SINGLE_ITEM' });
        if (requestId !== weightRequestRef.current) return;
        setWeightResolution(resolution);
        if (resolution.status === 'WEIGHT_FOUND') {
          setWeightInput(formatWeightLbs(resolution.shippingWeightLbs));
        }
        return resolution;
      } catch (resolveError) {
        if (requestId !== weightRequestRef.current) return;
        setWeightResolution(null);
        setWeightError(
          resolveError instanceof Error
            ? resolveError.message
            : 'Não foi possível resolver o peso operacional de envio.',
        );
      } finally {
        if (requestId === weightRequestRef.current) {
          setWeightLoading(false);
          setWeightOperation(null);
        }
      }
    },
    [],
  );

  const resolvePreflight = useCallback(
    async (product: UsaSourceProduct, choice: 'RED_DELAWARE' | 'REI_DO_IMPORTADO') => {
      const requestId = ++preflightRequestRef.current;
      setPreflight(null);
      setPreflightLoading(true);
      setPreflightError(null);
      setExecutionResult(null);
      setExecutionError(null);
      resetWeightState();
      try {
        const response = await preflightUsaCost(
          product,
          choice === 'RED_DELAWARE'
            ? { redirector: choice, shippingMode: 'EXPRESS' }
            : { redirector: choice },
        );
        if (requestId !== preflightRequestRef.current) return;
        setPreflight(response);
        if (response.status === 'READY_FOR_COST' && response.shippingWeightLbs !== null) {
          setWeightResolution({
            status: 'WEIGHT_FOUND',
            shippingWeightLbs: response.shippingWeightLbs,
          });
        } else if (response.status === 'NEEDS_INPUT' && response.reason === 'MISSING_WEIGHT') {
          setWeightResolution({ status: 'MISSING_WEIGHT' });
        } else if (response.status === 'NEEDS_INPUT' && response.input.type === 'MANUFACTURER') {
          setDecision({
            status: 'NEEDS_INPUT',
            reason: 'MANUFACTURER_MISSING',
            input: {
              type: 'MANUFACTURER',
              field: 'manufacturer',
              suggestedValue: response.input.suggestedValue ?? '',
            },
          });
          setManufacturerInput(response.input.suggestedValue ?? '');
        }
      } catch (error) {
        if (requestId !== preflightRequestRef.current) return;
        setPreflightError(
          error instanceof Error ? error.message : 'Não foi possível verificar o produto.',
        );
      } finally {
        if (requestId === preflightRequestRef.current) setPreflightLoading(false);
      }
    },
    [resetWeightState],
  );

  const selectRedirector = useCallback(
    (choice: '' | 'RED_DELAWARE' | 'REI_DO_IMPORTADO') => {
      setRedirector(choice);
      preflightRequestRef.current += 1;
      setPreflight(null);
      setPreflightError(null);
      setExecutionResult(null);
      setExecutionError(null);
      resetWeightState();
      if (selectedProduct && choice) void resolvePreflight(selectedProduct, choice);
    },
    [resetWeightState, resolvePreflight, selectedProduct],
  );

  const resolveProductDecision = useCallback(async (product: UsaSourceProduct) => {
    const requestId = ++flowRequestRef.current;
    setDecisionLoading(true);
    setDecisionError(null);
    setManufacturerError(null);
    setExecutionError(null);
    setExecutionResult(null);
    try {
      const response = await resolveUsaEnrichment(product);
      if (requestId !== flowRequestRef.current) return;
      setDecision(response.decision);
      if (response.decision.status === 'NEEDS_INPUT') {
        setManufacturerInput(response.decision.input.suggestedValue);
        return;
      }
    } catch (resolveError) {
      if (requestId !== flowRequestRef.current) return;
      setDecision(null);
      setDecisionError(
        resolveError instanceof Error
          ? resolveError.message
          : 'Não foi possível resolver as decisões do produto.',
      );
    } finally {
      if (requestId === flowRequestRef.current) setDecisionLoading(false);
    }
  }, []);

  const selectProduct = useCallback(
    (product: UsaSourceProduct) => {
      resetOperationalState();
      resetWeightState();
      setSelectedProduct(product);
      void resolveProductDecision(product);
    },
    [resetOperationalState, resetWeightState, resolveProductDecision],
  );

  const confirmManufacturer = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      if (
        !selectedProduct ||
        decision?.status !== 'NEEDS_INPUT' ||
        decision.input.type !== 'MANUFACTURER' ||
        manufacturerLoading
      ) {
        return;
      }

      const canonicalName = manufacturerInput.trim();
      if (!canonicalName) {
        setManufacturerError('Informe o fabricante para continuar.');
        return;
      }

      const requestId = flowRequestRef.current;
      setManufacturerLoading(true);
      setManufacturerError(null);
      try {
        const response = await confirmUsaManufacturer(selectedProduct, canonicalName);
        if (requestId !== flowRequestRef.current) return;
        const reprocessedProduct = {
          ...selectedProduct,
          sourceManufacturer: canonicalName,
          sourceManufacturerProvenance: 'EXPLICIT_SOURCE' as const,
        };
        setSelectedProduct(reprocessedProduct);
        setDecision(response.decision);
        setManufacturerInput('');
        if (redirector) {
          void resolvePreflight(reprocessedProduct, redirector);
        } else if (response.decision.status === 'NEEDS_INPUT') {
          setManufacturerInput(response.decision.input.suggestedValue);
        }
      } catch (confirmError) {
        if (requestId !== flowRequestRef.current) return;
        setManufacturerError(
          confirmError instanceof Error
            ? confirmError.message
            : 'Não foi possível confirmar o fabricante.',
        );
      } finally {
        if (requestId === flowRequestRef.current) setManufacturerLoading(false);
      }
    },
    [
      decision,
      manufacturerInput,
      manufacturerLoading,
      redirector,
      resolvePreflight,
      selectedProduct,
    ],
  );

  const executePricedOffer = useCallback(async () => {
    if (
      !selectedProduct ||
      preflight?.status !== 'READY_FOR_COST' ||
      !redirector ||
      executionLoading
    ) {
      return;
    }

    const redirectorSelection: UsaRedirectorSelection =
      redirector === 'RED_DELAWARE' ? { redirector, shippingMode: 'EXPRESS' } : { redirector };
    const requestId = flowRequestRef.current;
    setExecutionLoading(true);
    setExecutionError(null);
    setExecutionResult(null);
    try {
      const response = await executeUsaPricedOffer(selectedProduct, redirectorSelection, {
        kind: 'SINGLE_ITEM',
      });
      if (requestId !== flowRequestRef.current) return;
      setExecutionResult(response);
      if (response.status === 'NEEDS_INPUT') {
        setExecutionResult(null);
        void resolvePreflight(selectedProduct, redirector);
      }
    } catch (executeError) {
      if (requestId !== flowRequestRef.current) return;
      setExecutionError(
        executeError instanceof Error
          ? executeError.message
          : 'Não foi possível concluir o fluxo USA.',
      );
    } finally {
      if (requestId === flowRequestRef.current) setExecutionLoading(false);
    }
  }, [preflight, executionLoading, redirector, resolvePreflight, selectedProduct]);

  const registerWeight = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedProduct || weightResolution?.status !== 'MISSING_WEIGHT' || weightLoading)
        return;

      const normalizedInput = weightInput.trim();
      if (!/^\d+(?:\.\d{1,3})?$/.test(normalizedInput)) {
        setWeightError('Informe um peso positivo em lbs com no máximo 3 casas decimais.');
        return;
      }
      const shippingWeightLbs = Number(normalizedInput);
      if (!Number.isFinite(shippingWeightLbs) || shippingWeightLbs <= 0) {
        setWeightError('Informe um peso positivo em lbs com no máximo 3 casas decimais.');
        return;
      }

      const requestId = weightRequestRef.current;
      setWeightLoading(true);
      setWeightOperation('saving');
      setWeightError(null);
      try {
        await registerUsaShippingWeight(
          selectedProduct,
          { kind: 'SINGLE_ITEM' },
          shippingWeightLbs,
        );
        if (requestId !== weightRequestRef.current) return;
        const resolution = await resolveSelectedWeight(selectedProduct, 'reprocessing');
        if (resolution?.status === 'WEIGHT_FOUND' && redirector) {
          await resolvePreflight(selectedProduct, redirector);
        }
      } catch (registerError) {
        if (requestId !== weightRequestRef.current) return;
        setWeightLoading(false);
        setWeightOperation(null);
        setWeightError(
          registerError instanceof Error
            ? registerError.message
            : 'Não foi possível salvar o peso operacional de envio.',
        );
      }
    },
    [
      redirector,
      resolvePreflight,
      resolveSelectedWeight,
      selectedProduct,
      weightInput,
      weightLoading,
      weightResolution,
    ],
  );

  const search = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const normalizedQuery = query.trim();
      if (normalizedQuery.length < 2) {
        setProducts([]);
        setSelectedProduct(null);
        resetOperationalState();
        resetWeightState();
        setSearched(false);
        setError('Digite pelo menos 2 caracteres para pesquisar.');
        return;
      }

      setLoading(true);
      setError(null);
      setSelectedProduct(null);
      resetOperationalState();
      resetWeightState();
      try {
        setProducts(await searchUsaSourceProducts(normalizedQuery));
        setSearched(true);
      } catch (searchError) {
        setProducts([]);
        setSearched(true);
        setError(
          searchError instanceof Error
            ? searchError.message
            : 'Não foi possível consultar os providers USA.',
        );
      } finally {
        setLoading(false);
      }
    },
    [query, resetOperationalState, resetWeightState],
  );

  const retrySearch = useCallback(() => {
    void search({ preventDefault() {} } as FormEvent<HTMLFormElement>);
  }, [search]);

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-inest-line/70 bg-inest-surface p-4 shadow-[0_14px_34px_rgba(16,24,40,0.055)]">
        <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={search}>
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar iPhone, MacBook, Canon..."
            aria-label="Pesquisar produtos nos EUA"
          />
          <ActionButton type="submit" className="min-h-11" disabled={loading}>
            {loading ? 'Buscando...' : 'Buscar nos EUA'}
          </ActionButton>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge tone="blue">US</StatusBadge>
          <StatusBadge tone="gray">Apple · Amazon · UPCitemdb</StatusBadge>
          <span className="text-xs font-bold text-inest-muted">
            Resultados em USD, sem cálculo nesta etapa.
          </span>
        </div>
      </section>

      {error ? (
        <ErrorState
          title="Busca USA"
          description={error}
          action={
            <ActionButton variant="secondary" onClick={retrySearch}>
              Tentar novamente
            </ActionButton>
          }
        />
      ) : null}
      {loading ? <LoadingState /> : null}
      {!loading && searched && !error && !products.length ? (
        <EmptyState title="Nenhum produto encontrado." description="Tente outro termo de busca." />
      ) : null}

      {!loading && products.length ? (
        <section className="grid gap-3" aria-label="Resultados da busca USA">
          <div className="flex items-center justify-between rounded-2xl border border-inest-line/70 bg-inest-surface px-4 py-3">
            <span className="text-sm font-bold text-inest-text">{products.length} resultados</span>
            <span className="text-xs text-inest-muted">Selecione um produto para continuar</span>
          </div>
          {products.map((product) => (
            <UsaProductCard
              key={`${product.providerName}:${product.sourceProductId}`}
              product={product}
              selected={
                selectedProduct?.sourceProductId === product.sourceProductId &&
                selectedProduct.providerName === product.providerName
              }
              onSelect={selectProduct}
            />
          ))}
        </section>
      ) : null}

      {selectedProduct ? (
        <section
          className="rounded-2xl border border-inest-blue/30 bg-blue-50/50 p-4"
          aria-live="polite"
        >
          <p className="text-xs font-black uppercase tracking-wide text-inest-blue">
            Produto selecionado
          </p>
          <h3 className="mt-1 text-lg font-black text-inest-text">{selectedProduct.sourceName}</h3>
          <p className="mt-1 text-sm text-inest-muted">
            {selectedProduct.providerName} · {selectedProduct.retailer ?? 'Loja não informada'} ·{' '}
            {selectedProduct.sourceProductId}
          </p>
          {decisionLoading ? (
            <p className="mt-4 text-sm font-bold text-inest-muted" role="status">
              Resolvendo produto...
            </p>
          ) : null}
          {decisionError ? (
            <ErrorState
              title="Decisão USA"
              description={decisionError}
              action={
                <ActionButton
                  variant="secondary"
                  onClick={() => void resolveProductDecision(selectedProduct)}
                >
                  Tentar novamente
                </ActionButton>
              }
            />
          ) : null}
          {decision?.status === 'NEEDS_INPUT' ? (
            <form
              className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
              onSubmit={confirmManufacturer}
            >
              <label className="grid gap-1 text-sm font-bold text-inest-text">
                Fabricante
                <input
                  className="min-h-11 rounded-xl border border-inest-line bg-white px-3 text-sm font-semibold outline-none focus:border-inest-blue"
                  value={manufacturerInput}
                  onChange={(event) => setManufacturerInput(event.target.value)}
                  disabled={manufacturerLoading}
                  placeholder="Fabricante"
                />
                <span className="text-xs font-semibold text-inest-muted">
                  Precisamos confirmar o fabricante para continuar.
                  {decision.input.suggestedValue
                    ? ` Sugestão: ${decision.input.suggestedValue}.`
                    : ''}
                </span>
              </label>
              <ActionButton
                type="submit"
                className="min-h-11 self-end"
                disabled={manufacturerLoading}
              >
                {manufacturerLoading ? 'Confirmando...' : 'Confirmar fabricante'}
              </ActionButton>
            </form>
          ) : null}
          {manufacturerError ? (
            <ErrorState
              title="Fabricante"
              description={manufacturerError}
              action={
                <ActionButton variant="secondary" onClick={() => void confirmManufacturer()}>
                  Tentar novamente
                </ActionButton>
              }
            />
          ) : null}
          {!redirector && decision?.status === 'BLOCKED' ? (
            <BlockedState reason={decision.reason} />
          ) : null}
          <UsaRedirectorPanel
            value={redirector}
            loading={
              executionLoading ||
              preflightLoading ||
              decisionLoading ||
              manufacturerLoading ||
              weightLoading
            }
            ready={preflight?.status === 'READY_FOR_COST'}
            onChange={selectRedirector}
            onSubmit={() => void executePricedOffer()}
          />
          {preflightLoading ? (
            <p className="mt-4 text-sm font-bold text-inest-muted" role="status">
              Verificando requisitos do redirecionador...
            </p>
          ) : null}
          {preflightError ? (
            <ErrorState
              title="Verificação USA"
              description={preflightError}
              action={
                <ActionButton
                  variant="secondary"
                  disabled={preflightLoading}
                  onClick={() => redirector && void resolvePreflight(selectedProduct, redirector)}
                >
                  Tentar novamente
                </ActionButton>
              }
            />
          ) : null}
          {preflight?.status === 'BLOCKED' ? <BlockedState reason={preflight.reason} /> : null}
          {preflight?.status === 'READY_FOR_COST' ||
          (preflight?.status === 'NEEDS_INPUT' && preflight.reason === 'MISSING_WEIGHT') ? (
            <UsaShippingWeightPanel
              resolution={weightResolution}
              input={weightInput}
              loading={weightLoading}
              operation={weightOperation}
              error={weightError}
              onInputChange={setWeightInput}
              onSubmit={registerWeight}
              onRetry={
                !weightResolution && redirector
                  ? () => void resolvePreflight(selectedProduct, redirector)
                  : undefined
              }
            />
          ) : null}
          {executionError ? (
            <ErrorState
              title="Fluxo USA"
              description={executionError}
              action={
                <ActionButton variant="secondary" onClick={() => void executePricedOffer()}>
                  Tentar novamente
                </ActionButton>
              }
            />
          ) : null}
          {executionLoading ? (
            <p className="mt-4 text-sm font-bold text-inest-muted" role="status">
              Calculando custo, precificando e gerando oferta...
            </p>
          ) : null}
          {executionResult ? <UsaExecutionResult result={executionResult} /> : null}
        </section>
      ) : null}
    </div>
  );
}

function UsaShippingWeightPanel({
  resolution,
  input,
  loading,
  operation,
  error,
  onInputChange,
  onSubmit,
  onRetry,
}: {
  resolution: UsaShippingWeightResolution | null;
  input: string;
  loading: boolean;
  operation: 'resolving' | 'saving' | 'reprocessing' | null;
  error: string | null;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRetry?: () => void;
}) {
  if (loading && !resolution) {
    return (
      <p className="mt-4 text-sm font-bold text-inest-muted" role="status">
        {operation === 'reprocessing' ? 'Reprocessando o mesmo produto...' : 'Resolvendo peso...'}
      </p>
    );
  }

  if (error) {
    return (
      <div
        className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-700"
        role="alert"
      >
        {error}
        {onRetry ? (
          <div className="mt-3">
            <ActionButton variant="secondary" onClick={onRetry}>
              Tentar novamente
            </ActionButton>
          </div>
        ) : null}
      </div>
    );
  }

  if (resolution?.status === 'WEIGHT_FOUND') {
    return (
      <p className="mt-4 text-sm font-bold text-emerald-700" role="status">
        Peso: {formatWeightLbs(resolution.shippingWeightLbs)} lbs ✓
      </p>
    );
  }

  if (resolution?.status === 'MISSING_WEIGHT') {
    return (
      <form className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={onSubmit}>
        <label className="grid gap-1 text-sm font-bold text-inest-text">
          Peso em libras (lbs)
          <input
            className="min-h-11 rounded-xl border border-inest-line bg-white px-3 text-sm font-semibold outline-none focus:border-inest-blue"
            type="number"
            min="0.001"
            step="0.001"
            inputMode="decimal"
            placeholder="0.000"
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            disabled={loading}
            aria-describedby="usa-weight-help"
          />
          <span id="usa-weight-help" className="text-xs font-semibold text-inest-muted">
            Precisamos confirmar o peso para continuar. Ex.: 0.500, 0.650, 3.950.
          </span>
        </label>
        <ActionButton type="submit" className="min-h-11 self-end" disabled={loading}>
          {loading
            ? operation === 'saving'
              ? 'Salvando...'
              : 'Reprocessando...'
            : 'Confirmar peso'}
        </ActionButton>
      </form>
    );
  }

  if (resolution?.status === 'KEY_INSUFFICIENT') {
    return (
      <p className="mt-4 text-sm font-semibold text-amber-700" role="status">
        Não foi possível determinar uma identidade logística segura para este produto.
      </p>
    );
  }

  if (resolution?.status === 'KEY_AMBIGUOUS') {
    return (
      <p className="mt-4 text-sm font-semibold text-amber-700" role="status">
        A identidade logística deste produto está ambígua e não permite cadastrar peso.
      </p>
    );
  }

  return null;
}

function UsaRedirectorPanel({
  value,
  loading,
  ready,
  onChange,
  onSubmit,
}: {
  value: '' | 'RED_DELAWARE' | 'REI_DO_IMPORTADO';
  loading: boolean;
  ready: boolean;
  onChange: (value: '' | 'RED_DELAWARE' | 'REI_DO_IMPORTADO') => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mt-4 grid gap-3 rounded-xl border border-inest-line/70 bg-white/70 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <label className="grid gap-1 text-sm font-bold text-inest-text">
        Redirecionador
        <select
          className="min-h-11 rounded-xl border border-inest-line bg-white px-3 text-sm font-semibold outline-none focus:border-inest-blue"
          value={value}
          onChange={(event) =>
            onChange(event.target.value as '' | 'RED_DELAWARE' | 'REI_DO_IMPORTADO')
          }
          disabled={loading}
        >
          <option value="">Selecione para continuar</option>
          <option value="RED_DELAWARE">Red Delaware</option>
          <option value="REI_DO_IMPORTADO">Rei do Importado</option>
        </select>
      </label>
      <ActionButton
        className="min-h-11"
        variant="success"
        disabled={!value || loading || !ready}
        onClick={onSubmit}
      >
        {loading ? 'Processando...' : 'Calcular e gerar oferta'}
      </ActionButton>
    </div>
  );
}

function UsaExecutionResult({ result }: { result: UsaPricedOfferResponse }) {
  if (result.status !== 'READY' || !result.pricing || !result.costExecution.calculation) {
    return <BlockedState reason={result.reason ?? 'FLUXO_BLOQUEADO'} />;
  }

  return (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4" role="status">
      <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
        Oferta USA concluída
      </p>
      <div className="mt-2 grid gap-1 text-sm font-semibold text-inest-text sm:grid-cols-3">
        <span>FinalCost: {formatBrl(result.costExecution.calculation.finalCost.amountBrl)}</span>
        <span>Preço: {formatBrl(result.pricing.salePrice)}</span>
        <span>Oferta: {formatBrl(result.pricing.offerPrice)}</span>
      </div>
      {result.offer?.id ? (
        <p className="mt-2 text-xs font-semibold text-emerald-700">
          Oferta registrada: {result.offer.id}
        </p>
      ) : null}
    </div>
  );
}

function BlockedState({ reason }: { reason: string }) {
  return (
    <div
      className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-800"
      role="status"
    >
      {humanizeUsaBlockedReason(reason)}
    </div>
  );
}

function humanizeUsaBlockedReason(reason: string) {
  const messages: Record<string, string> = {
    KEY_INSUFFICIENT: 'Não foi possível identificar com segurança a configuração deste produto.',
    KEY_AMBIGUOUS: 'Encontramos mais de uma configuração possível para este produto.',
    MANUFACTURER_AMBIGUOUS: 'Não foi possível confirmar o fabricante com segurança.',
    RETAILER_UNRESOLVED: 'Não foi possível confirmar a loja desta oferta.',
    LOGISTIC_CLASSIFICATION_UNRESOLVED: 'Não foi possível classificar este produto com segurança.',
    ENRICHMENT_CONFLICT: 'Encontramos informações conflitantes para este produto.',
    condition_unresolved: 'A condição do produto não foi resolvida com segurança.',
    insufficient_identity: 'A identidade financeira do produto é insuficiente.',
    ambiguous_identity: 'A identidade financeira do produto é ambígua.',
    missing_profit: 'Não existe lucro homologado para este produto.',
    collision: 'Existe conflito entre registros de lucro para este produto.',
    classification_unresolved: 'Não foi possível classificar este produto financeiramente.',
    MISSING_WEIGHT: 'Precisamos confirmar o peso para continuar.',
    SETTINGS_UNAVAILABLE: 'As configurações USA não estão disponíveis.',
    USD_BRL_QUOTE_NOT_CONFIGURED: 'A cotação USD/BRL não está configurada.',
    FLUXO_BLOQUEADO: 'O produto não pode continuar neste momento.',
  };
  return messages[reason] ?? 'O produto não pode continuar com segurança.';
}

function UsaProductCard({
  product,
  selected,
  onSelect,
}: {
  product: UsaSourceProduct;
  selected: boolean;
  onSelect: (product: UsaSourceProduct) => void;
}) {
  const attributes = [product.model, product.capacity, product.color, product.condition].filter(
    Boolean,
  );
  return (
    <article
      className={`grid gap-4 rounded-2xl border bg-inest-surface p-5 shadow-[0_14px_34px_rgba(16,24,40,0.055)] lg:grid-cols-[72px_minmax(0,1fr)_190px_auto] lg:items-center ${selected ? 'border-inest-blue bg-blue-50/40' : 'border-inest-line/70'}`}
    >
      <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl bg-inest-soft text-xs font-black text-inest-muted">
        {product.imageUrl ? (
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(product.imageUrl)})` }}
          />
        ) : (
          'US'
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="line-clamp-2 text-base font-black text-inest-text">
            {product.sourceName}
          </h3>
          <StatusBadge tone="green">US</StatusBadge>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {attributes.map((attribute) => (
            <span
              key={attribute}
              className="rounded-md bg-inest-soft px-2 py-1 text-xs font-semibold text-inest-muted"
            >
              {attribute}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-inest-muted">Provider: {product.providerName}</p>
        <p className="text-xs text-inest-muted">Retailer: {product.retailer ?? 'Não informado'}</p>
      </div>
      <div className="border-t border-inest-line/70 pt-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0 lg:text-right">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-inest-muted">
          Preço da fonte
        </span>
        <strong className="mt-1 block font-display text-2xl font-black text-inest-text">
          {formatUsd(product.priceUsd)}
        </strong>
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        {product.sourceUrl ? (
          <a
            className="inline-flex min-h-11 items-center rounded-xl border border-inest-line px-3 text-sm font-bold text-inest-text"
            href={product.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Abrir fonte
          </a>
        ) : null}
        <ActionButton
          variant={selected ? 'secondary' : 'success'}
          className="min-h-11"
          onClick={() => onSelect(product)}
        >
          {selected ? 'Selecionado' : 'Selecionar'}
        </ActionButton>
      </div>
    </article>
  );
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatWeightLbs(value: number) {
  return value.toFixed(3);
}

function formatBrl(value: number | null) {
  return value === null
    ? '—'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
