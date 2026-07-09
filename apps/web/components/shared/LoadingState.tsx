export function LoadingState() {
  return (
    <div className="grid gap-4" aria-label="Carregando">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-32 animate-pulse rounded-2xl border border-inest-line bg-gradient-to-r from-white via-inest-soft to-white"
        />
      ))}
    </div>
  );
}
