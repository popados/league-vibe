// Misc helper utilities for formatting and data transformations.

export function formatKDA(kills, deaths, assists) {
  return `${kills}/${deaths}/${assists}`;
}

export function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString();
}
