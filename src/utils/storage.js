// Simple localStorage helpers for persisting user preferences and cache data.

export function setLocalItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Failed to save to localStorage", e);
  }
}

export function getLocalItem(key, defaultValue = null) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch (e) {
    console.warn("Failed to read from localStorage", e);
    return defaultValue;
  }
}
