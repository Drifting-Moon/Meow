export const CACHE_TTL = 30 * 60 * 1000;
export const PLATFORMS = ["leetcode", "codeforces", "gfg"];

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export function localDateKey(seconds) {
  return dateKey(new Date(seconds * 1000));
}

export function todayMidnightUnix() {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000);
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

export async function fetchJson(url, { timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export function countStreak(heatmap) {
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    if ((heatmap[todayKey(-i)] || 0) > 0) streak += 1;
    else break;
  }
  return streak;
}

export function normalizeLeetCode(data) {
  const rawCalendar = typeof data.submissionCalendar === "string" ? JSON.parse(data.submissionCalendar || "{}") : data.submissionCalendar || {};
  const heatmap = {};
  Object.entries(rawCalendar).forEach(([unix, count]) => {
    heatmap[localDateKey(Number(unix))] = Number(count) || 0;
  });
  const todaySolved = Number(rawCalendar[todayMidnightUnix()]) || heatmap[todayKey()] || 0;
  return {
    raw: data,
    totalSolved: Number(data.totalSolved) || 0,
    easy: Number(data.easySolved) || 0,
    medium: Number(data.mediumSolved) || 0,
    hard: Number(data.hardSolved) || 0,
    ranking: data.ranking,
    acceptanceRate: data.acceptanceRate,
    heatmap,
    todaySolved,
    streak: countStreak(heatmap),
    status: "loaded"
  };
}

export async function fetchLeetCode(username) {
  if (!username) return { heatmap: {}, todaySolved: 0, streak: 0, status: "idle" };
  const data = await fetchJson(`https://leetcode-stats-api.herokuapp.com/${encodeURIComponent(username)}`, { timeoutMs: 14000 });
  if (data.status === "error") throw new Error(data.message || "LeetCode user not found");
  return normalizeLeetCode(data);
}

export function normalizeCodeforces(infoData, statusData, ratingData) {
  if (infoData.status !== "OK") throw new Error(infoData.comment || "Codeforces profile failed");
  if (statusData.status !== "OK") throw new Error(statusData.comment || "Codeforces submissions failed");
  const profile = infoData.result?.[0] || {};
  const accepted = new Map();
  (statusData.result || []).forEach((submission) => {
    if (submission.verdict !== "OK" || !submission.problem) return;
    const problem = submission.problem;
    const key = `${problem.contestId || "gym"}-${problem.index}-${problem.name}`;
    const existing = accepted.get(key);
    if (!existing || submission.creationTimeSeconds < existing.creationTimeSeconds) accepted.set(key, submission);
  });
  const heatmap = {};
  accepted.forEach((submission) => {
    const key = localDateKey(submission.creationTimeSeconds);
    heatmap[key] = (heatmap[key] || 0) + 1;
  });
  const ratingHistory = ratingData.status === "OK" ? (ratingData.result || []).map((r) => ({
    contestName: r.contestName,
    date: formatDay(localDateKey(r.ratingUpdateTimeSeconds)),
    ratingUpdateTimeSeconds: r.ratingUpdateTimeSeconds,
    oldRating: r.oldRating,
    newRating: r.newRating
  })) : [];
  return {
    raw: { profile, submissions: statusData.result || [] },
    totalSolved: accepted.size,
    heatmap,
    todaySolved: heatmap[todayKey()] || 0,
    streak: countStreak(heatmap),
    rating: profile.rating || 0,
    maxRating: profile.maxRating || 0,
    rank: profile.rank || "unrated",
    maxRank: profile.maxRank || "unrated",
    ratingHistory,
    status: "loaded"
  };
}

export async function fetchCodeforces(handle, friendIndex = 0) {
  if (!handle) return { heatmap: {}, todaySolved: 0, streak: 0, ratingHistory: [], status: "idle" };
  await sleep(friendIndex * 750);
  const encoded = encodeURIComponent(handle);
  const info = await fetchJson(`https://codeforces.com/api/user.info?handles=${encoded}`);
  await sleep(250);
  const status = await fetchJson(`https://codeforces.com/api/user.status?handle=${encoded}&from=1&count=300`);
  await sleep(250);
  const rating = await fetchJson(`https://codeforces.com/api/user.rating?handle=${encoded}`);
  return normalizeCodeforces(info, status, rating);
}

export async function fetchGfg(username) {
  if (!username) return { todaySolved: 0, status: "idle" };
  const data = await fetchJson(`https://gfg-api-fefa.onrender.com/${encodeURIComponent(username)}`, { timeoutMs: 5000 });
  return normalizeGfg(data);
}

export function normalizeGfg(data) {
  const totalSolved = Number(data.totalSolved || data.total_problems_solved || data.solvedStats?.total?.count) || 0;
  return {
    raw: data,
    totalSolved,
    easy: Number(data.easy || data.solvedStats?.easy?.count) || 0,
    medium: Number(data.medium || data.solvedStats?.medium?.count) || 0,
    hard: Number(data.hard || data.solvedStats?.hard?.count) || 0,
    streak: Number(data.streak) || 0,
    rank: data.rank,
    overallScore: data.overallScore,
    todaySolved: 0,
    status: "loaded"
  };
}

export async function fetchPlatform(platform, username, index = 0) {
  if (platform === "leetcode") return fetchLeetCode(username);
  if (platform === "codeforces") return fetchCodeforces(username, index);
  if (platform === "gfg") return fetchGfg(username);
  throw new Error(`Unknown platform: ${platform}`);
}
