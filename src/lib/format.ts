export function formatEditorialDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function normalizeSearchTerm(value: string) {
  return value.trim().toLocaleLowerCase();
}
