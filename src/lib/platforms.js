export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return dateKey(d);
}

export function formatDay(key) {
  return new Date(`${key}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function initials(name) {
  return (name || "?").split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "") || fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function countStreak(heatmap) {
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    if ((heatmap[todayKey(-i)] || 0) > 0) streak += 1;
    else break;
  }
  return streak;
}
