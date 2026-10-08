const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
  ["second", 1],
];

export function relativeTime(isoDate: string) {
  const seconds = Math.round((new Date(isoDate).getTime() - Date.now()) / 1000);
  const unit = units.find(([, size]) => Math.abs(seconds) >= size);

  if (!unit) {
    return "just now";
  }

  const [name, size] = unit;
  return formatter.format(Math.round(seconds / size), name);
}
