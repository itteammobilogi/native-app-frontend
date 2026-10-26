// Port of the website's utils/formatRelativeTime.js.
export function formatRelativeTime(input?: string | null) {
  if (!input) return '';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;

  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return plural(min, 'minute');
  const hr = Math.floor(min / 60);
  if (hr < 24) return plural(hr, 'hour');
  const day = Math.floor(hr / 24);
  if (day < 30) return plural(day, 'day');
  const month = Math.floor(day / 30);
  if (month < 12) return plural(month, 'month');
  return plural(Math.floor(month / 12), 'year');
}
