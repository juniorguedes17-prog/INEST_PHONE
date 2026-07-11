export function LoadingState() {
  return (
    <div className="grid gap-4" aria-label="Carregando">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-28 animate-pulse rounded-xl border border-inest-line bg-gradient-to-r from-white via-inest-soft to-white"
        />
      ))}
    </div>
  );
}
