export function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

export function monthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

export function dayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function isToday(value?: Date) {
  if (!value) {
    return false;
  }
  return dayKey(value) === dayKey(new Date());
}
