export function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? '');
}

export function getWhatsappShareLink(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
