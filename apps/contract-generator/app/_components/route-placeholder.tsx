type RoutePlaceholderProps = {
  title: string;
  route: string;
};

export function RoutePlaceholder({ title, route }: RoutePlaceholderProps) {
  return (
    <section className="route-placeholder" aria-labelledby="route-title">
      <p className="route-kicker">Estrutura inicial</p>
      <h1 className="route-title" id="route-title">
        {title}
      </h1>
      <p className="route-description">Esta rota está preparada para uma etapa futura.</p>
      <code className="route-label">{route}</code>
    </section>
  );
}
