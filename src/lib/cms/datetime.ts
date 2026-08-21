const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export const defaultNewsroomTimeZone = "America/New_York";

function partsInZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

export function parseUtcDateTime(value: string | null, field: string) {
  if (!value) return null;
  const normalized = localDateTimePattern.test(value) ? `${value}:00.000Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.valueOf())) throw new Error(`${field} is not a valid date.`);
  return date;
}

export function parseZonedDateTime(value: string | null, timeZone: string, field: string) {
  if (!value) return null;
  const match = localDateTimePattern.exec(value);
  if (!match) throw new Error(`${field} is not a valid local date and time.`);

  const desired = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
  const desiredAsUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
    desired.second,
  );

  let candidate = desiredAsUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const displayed = partsInZone(new Date(candidate), timeZone);
    const displayedAsUtc = Date.UTC(
      displayed.year,
      displayed.month - 1,
      displayed.day,
      displayed.hour,
      displayed.minute,
      displayed.second,
    );
    candidate = desiredAsUtc - (displayedAsUtc - candidate);
  }

  const result = new Date(candidate);
  const displayed = partsInZone(result, timeZone);
  if (Object.keys(desired).some((key) => desired[key as keyof typeof desired] !== displayed[key as keyof typeof displayed])) {
    throw new Error(`${field} does not exist in the selected timezone.`);
  }
  return result;
}

export function formatDateTimeInZone(value: Date | null | undefined, timeZone = "UTC") {
  if (!value) return "";
  const parts = partsInZone(value, timeZone);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}
