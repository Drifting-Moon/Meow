import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Award,
  BarChart3,
  Cat,
  Check,
  ChevronDown,
  Clock,
  Coins,
  DollarSign,
  Flame,
  GitGraph,
  Lock,
  LogOut,
  Medal,
  Plus,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Target,
  Trash2,
  Trophy,
  User,
  X,
  Zap
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useAuth, useFriends, useGoals, useManualLogs, useSharedGoals, useStats, useGlobalSettings } from "./hooks";
import { clamp, formatDay, initials, loadJson, saveJson, todayKey } from "./lib/platforms";
import { supabase } from "./lib/supabase";
import "./styles.css";

const COLORS = ["#00ff87", "#38bdf8", "#a78bfa", "#fbbf24", "#fb7185", "#2dd4bf"];
const LOGIN_SHORTCUTS_KEY = "meow:friend-login-shortcuts:v1";
const DEFAULT_LOGIN_SHORTCUTS = [
  { name: "Jayant", email: "jayant@gmail.com", password: "Jayant", color: COLORS[0] },
  { name: "krish", email: "krish@gmail.com", password: "Krish", color: COLORS[1] },
  { name: "Arshita", email: "arshita@gmail.com", password: "Arshita", color: COLORS[2] }
];
const DIFFICULTIES = {
  easy: { label: "Easy", color: "#22c55e" },
  medium: { label: "Medium", color: "#f59e0b" },
  hard: { label: "Hard", color: "#ef4444" }
};
function heatmapArray(friend, days = 365) {
  return Array.from({ length: days }, (_, i) => {
    const key = todayKey(i - days + 1);
    const count = friend.heatmap?.[key] || 0;
    return { date: key, count };
  });
}

function mergedCount(friend, key) {
  return friend.heatmap?.[key] || 0;
}

function weekTotal(friend) {
  return Array.from({ length: 7 }, (_, i) => mergedCount(friend, todayKey(-i))).reduce((s, n) => s + n, 0);
}

function rankFriends(friends) {
  return [...friends].sort((a, b) => b.totalSolved - a.totalSolved);
}

function calculateEstimatedDoneDate(friend, globalStartDateStr = "2026-05-20") {
  const startDateStr = friend.challengeStartDate || globalStartDateStr;
  const start = new Date(startDateStr);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = Math.abs(today - start);
  const daysPassed = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const solved = friend.totalSolved || 0;
  const target = friend.longGoal || 300;

  if (solved >= target) {
    return { estString: "Completed! 🎉", paceStatus: "🚀 Ahead of schedule", paceColor: "var(--green)", daysPassed, dailyPace: solved / daysPassed };
  }

  const dailyPace = solved / daysPassed;
  const expectedSolved = (friend.dailyGoal || 2) * daysPassed;
  let paceStatus = "";
  let paceColor = "";

  if (solved >= expectedSolved) {
    paceStatus = "🚀 Ahead of schedule";
    paceColor = "var(--green)";
  } else {
    const behind = expectedSolved - solved;
    paceStatus = `⚠️ ${behind} problems behind pace`;
    paceColor = "#f59e0b";
  }

  if (dailyPace <= 0) {
    return { estString: "Est. done: Never (no daily solves)", paceStatus, paceColor, daysPassed, dailyPace: 0 };
  }

  const remaining = target - solved;
  const daysNeeded = Math.ceil(remaining / dailyPace);

  const estDate = new Date();
  estDate.setDate(estDate.getDate() + daysNeeded);

  const options = { month: "short", year: "numeric" };
  const formattedDate = estDate.toLocaleDateString("en-US", options);

  return {
    estString: `Est. done: ${formattedDate}`,
    paceStatus,
    paceColor,
    daysPassed,
    dailyPace
  };
}

function GoalProgressCard({ friends, startDate }) {
  return (
    <CardSpotlight className="panel" style={{ padding: "20px", marginTop: "18px", width: "100%" }}>
      <div className="section-head" style={{ marginBottom: "16px" }}>
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: "800", margin: 0 }}>Long-Term Goal Progress</h2>
          <p className="muted" style={{ fontSize: "12px", margin: "4px 0 0 0" }}>Contestants progress toward their long-term target and pace projections.</p>
        </div>
        <Target size={18} />
      </div>

      <div style={{ display: "grid", gap: "16px" }}>
        {friends.map((friend) => {
          const { estString, paceStatus, paceColor } = calculateEstimatedDoneDate(friend, startDate);
          const solved = friend.totalSolved || 0;
          const target = friend.longGoal || 300;
          const pct = Math.round((solved / Math.max(1, target)) * 100);

          return (
            <div key={friend.id} style={{ display: "grid", gap: "8px", border: "1px solid var(--line)", padding: "14px", borderRadius: "14px", background: "rgba(2, 6, 23, 0.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span className="mini-avatar" style={{ "--tag": friend.color, width: "24px", height: "24px", fontSize: "11px" }}>{friend.initials}</span>
                  <b style={{ color: friend.color, fontSize: "13px" }}>{friend.name}</b>
                </div>

                <div style={{ display: "flex", gap: "12px", alignItems: "center", fontSize: "12px", flexWrap: "wrap" }}>
                  <span className="muted">{solved} / {target} problems ({pct}%)</span>
                  <span className="muted">•</span>
                  <span className="muted" style={{ fontWeight: "600" }}>{estString}</span>
                  <span className="muted">•</span>
                  <span style={{ color: paceColor, fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    {paceStatus}
                  </span>
                </div>
              </div>

              <div style={{ height: "10px", background: "#111827", border: "1px solid rgba(148,163,184,.12)", borderRadius: "999px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: friend.color, borderRadius: "inherit", transition: "width 1s ease" }} />
              </div>
            </div>
          );
        })}
      </div>
    </CardSpotlight>
  );
}

function CompetitionPacePanel({ friends, logs, startDate }) {
  const rankedFriends = [...friends].map((f) => {
    const friendStart = new Date(f.challengeStartDate || startDate || "2026-05-20");
    friendStart.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(today - friendStart);
    const daysPassed = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const solved = f.totalSolved || 0;
    const target = f.longGoal || 300;
    const dailyPace = solved / daysPassed;
    const expectedSolved = (f.dailyGoal || 2) * daysPassed;
    const behind = Math.max(0, expectedSolved - solved);
    const remaining = Math.max(0, target - solved);
    const daysNeeded = dailyPace > 0 ? Math.ceil(remaining / dailyPace) : Infinity;

    // Last 7 days solves
    const friendLogs = logs.filter((l) => l.user_id === f.id);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const last7DaysSolved = friendLogs
      .filter((l) => new Date(l.log_date) >= sevenDaysAgo)
      .reduce((sum, l) => sum + Number(l.count || 0), 0);

    return {
      ...f,
      dailyPace,
      expectedSolved,
      behind,
      daysNeeded,
      last7DaysSolved,
      daysPassed
    };
  });

  // Calculate superlatives
  const highestPace = [...rankedFriends].sort((a, b) => b.dailyPace - a.dailyPace)[0];
  const highestStreak = [...rankedFriends].sort((a, b) => b.streak - a.streak)[0];
  const highest7Days = [...rankedFriends].sort((a, b) => b.last7DaysSolved - a.last7DaysSolved)[0];

  return (
    <CardSpotlight className="panel competition-pace-panel" style={{ padding: "20px", marginTop: "18px", width: "100%" }}>
      <div className="section-head" style={{ marginBottom: "16px" }}>
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: "800", margin: 0 }}>Competition & Pace Leaderboard</h2>
          <p className="muted" style={{ fontSize: "12px", margin: "4px 0 0 0" }}>Deep-dive comparison metrics, weekly velocity, and competition standings.</p>
        </div>
        <Swords size={18} style={{ color: "var(--amber)" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
        
        {/* 1. Velocity Leaderboard */}
        <div style={{ padding: "16px", border: "1px solid var(--line)", borderRadius: "16px", background: "rgba(2, 6, 23, 0.35)" }}>
          <h3 style={{ fontSize: "13px", fontWeight: "800", margin: "0 0 12px 0", color: "#38bdf8", display: "flex", alignItems: "center", gap: "6px" }}>
            <Zap size={14} /> Solves Velocity (per day)
          </h3>
          <div style={{ display: "grid", gap: "12px" }}>
            {rankedFriends.sort((a, b) => b.dailyPace - a.dailyPace).map((f) => (
              <div key={f.id} style={{ display: "grid", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <span style={{ color: f.color, fontWeight: "700" }}>{f.name}</span>
                  <span className="muted" style={{ fontFamily: "Geist Mono, monospace" }}>
                    <b>{f.dailyPace.toFixed(1)}/d</b> avg
                  </span>
                </div>
                <div style={{ height: "6px", background: "#111827", borderRadius: "99px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (f.dailyPace / 4) * 100)}%`, background: f.color, borderRadius: "inherit" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. 7-Day Sprint Race */}
        <div style={{ padding: "16px", border: "1px solid var(--line)", borderRadius: "16px", background: "rgba(2, 6, 23, 0.35)" }}>
          <h3 style={{ fontSize: "13px", fontWeight: "800", margin: "0 0 12px 0", color: "#a78bfa", display: "flex", alignItems: "center", gap: "6px" }}>
            <Flame size={14} /> 7-Day Sprint (Total Solves)
          </h3>
          <div style={{ display: "grid", gap: "12px" }}>
            {rankedFriends.sort((a, b) => b.last7DaysSolved - a.last7DaysSolved).map((f) => (
              <div key={f.id} style={{ display: "grid", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <span style={{ color: f.color, fontWeight: "700" }}>{f.name}</span>
                  <span className="muted" style={{ fontFamily: "Geist Mono, monospace" }}>
                    <b>{f.last7DaysSolved} solved</b>
                  </span>
                </div>
                <div style={{ height: "6px", background: "#111827", borderRadius: "99px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (f.last7DaysSolved / 28) * 100)}%`, background: f.color, borderRadius: "inherit" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Competition Badges / Standings */}
        <div style={{ padding: "16px", border: "1px solid var(--line)", borderRadius: "16px", background: "rgba(2, 6, 23, 0.35)", display: "grid", gap: "10px", alignContent: "start" }}>
          <h3 style={{ fontSize: "13px", fontWeight: "800", margin: "0 0 4px 0", color: "#fbbf24", display: "flex", alignItems: "center", gap: "6px" }}>
            <Award size={14} /> Competition Superlatives
          </h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
            {highestPace && highestPace.dailyPace > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: "10px" }}>
                <span style={{ fontSize: "14px" }}>🏆</span>
                <div>
                  <b style={{ color: highestPace.color }}>{highestPace.name}</b> is the <b>Pace Leader</b> ({highestPace.dailyPace.toFixed(1)}/d)
                </div>
              </div>
            )}
            
            {highest7Days && highest7Days.last7DaysSolved > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", background: "rgba(167, 139, 250, 0.08)", border: "1px solid rgba(167, 139, 250, 0.2)", borderRadius: "10px" }}>
                <span style={{ fontSize: "14px" }}>⚡</span>
                <div>
                  <b style={{ color: highest7Days.color }}>{highest7Days.name}</b> is on a <b>Sprint Streak</b> ({highest7Days.last7DaysSolved} problems this week)
                </div>
              </div>
            )}

            {highestStreak && highestStreak.streak > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", background: "rgba(251, 146, 60, 0.08)", border: "1px solid rgba(251, 146, 60, 0.2)", borderRadius: "10px" }}>
                <span style={{ fontSize: "14px" }}>🔥</span>
                <div>
                  <b style={{ color: highestStreak.color }}>{highestStreak.name}</b> has the <b>Highest Streak</b> ({highestStreak.streak} days)
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </CardSpotlight>
  );
}

/* ── Head-to-Head Duel Cards ── */
function HeadToHeadDuels({ friends, logs, startDate }) {
  if (friends.length < 2) return null;

  const pairs = [];
  for (let i = 0; i < friends.length; i++) {
    for (let j = i + 1; j < friends.length; j++) {
      pairs.push([friends[i], friends[j]]);
    }
  }

  const getWeekSolves = (f) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return logs
      .filter((l) => l.user_id === f.id && new Date(l.log_date) >= sevenDaysAgo)
      .reduce((sum, l) => sum + Number(l.count || 0), 0);
  };

  return (
    <CardSpotlight className="panel" style={{ padding: "20px", marginTop: "18px", width: "100%" }}>
      <div className="section-head" style={{ marginBottom: "16px" }}>
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: "800", margin: 0 }}>⚔️ Head-to-Head Duels</h2>
          <p className="muted" style={{ fontSize: "12px", margin: "4px 0 0 0" }}>Direct matchups between every pair of contestants across key battle categories.</p>
        </div>
        <Swords size={18} style={{ color: "#ef4444" }} />
      </div>

      <div style={{ display: "grid", gap: "14px" }}>
        {pairs.map(([a, b]) => {
          const aSolves = a.totalSolved || 0;
          const bSolves = b.totalSolved || 0;
          const aStreak = a.streak || 0;
          const bStreak = b.streak || 0;
          const aWeek = getWeekSolves(a);
          const bWeek = getWeekSolves(b);

          // Score categories: total, streak, weekly
          let aWins = 0, bWins = 0;
          if (aSolves > bSolves) aWins++; else if (bSolves > aSolves) bWins++;
          if (aStreak > bStreak) aWins++; else if (bStreak > aStreak) bWins++;
          if (aWeek > bWeek) aWins++; else if (bWeek > aWeek) bWins++;

          const winner = aWins > bWins ? a : bWins > aWins ? b : null;

          return (
            <div key={`${a.id}-${b.id}`} style={{ border: "1px solid var(--line)", borderRadius: "16px", background: "rgba(2, 6, 23, 0.35)", padding: "16px", overflow: "hidden" }}>
              {/* Header with names */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="mini-avatar" style={{ "--tag": a.color, width: "28px", height: "28px", fontSize: "11px" }}>{a.initials}</span>
                  <b style={{ color: a.color, fontSize: "14px" }}>{a.name}</b>
                </div>
                <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>vs</span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <b style={{ color: b.color, fontSize: "14px" }}>{b.name}</b>
                  <span className="mini-avatar" style={{ "--tag": b.color, width: "28px", height: "28px", fontSize: "11px" }}>{b.initials}</span>
                </div>
              </div>

              {/* Category bars */}
              <div style={{ display: "grid", gap: "10px" }}>
                {[
                  { label: "Total Solved", aVal: aSolves, bVal: bSolves },
                  { label: "Current Streak", aVal: aStreak, bVal: bStreak },
                  { label: "This Week", aVal: aWeek, bVal: bWeek }
                ].map(({ label, aVal, bVal }) => {
                  const max = Math.max(aVal, bVal, 1);
                  const aIsAhead = aVal > bVal;
                  const bIsAhead = bVal > aVal;
                  return (
                    <div key={label}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                        <span style={{ color: aIsAhead ? a.color : "#94a3b8", fontWeight: aIsAhead ? "700" : "400" }}>{aVal}</span>
                        <span className="muted" style={{ fontWeight: "600" }}>{label}</span>
                        <span style={{ color: bIsAhead ? b.color : "#94a3b8", fontWeight: bIsAhead ? "700" : "400" }}>{bVal}</span>
                      </div>
                      <div style={{ display: "flex", gap: "3px", height: "8px" }}>
                        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
                          <div style={{ height: "100%", width: `${(aVal / max) * 100}%`, background: aIsAhead ? a.color : "rgba(148,163,184,0.25)", borderRadius: "99px 0 0 99px", transition: "width 0.8s ease" }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ height: "100%", width: `${(bVal / max) * 100}%`, background: bIsAhead ? b.color : "rgba(148,163,184,0.25)", borderRadius: "0 99px 99px 0", transition: "width 0.8s ease" }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Winner badge */}
              <div style={{ marginTop: "12px", textAlign: "center", fontSize: "12px" }}>
                {winner ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 12px", background: `${winner.color}15`, border: `1px solid ${winner.color}40`, borderRadius: "99px", fontWeight: "700", color: winner.color }}>
                    <Trophy size={12} /> {winner.name} leads {aWins > bWins ? aWins : bWins}–{aWins > bWins ? bWins : aWins}
                  </span>
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 12px", background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "99px", fontWeight: "700", color: "#94a3b8" }}>
                    ⚖️ Dead Even
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </CardSpotlight>
  );
}

/* ── Consistency Scoreboard ── */
function ConsistencyScoreboard({ friends, logs, startDate }) {
  const results = friends.map((f) => {
    const start = new Date(f.challengeStartDate || startDate || "2026-05-20");
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalDays = Math.max(1, Math.ceil((today - start) / (1000 * 60 * 60 * 24)));

    const dailyTarget = f.dailyGoal || 2;
    const friendLogs = logs.filter((l) => l.user_id === f.id);

    // Count days where target was met
    const dayMap = {};
    friendLogs.forEach((l) => {
      const key = l.log_date?.slice(0, 10);
      if (key) dayMap[key] = (dayMap[key] || 0) + Number(l.count || 0);
    });

    let metDays = 0;
    for (let d = 0; d < totalDays; d++) {
      const date = new Date(start);
      date.setDate(date.getDate() + d);
      const key = date.toISOString().slice(0, 10);
      if ((dayMap[key] || 0) >= dailyTarget) metDays++;
    }

    const pct = Math.round((metDays / totalDays) * 100);
    const grade = pct >= 90 ? "S" : pct >= 75 ? "A" : pct >= 50 ? "B" : pct >= 25 ? "C" : "D";
    const gradeColor = pct >= 90 ? "#22c55e" : pct >= 75 ? "#38bdf8" : pct >= 50 ? "#fbbf24" : pct >= 25 ? "#f97316" : "#ef4444";

    return { ...f, metDays, totalDays, pct, grade, gradeColor };
  });

  results.sort((a, b) => b.pct - a.pct);

  return (
    <CardSpotlight className="panel" style={{ padding: "20px", marginTop: "18px", width: "100%" }}>
      <div className="section-head" style={{ marginBottom: "16px" }}>
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: "800", margin: 0 }}>📊 Consistency Scoreboard</h2>
          <p className="muted" style={{ fontSize: "12px", margin: "4px 0 0 0" }}>Percentage of days each contestant met their daily target. Higher consistency = stronger discipline.</p>
        </div>
        <BarChart3 size={18} style={{ color: "#22c55e" }} />
      </div>

      <div style={{ display: "grid", gap: "14px" }}>
        {results.map((r, idx) => (
          <div key={r.id} style={{ display: "grid", gap: "8px", padding: "14px", border: "1px solid var(--line)", borderRadius: "14px", background: "rgba(2, 6, 23, 0.35)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px", fontWeight: "900", color: idx === 0 ? "#fbbf24" : "#475569", fontFamily: "Geist Mono, monospace", width: "24px" }}>#{idx + 1}</span>
                <span className="mini-avatar" style={{ "--tag": r.color, width: "24px", height: "24px", fontSize: "11px" }}>{r.initials}</span>
                <b style={{ color: r.color, fontSize: "13px" }}>{r.name}</b>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "12px", color: "#94a3b8", fontFamily: "Geist Mono, monospace" }}>{r.metDays}/{r.totalDays} days</span>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "10px", background: `${r.gradeColor}18`, border: `1px solid ${r.gradeColor}40`, color: r.gradeColor, fontWeight: "900", fontSize: "14px", fontFamily: "Geist Mono, monospace" }}>{r.grade}</span>
              </div>
            </div>
            <div style={{ height: "8px", background: "#111827", borderRadius: "99px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${r.pct}%`, background: `linear-gradient(90deg, ${r.color}, ${r.gradeColor})`, borderRadius: "inherit", transition: "width 1s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b" }}>
              <span>Daily target: {r.dailyGoal || 2}/day</span>
              <span style={{ fontWeight: "700", color: r.gradeColor }}>{r.pct}% hit rate</span>
            </div>
          </div>
        ))}
      </div>
    </CardSpotlight>
  );
}

/* ── Comeback Tracker ── */
function ComebackTracker({ friends, startDate }) {
  if (friends.length < 2) return null;

  const sorted = [...friends].sort((a, b) => (b.totalSolved || 0) - (a.totalSolved || 0));
  const leader = sorted[0];
  const leaderSolved = leader.totalSolved || 0;

  if (leaderSolved === 0) return null;

  return (
    <CardSpotlight className="panel" style={{ padding: "20px", marginTop: "18px", width: "100%" }}>
      <div className="section-head" style={{ marginBottom: "16px" }}>
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: "800", margin: 0 }}>📈 Comeback Tracker</h2>
          <p className="muted" style={{ fontSize: "12px", margin: "4px 0 0 0" }}>How far behind is everyone from the leader? Can they catch up at current pace?</p>
        </div>
        <GitGraph size={18} style={{ color: "#f97316" }} />
      </div>

      <div style={{ display: "grid", gap: "12px" }}>
        {sorted.map((f, idx) => {
          const solved = f.totalSolved || 0;
          const gap = leaderSolved - solved;
          const { dailyPace, daysPassed } = calculateEstimatedDoneDate(f, startDate);
          const leaderPace = (leader.totalSolved || 0) / Math.max(1, calculateEstimatedDoneDate(leader, startDate).daysPassed);

          let catchUpDays = Infinity;
          if (idx > 0 && dailyPace > leaderPace) {
            catchUpDays = Math.ceil(gap / (dailyPace - leaderPace));
          }

          const isLeader = idx === 0;

          return (
            <div key={f.id} style={{ padding: "14px", border: `1px solid ${isLeader ? f.color + "40" : "var(--line)"}`, borderRadius: "14px", background: isLeader ? `${f.color}08` : "rgba(2, 6, 23, 0.35)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {isLeader && <span style={{ fontSize: "14px" }}>👑</span>}
                  <span className="mini-avatar" style={{ "--tag": f.color, width: "24px", height: "24px", fontSize: "11px" }}>{f.initials}</span>
                  <b style={{ color: f.color, fontSize: "13px" }}>{f.name}</b>
                </div>
                <div style={{ display: "flex", gap: "12px", fontSize: "12px", alignItems: "center" }}>
                  {isLeader ? (
                    <span style={{ color: f.color, fontWeight: "700" }}>🏆 Leading with {solved} solved</span>
                  ) : (
                    <>
                      <span className="muted">{solved} solved</span>
                      <span style={{ color: "#ef4444", fontWeight: "700", fontFamily: "Geist Mono, monospace" }}>−{gap} behind</span>
                    </>
                  )}
                </div>
              </div>

              {!isLeader && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b" }}>
                  <span>Pace: <b style={{ color: f.color }}>{dailyPace.toFixed(1)}/d</b> vs Leader: <b style={{ color: leader.color }}>{leaderPace.toFixed(1)}/d</b></span>
                  <span style={{ fontWeight: "700", color: dailyPace > leaderPace ? "#22c55e" : "#f59e0b" }}>
                    {dailyPace > leaderPace
                      ? `🔥 Catch up in ~${catchUpDays}d`
                      : dailyPace === leaderPace
                        ? "→ Matching pace"
                        : "📉 Falling further behind"}
                  </span>
                </div>
              )}

              {/* Gap bar */}
              {!isLeader && (
                <div style={{ marginTop: "8px", height: "6px", background: "#111827", borderRadius: "99px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (solved / leaderSolved) * 100)}%`, background: f.color, borderRadius: "inherit", transition: "width 0.8s ease" }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </CardSpotlight>
  );
}

/* ── Who's Winning Summary Banner ── */
function WhoIsWinningBanner({ friends, logs, startDate }) {
  if (friends.length < 2) return null;

  // Category leaders
  const byTotal = [...friends].sort((a, b) => (b.totalSolved || 0) - (a.totalSolved || 0));
  const byStreak = [...friends].sort((a, b) => (b.streak || 0) - (a.streak || 0));

  const getWeekSolves = (f) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return logs
      .filter((l) => l.user_id === f.id && new Date(l.log_date) >= sevenDaysAgo)
      .reduce((sum, l) => sum + Number(l.count || 0), 0);
  };

  const weekData = friends.map((f) => ({ ...f, weekSolves: getWeekSolves(f) }));
  const byWeek = [...weekData].sort((a, b) => b.weekSolves - a.weekSolves);

  const paceData = friends.map((f) => {
    const { dailyPace } = calculateEstimatedDoneDate(f, startDate);
    return { ...f, dailyPace };
  });
  const byPace = [...paceData].sort((a, b) => b.dailyPace - a.dailyPace);

  // Calculate overall score: 3pt for 1st, 2pt for 2nd, 1pt for 3rd in each category
  const scores = {};
  friends.forEach((f) => { scores[f.id] = { friend: f, pts: 0, golds: 0 }; });

  [byTotal, byStreak, byWeek, byPace].forEach((ranking) => {
    ranking.forEach((f, idx) => {
      const pts = Math.max(0, friends.length - idx);
      scores[f.id].pts += pts;
      if (idx === 0) scores[f.id].golds++;
    });
  });

  const overallRanking = Object.values(scores).sort((a, b) => b.pts - a.pts || b.golds - a.golds);
  const mvp = overallRanking[0];

  const categories = [
    { label: "Total Solved", icon: "🏆", leader: byTotal[0], value: `${byTotal[0]?.totalSolved || 0}`, color: "#fbbf24" },
    { label: "Best Streak", icon: "🔥", leader: byStreak[0], value: `${byStreak[0]?.streak || 0}d`, color: "#f97316" },
    { label: "Weekly Sprint", icon: "⚡", leader: byWeek[0], value: `${byWeek[0]?.weekSolves || 0}`, color: "#a78bfa" },
    { label: "Pace Leader", icon: "🚀", leader: byPace[0], value: `${byPace[0]?.dailyPace?.toFixed(1) || 0}/d`, color: "#38bdf8" }
  ];

  return (
    <CardSpotlight className="panel" style={{ padding: "24px", marginTop: "18px", width: "100%", background: "linear-gradient(135deg, rgba(251, 191, 36, 0.04), rgba(167, 139, 250, 0.04))" }}>
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "900", margin: "0 0 4px 0" }}>🏅 Who's Winning?</h2>
        <p className="muted" style={{ fontSize: "12px", margin: 0 }}>Overall competition standings across all categories</p>
      </div>

      {/* MVP Banner */}
      {mvp && (
        <div style={{ textAlign: "center", marginBottom: "20px", padding: "16px", background: `${mvp.friend.color}10`, border: `2px solid ${mvp.friend.color}40`, borderRadius: "16px" }}>
          <div style={{ fontSize: "32px", marginBottom: "4px" }}>👑</div>
          <div style={{ fontSize: "14px", fontWeight: "900", color: mvp.friend.color }}>{mvp.friend.name}</div>
          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>Current MVP • {mvp.pts} pts • {mvp.golds} gold{mvp.golds !== 1 ? "s" : ""}</div>
        </div>
      )}

      {/* Category leaders */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "20px" }}>
        {categories.map(({ label, icon, leader, value, color }) => (
          <div key={label} style={{ textAlign: "center", padding: "12px 8px", border: "1px solid var(--line)", borderRadius: "12px", background: "rgba(2, 6, 23, 0.35)" }}>
            <div style={{ fontSize: "20px", marginBottom: "4px" }}>{icon}</div>
            <div style={{ fontSize: "10px", color: "#64748b", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>{label}</div>
            <div style={{ fontSize: "13px", fontWeight: "800", color: leader?.color || "#fff" }}>{leader?.name || "—"}</div>
            <div style={{ fontSize: "11px", color, fontFamily: "Geist Mono, monospace", fontWeight: "700" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Points table */}
      <div style={{ border: "1px solid var(--line)", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 60px 50px", padding: "8px 14px", fontSize: "10px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--line)", background: "rgba(2, 6, 23, 0.5)" }}>
          <span>#</span><span>Contestant</span><span style={{ textAlign: "right" }}>Points</span><span style={{ textAlign: "right" }}>Golds</span>
        </div>
        {overallRanking.map((entry, idx) => (
          <div key={entry.friend.id} style={{ display: "grid", gridTemplateColumns: "40px 1fr 60px 50px", padding: "10px 14px", fontSize: "12px", alignItems: "center", borderBottom: idx < overallRanking.length - 1 ? "1px solid var(--line)" : "none", background: idx === 0 ? `${entry.friend.color}08` : "transparent" }}>
            <span style={{ fontWeight: "900", color: idx === 0 ? "#fbbf24" : idx === 1 ? "#94a3b8" : idx === 2 ? "#cd7f32" : "#475569", fontSize: "14px" }}>{idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="mini-avatar" style={{ "--tag": entry.friend.color, width: "22px", height: "22px", fontSize: "10px" }}>{entry.friend.initials}</span>
              <b style={{ color: entry.friend.color }}>{entry.friend.name}</b>
            </div>
            <span style={{ textAlign: "right", fontFamily: "Geist Mono, monospace", fontWeight: "700", color: idx === 0 ? entry.friend.color : "#94a3b8" }}>{entry.pts}</span>
            <span style={{ textAlign: "right", fontFamily: "Geist Mono, monospace", fontWeight: "700", color: "#fbbf24" }}>{entry.golds}</span>
          </div>
        ))}
      </div>
    </CardSpotlight>
  );
}

function AnimatedCounter({ value, suffix = "", className = "" }) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { duration: 1200, bounce: 0 });
  const display = useTransform(spring, (v) => `${Math.round(v).toLocaleString()}${suffix}`);
  useEffect(() => motionValue.set(value || 0), [motionValue, value]);
  return <motion.span className={className}>{display}</motion.span>;
}

function TypewriterEffect({ text }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    const id = setInterval(() => setShown((prev) => {
      const next = text.slice(0, prev.length + 1);
      if (next.length === text.length) clearInterval(id);
      return next;
    }), 55);
    return () => clearInterval(id);
  }, [text]);
  return <span>{shown}<span className="cursor">_</span></span>;
}

function BackgroundBeams() {
  return null;
}

function SparklesCore() {
  return null;
}

function Spotlight({ children, className = "" }) {
  return <div className={`spotlight ${className}`}>{children}</div>;
}

function CardSpotlight({ children, className = "", style }) {
  return <div className={`card-spotlight ${className}`} style={style}>{children}</div>;
}

function BentoGrid({ children }) {
  return <section className="bento-grid">{children}</section>;
}

function HoverEffect({ items, render }) {
  return <div className="hover-grid">{items.map((item) => render(item))}</div>;
}

function WavyBackground({ children }) {
  return <div className="wavy">{children}</div>;
}

function ProgressBar({ value, color = "#22c55e" }) {
  return <div className="progress-track"><motion.div initial={{ width: 0 }} animate={{ width: `${clamp(value, 0, 100)}%` }} transition={{ duration: 1, ease: "easeOut" }} className="progress-fill" style={{ "--bar": color }} /></div>;
}

function Skeleton({ className = "" }) {
  return <span className={`skeleton ${className}`} />;
}

function SourceIcon({ source }) {
  return <span className="source-chip" title={source || "manual"}>manual</span>;
}

function AnimatedTooltip({ friends, activeId, onSelect }) {
  return <div className="avatar-row">{friends.map((f) => <button key={f.id} onClick={() => onSelect(f.id)} className={`avatar-btn ${activeId === f.id ? "active" : ""} ${f.isYou ? "you" : ""}`} style={{ "--tag": f.color }}><span>{f.initials}</span><em>{f.isYou ? "You" : f.name}</em></button>)}</div>;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><b>{label}</b>{payload.map((p) => <span key={p.dataKey} style={{ color: p.color }}>{p.name || p.dataKey}: {p.value}</span>)}</div>;
}

function normalizeLoginShortcuts(saved) {
  return DEFAULT_LOGIN_SHORTCUTS.map((defaults, index) => {
    const item = saved?.[index] || {};
    const staleDefault = !item.email || /^Friend (One|Two|Three)$/.test(item.name || "");
    return {
      ...defaults,
      ...item,
      name: staleDefault ? defaults.name : item.name,
      email: staleDefault ? defaults.email : item.email,
      password: item.password || defaults.password,
      color: item.color || defaults.color
    };
  });
}

function LoginModal({ open, onClose, auth }) {
  const [shortcuts, setShortcuts] = useState(() => {
    const next = normalizeLoginShortcuts(loadJson(LOGIN_SHORTCUTS_KEY, DEFAULT_LOGIN_SHORTCUTS));
    saveJson(LOGIN_SHORTCUTS_KEY, next);
    return next;
  });
  const [editingShortcuts, setEditingShortcuts] = useState(false);
  const [selected, setSelected] = useState(0);
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth.supabaseConfigured) return;
    const fetchShortcuts = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from("login_shortcuts")
          .select("*")
          .order("id");
        if (fetchErr) throw fetchErr;
        if (data && data.length === 3) {
          const normalized = DEFAULT_LOGIN_SHORTCUTS.map((defaults, index) => {
            const item = data.find((d) => d.id === index) || {};
            return {
              ...defaults,
              ...item
            };
          });
          setShortcuts(normalized);
          saveJson(LOGIN_SHORTCUTS_KEY, normalized);
        }
      } catch (err) {
        console.warn("Failed to fetch shortcuts from Supabase:", err);
      }
    };
    fetchShortcuts();
  }, [auth.supabaseConfigured]);

  useEffect(() => {
    const active = shortcuts[selected];
    if (active) {
      setForm({
        email: active.email || "",
        password: active.password || active.name || ""
      });
    }
  }, [selected, shortcuts]);

  const selectFriend = (index) => {
    setSelected(index);
    setError("");
  };

  const updateShortcut = async (index, patch) => {
    setShortcuts((prev) => {
      const next = prev.map((item, i) => i === index ? { ...item, ...patch } : item);
      saveJson(LOGIN_SHORTCUTS_KEY, next);
      return next;
    });

    if (auth.supabaseConfigured) {
      try {
        await supabase
          .from("login_shortcuts")
          .update(patch)
          .eq("id", index);
      } catch (err) {
        console.warn("Failed to save shortcut to Supabase:", err);
      }
    }
  };

  const loginShortcut = async (index) => {
    const friend = shortcuts[index];
    setSelected(index);
    setError("");
    if (!friend.email || !(friend.password || friend.name)) return setError("Add an email and password on this card first.");
    setLoading(true);
    try {
      await auth.login(friend.email, friend.password || friend.name);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loginAdminDirectly = async () => {
    setError("");
    setLoading(true);
    try {
      await auth.login("admin@gmail.com", "admin");
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.email || !form.password) return setError("Email and password are required.");
    setLoading(true);
    try {
      await auth.login(form.email, form.password);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="drawer-backdrop modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="log-modal auth-modal" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}>
            <div className="section-head">
              <div>
                <h2>Pick your profile</h2>
                <p>Unlock manual logging and edit your custom tags.</p>
              </div>
              <button type="button" className="icon-btn" onClick={onClose}><X /></button>
            </div>

            {!auth.supabaseConfigured && (
              <div className="offline-banner">Supabase env vars are missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.</div>
            )}

            <div className="login-shortcuts" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", margin: "14px 0" }}>
              {shortcuts.map((friend, index) => (
                <button
                  type="button"
                  key={index}
                  onClick={() => loginShortcut(index)}
                  onFocus={() => selectFriend(index)}
                  className={`login-shortcut ${selected === index ? "active" : ""}`}
                  style={{ "--tag": friend.color, background: "rgba(2, 6, 23, 0.4)", border: selected === index ? `1px solid ${friend.color}` : "1px solid var(--line)" }}
                  disabled={loading || !auth.supabaseConfigured}
                >
                  <span className="mini-avatar" style={{ "--tag": friend.color }}>{initials(friend.name)}</span>
                  <b>{friend.name || `Friend ${index + 1}`}</b>
                  <small style={{ fontSize: "10px", opacity: 0.6 }}>{friend.email || "Add email"}</small>
                  <em>Click to login</em>
                </button>
              ))}
            </div>

            <div style={{ margin: "16px 0", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", padding: "12px 0", display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                type="button"
                className="secondary"
                onClick={loginAdminDirectly}
                disabled={loading || !auth.supabaseConfigured}
                style={{ width: "100%", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "rgba(239, 68, 68, 0.08)", borderColor: "rgba(239, 68, 68, 0.2)", color: "#fca5a5" }}
              >
                <Shield size={14} /> Access System Admin Portal
              </button>
            </div>

            <form onSubmit={submit} className="auth-form" style={{ display: "grid", gap: "12px" }}>
              <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></label>
              <label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" /></label>
              {error && <p className="error-text">{error}</p>}
              <button className="primary" disabled={loading || !auth.supabaseConfigured} style={{ height: "40px" }}>{loading ? "Opening..." : `Login as ${shortcuts[selected]?.name || "friend"}`}</button>
              <button className="secondary" type="button" onClick={() => setEditingShortcuts((v) => !v)} style={{ height: "36px" }}>{editingShortcuts ? "Done editing cards" : "Edit friend cards"}</button>
            </form>

            {editingShortcuts && (
              <div className="shortcut-editor" style={{ display: "grid", gap: "10px", marginTop: "14px", maxHeight: "180px", overflowY: "auto", paddingRight: "4px" }}>
                {shortcuts.map((friend, index) => (
                  <CardSpotlight key={index} className="shortcut-editor-card" style={{ padding: "10px" }}>
                    <label>Name<input value={friend.name} onChange={(e) => updateShortcut(index, { name: e.target.value })} /></label>
                    <label>Email<input type="email" value={friend.email} onChange={(e) => updateShortcut(index, { email: e.target.value })} /></label>
                    <label>Password<input type="text" value={friend.password || ""} onChange={(e) => updateShortcut(index, { password: e.target.value })} /></label>
                    <label>Color<input type="color" value={friend.color} onChange={(e) => updateShortcut(index, { color: e.target.value })} style={{ height: "43px", padding: "4px" }} /></label>
                  </CardSpotlight>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TodayStrip({ friends, realtimeStatus }) {
  const leader = [...friends].sort((a, b) => b.todaySolved - a.todaySolved)[0];
  return <section className="today-strip">
    <div className="today-head"><strong>Today's Solves</strong><span>Manual logs update in realtime</span></div>
    <div className="today-grid">
      {friends.map((f) => <CardSpotlight key={f.id} className={`today-card ${leader?.id === f.id && f.todaySolved > 0 ? "leading" : ""} ${f.isYou ? "you-card" : ""}`} style={{ "--you": f.color }}>
        <div className="friend-line"><span className="mini-avatar" style={{ "--tag": f.color }}>{f.initials}</span><b>{f.isYou ? "You" : f.name}</b>{leader?.id === f.id && f.todaySolved > 0 && <Flame className="fire-icon" />}</div>
        <div className="today-number">{f.loading ? <Skeleton className="skeleton-small" /> : <AnimatedCounter value={f.todaySolved} />}</div>
        <p className="muted">{f.todaySolved} problems solved today</p>
      </CardSpotlight>)}
    </div>
  </section>;
}

function Hero({ friends, activeId, setActiveId }) {
  const ranked = rankFriends(friends);
  return <WavyBackground>
    <section className="hero">
      <div>
        <div className="eyebrow"><Sparkles size={15} /> Shared dashboard</div>
        <h1><TypewriterEffect text="Who's grinding hardest?" /></h1>
      </div>
    </section>
    <div className="leader-strip">
      <div className="rank-bars">
        {ranked.map((f, i) => <button key={f.id} onClick={() => setActiveId(f.id)} className="rank-row">
          <span>#{i + 1}</span><b style={{ color: f.color }}>{f.isYou ? "You" : f.name}</b><ProgressBar value={(f.totalSolved / Math.max(1, ranked[0]?.totalSolved || 1)) * 100} color={f.color} /><em>{f.loading ? "..." : f.totalSolved}</em>
        </button>)}
      </div>
    </div>
  </WavyBackground>;
}

function StatCard({ icon: Icon, label, value, suffix = "", accent, detail, loading, owner, source, className = "" }) {
  return <CardSpotlight className={`${className} ${owner?.isYou ? "you-card" : ""}`} style={{ "--you": owner?.color }}>
    {owner && <span className="owner-mini" style={{ "--tag": owner.color }}>{owner.initials}</span>}
    <div className="stat-head"><Icon size={18} style={{ color: accent }} /><span>{label}</span>{source && <SourceIcon source={source} />}</div>
    {loading ? <Skeleton className="skeleton-number" /> : <AnimatedCounter value={value} suffix={suffix} className="stat-number" />}
    {detail && <p className="muted">{detail}</p>}
  </CardSpotlight>;
}

function WeeklySummaryCard({ friend, logs }) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysPassedThisWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const offset = i - (daysPassedThisWeek - 1);
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    return d.toISOString().slice(0, 10);
  });

  const friendLogs = logs.filter((log) => log.user_id === friend.id);
  const dailyCounts = weekDays.map((dateStr) => {
    const logForDay = friendLogs.filter((log) => log.log_date === dateStr);
    return logForDay.reduce((sum, log) => sum + Number(log.count || 0), 0);
  });

  const weeklyTotal = dailyCounts.slice(0, daysPassedThisWeek).reduce((sum, count) => sum + count, 0);

  const dailyGoal = friend.dailyGoal || 2;
  const weeklyTarget = dailyGoal * daysPassedThisWeek;

  let badgeText = "";
  let badgeColor = "";
  let badgeBackground = "";

  let missedAnyDay = false;
  for (let i = 0; i < daysPassedThisWeek; i++) {
    if (dailyCounts[i] < dailyGoal) {
      missedAnyDay = true;
      break;
    }
  }

  if (weeklyTotal >= weeklyTarget && !missedAnyDay) {
    badgeText = "On Track";
    badgeColor = "#86efac";
    badgeBackground = "rgba(34,197,94,0.1)";
  } else if (missedAnyDay) {
    badgeText = "Missed Days";
    badgeColor = "#fca5a5";
    badgeBackground = "rgba(239,68,68,0.1)";
  } else {
    badgeText = "Behind";
    badgeColor = "#fde047";
    badgeBackground = "rgba(245,158,11,0.1)";
  }

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let bestDayIndex = 0;
  let maxSolved = 0;
  for (let i = 0; i < daysPassedThisWeek; i++) {
    if (dailyCounts[i] > maxSolved) {
      maxSolved = dailyCounts[i];
      bestDayIndex = i;
    }
  }

  const bestDayLabel = maxSolved > 0
    ? `Your best day: ${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][bestDayIndex]}`
    : "No solves yet this week";

  return (
    <CardSpotlight className="span-3" style={{ padding: "20px", display: "grid", gap: "10px" }}>
      <div className="stat-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Award size={18} style={{ color: friend.color }} />
          <span>Weekly Summary</span>
        </div>
        <span
          className="status-pill loaded"
          style={{
            margin: 0,
            fontSize: "11px",
            fontWeight: "700",
            background: badgeBackground,
            color: badgeColor,
            borderColor: badgeColor + "33"
          }}
        >
          {badgeText}
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px dashed var(--line)", paddingBottom: "6px" }}>
        <strong style={{ fontSize: "28px", fontWeight: "800", fontFamily: "Geist Mono, monospace" }}>
          {weeklyTotal}
        </strong>
        <span className="muted" style={{ fontSize: "11px" }}>solved this week</span>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--muted)", marginBottom: "4px" }}>
          {dayNames.map((name) => <span key={name} style={{ width: "24px", textAlign: "center" }}>{name}</span>)}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {dailyCounts.map((count, index) => {
            const hasSolved = count > 0;
            const isCompleted = count >= dailyGoal;
            let cellBg = "rgba(255,255,255,0.03)";
            let cellBorder = "1px solid var(--line)";

            if (index < daysPassedThisWeek) {
              if (isCompleted) {
                cellBg = friend.color;
                cellBorder = `1px solid ${friend.color}`;
              } else if (hasSolved) {
                cellBg = friend.color + "55";
                cellBorder = `1px solid ${friend.color}88`;
              } else {
                cellBg = "rgba(239, 68, 68, 0.08)";
                cellBorder = "1px solid rgba(239, 68, 68, 0.2)";
              }
            }

            return (
              <div
                key={index}
                title={`${dayNames[index]}: ${count} problems`}
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  background: cellBg,
                  border: cellBorder,
                  transition: "all 0.2s ease"
                }}
              />
            );
          })}
        </div>
      </div>

      <p className="muted" style={{ fontSize: "11px", fontStyle: "italic", margin: "4px 0 0 0", textAlign: "center", color: maxSolved > 0 ? "var(--green)" : "var(--muted)" }}>
        {bestDayLabel}
      </p>
    </CardSpotlight>
  );
}

function PersonalStats({ friend, friends, logs }) {
  const rank = rankFriends(friends).findIndex((f) => f.id === friend.id) + 1;
  const pie = ["easy", "medium", "hard"].map((k) => ({ name: DIFFICULTIES[k].label, value: friend[k], color: DIFFICULTIES[k].color }));
  return <BentoGrid>
    <StatCard owner={friend} source={friend.sourceIcon} icon={GitGraph} label="Total Solved" value={friend.totalSolved} accent={friend.color} loading={friend.loading} detail={`${friend.easy} easy / ${friend.medium} medium / ${friend.hard} hard`} className="span-4" />
    <StatCard owner={friend} icon={Flame} label="Current Streak" value={friend.streak} suffix="d" accent="#f97316" loading={friend.loading} detail={<span className="fire">manual log streak</span>} />
    <StatCard owner={friend} icon={Trophy} label="Friend Rank" value={rank} accent="#38bdf8" loading={friend.loading} detail={`of ${friends.length} grinders`} />
    <CardSpotlight className={`span-3 tall ${friend.isYou ? "you-card" : ""}`} style={{ "--you": friend.color }}>
      <span className="owner-mini" style={{ "--tag": friend.color }}>{friend.initials}</span>
      <div className="stat-head"><BarChart3 size={18} /><span>Difficulty Mix</span></div>
      {friend.loading ? <Skeleton className="skeleton-chart" /> : <ResponsiveContainer width="100%" height={210}>
        <PieChart><Pie data={pie} dataKey="value" innerRadius={54} outerRadius={82} paddingAngle={4}>{pie.map((p) => <Cell key={p.name} fill={p.color} />)}</Pie><Tooltip content={<ChartTooltip />} isAnimationActive={false} /></PieChart>
      </ResponsiveContainer>}
      <div className="legend">{pie.map((p) => <span key={p.name}><i style={{ background: p.color }} />{p.name}</span>)}</div>
    </CardSpotlight>
    <CardSpotlight className="span-3">
      <div className="stat-head"><Check size={18} /><span>Manual Tracking</span></div>
      <div className="goal-row"><AnimatedCounter value={friend.todaySolved} className="goal-big" /><span>today</span></div>
      <p className="muted">Add easy, medium, and hard counts from the Log button. Everything on this dashboard comes from those entries.</p>
    </CardSpotlight>
    <WeeklySummaryCard friend={friend} logs={logs} />
  </BentoGrid>;
}

function Heatmap({ friends, daysToShow, singleFriend }) {
  const weeksCount = daysToShow / 7;
  const monthHeaders = [];
  let lastMonth = "";
  for (let w = 0; w < weeksCount; w++) {
    const dayKey = todayKey((w * 7) - daysToShow + 1);
    const date = new Date(dayKey);
    const monthName = date.toLocaleDateString("en-US", { month: "short" });
    if (monthName !== lastMonth) {
      monthHeaders.push(monthName);
      lastMonth = monthName;
    } else {
      monthHeaders.push("");
    }
  }

  const displayFriends = singleFriend ? [singleFriend] : friends;

  return <section className="panel">
    <div className="section-head">
      <div><h2>Activity Heatmap</h2><p>Manual problem logs since your first activity.</p></div>
    </div>
    <div className="heatmap-stack all">
      {displayFriends.map((friend) => {
        const days = heatmapArray(friend, daysToShow);
        return <div className="heatmap-card" key={friend.id}>
          <div className="heatmap-title"><b style={{ color: friend.color }}>{friend.isYou ? "You" : friend.name}</b><span>Manual logs</span></div>
          <div className="months" style={{ display: "grid", gridTemplateColumns: `repeat(${weeksCount}, 1fr)`, minWidth: "760px", paddingLeft: "38px" }}>
            {monthHeaders.map((m, idx) => <span key={idx} style={{ fontSize: "11px", color: "#64748b" }}>{m}</span>)}
          </div>
          <div className="heatmap-wrap">
            <div className="week-labels"><span>Mon</span><span>Wed</span><span>Fri</span></div>
            <div className="heatmap-grid" style={{ gridTemplateColumns: `repeat(${weeksCount}, 12px)`, minWidth: "760px" }}>
              {days.map((d) => <div key={d.date} title={`${formatDay(d.date)} - ${d.count} problems`} className={`heat-cell level-${clamp(d.count, 0, 4)}`} />)}
            </div>
          </div>
        </div>;
      })}
    </div>
  </section>;
}

function chartSeries(friends, days = 30) {
  const points = [];
  const step = days > 90 ? 7 : days > 35 ? 3 : 1;
  for (let i = days - 1; i >= 0; i -= step) {
    const key = todayKey(-i);
    const point = { date: formatDay(key) };
    friends.forEach((f) => {
      let sum = 0;
      for (let j = 365; j >= i; j--) {
        const day = todayKey(-j);
        sum += f.heatmap?.[day] || 0;
      }
      point[f.name] = sum;
    });
    points.push(point);
  }
  return points;
}

function dailySeries(friends, days = 30) {
  return Array.from({ length: days }, (_, i) => {
    const key = todayKey(i - days + 1);
    const point = { date: formatDay(key) };
    friends.forEach((f) => (point[f.name] = mergedCount(f, key)));
    return point;
  });
}

function streakSeries(friends, days = 30) {
  return Array.from({ length: days }, (_, i) => {
    const key = todayKey(i - days + 1);
    const point = { date: formatDay(key) };
    friends.forEach((f) => {
      let streak = 0;
      for (let j = i; j >= 0; j--) {
        const day = todayKey(j - days + 1);
        if (mergedCount(f, day) > 0) streak += 1;
        else break;
      }
      point[f.name] = streak;
    });
    return point;
  });
}

function Analytics({ friends, daysToShow }) {
  const [tab, setTab] = useState("progress");
  const progress = useMemo(() => chartSeries(friends, daysToShow), [friends, daysToShow]);
  const daily = useMemo(() => dailySeries(friends, daysToShow), [friends, daysToShow]);
  const streak = useMemo(() => streakSeries(friends, daysToShow), [friends, daysToShow]);
  const breakdown = friends.map((f) => ({ name: f.name, Easy: f.easy, Medium: f.medium, Hard: f.hard }));
  return <section className="panel">
    <div className="section-head"><div><h2>Charts & Analytics</h2><p>Shared manual progress and consistency.</p></div><div className="tabs">{["progress", "daily", "difficulty", "streak"].map((t) => <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>)}</div></div>
    <div className="chart-box">
      {tab === "progress" && <ResponsiveContainer width="100%" height={330}><LineChart data={progress}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="date" stroke="#64748b" /><YAxis stroke="#64748b" /><Tooltip content={<ChartTooltip />} isAnimationActive={false} cursor={{ stroke: "rgba(255, 255, 255, 0.12)", strokeWidth: 1, strokeDasharray: "4 4" }} />{friends.map((f) => <Line key={f.id} type="monotone" dataKey={f.name} stroke={f.color} strokeWidth={3} dot={false} />)}</LineChart></ResponsiveContainer>}
      {tab === "daily" && <ResponsiveContainer width="100%" height={330}><BarChart data={daily}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="date" stroke="#64748b" interval={Math.max(1, Math.floor(daysToShow / 10))} /><YAxis stroke="#64748b" /><Tooltip content={<ChartTooltip />} isAnimationActive={false} cursor={{ fill: "rgba(255, 255, 255, 0.04)" }} />{friends.map((f) => <Bar key={f.id} dataKey={f.name} fill={f.color} radius={[4, 4, 0, 0]} />)}</BarChart></ResponsiveContainer>}
      {tab === "difficulty" && <ResponsiveContainer width="100%" height={330}><BarChart data={breakdown}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="name" stroke="#64748b" /><YAxis stroke="#64748b" /><Tooltip content={<ChartTooltip />} isAnimationActive={false} cursor={{ fill: "rgba(255, 255, 255, 0.04)" }} /><Bar dataKey="Easy" stackId="a" fill="#22c55e" /><Bar dataKey="Medium" stackId="a" fill="#f59e0b" /><Bar dataKey="Hard" stackId="a" fill="#ef4444" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>}
      {tab === "streak" && <ResponsiveContainer width="100%" height={330}><AreaChart data={streak}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="date" stroke="#64748b" interval={Math.max(1, Math.floor(daysToShow / 8))} /><YAxis stroke="#64748b" /><Tooltip content={<ChartTooltip />} isAnimationActive={false} cursor={{ stroke: "rgba(255, 255, 255, 0.12)", strokeWidth: 1, strokeDasharray: "4 4" }} />{friends.map((f) => <Area key={f.id} type="monotone" dataKey={f.name} stroke={f.color} fill={f.color} fillOpacity={0.12} />)}</AreaChart></ResponsiveContainer>}
    </div>
  </section>;
}

function groupHeatmap(logs, days = 365) {
  const heatmap = {};
  logs.forEach((log) => { heatmap[log.log_date] = (heatmap[log.log_date] || 0) + Number(log.count || 0); });
  return {
    heatmap,
    total: logs.reduce((sum, log) => sum + Number(log.count || 0), 0),
    today: heatmap[todayKey()] || 0,
    week: Array.from({ length: 7 }, (_, i) => heatmap[todayKey(-i)] || 0).reduce((sum, count) => sum + count, 0),
    streak: (() => {
      let streak = 0;
      for (let i = 0; i < days; i++) {
        if ((heatmap[todayKey(-i)] || 0) > 0) streak += 1;
        else break;
      }
      return streak;
    })()
  };
}

function calculateFines(friends, logs, finePerMiss = 5, startDateStr = "2026-05-20") {
  const start = new Date(startDateStr);
  start.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completedDates = [];
  let current = new Date(start);
  while (current < today) {
    completedDates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  const breakdown = friends.map((f) => {
    const friendLogs = logs.filter((log) => log.user_id === f.id);
    const heatmap = {};
    friendLogs.forEach((log) => {
      heatmap[log.log_date] = (heatmap[log.log_date] || 0) + Number(log.count || 0);
    });

    let missedDays = 0;
    const dailyTarget = f.dailyGoal || 2;

    completedDates.forEach((dateStr) => {
      const solved = heatmap[dateStr] || 0;
      if (solved < dailyTarget) {
        missedDays += 1;
      }
    });

    return {
      friendId: f.id,
      name: f.name,
      color: f.color,
      initials: f.initials,
      dailyGoal: dailyTarget,
      missedDays,
      grossFine: missedDays * finePerMiss
    };
  });

  const totalPool = breakdown.reduce((sum, item) => sum + item.grossFine, 0);

  return {
    totalPool,
    breakdown
  };
}

function MoneyJar({ total }) {
  const coinCount = Math.min(24, Math.max(0, Math.ceil(total / 5)));

  const coins = Array.from({ length: coinCount }, (_, index) => {
    const seed = Math.sin(index + 1) * 10000;
    const x = 22 + Math.abs(seed % 56);
    const y = 38 + Math.abs(seed * 7 % 48);
    const rotate = (seed * 11) % 360;
    const size = 11 + Math.abs(seed * 13 % 7);
    return { id: index, x, y, rotate, size };
  });

  return (
    <div className="money-jar-wrapper">
      <svg className="money-jar-svg" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="jarGlow" cx="50%" cy="60%" r="50%" fx="50%" fy="60%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {total > 0 && (
          <ellipse cx="50" cy="70" rx="35" ry="35" fill="url(#jarGlow)" filter="url(#glow)" />
        )}

        {total > 0 && (
          <path d="M 20 80 Q 50 68 80 80 L 75 96 Q 50 101 25 96 Z" fill="rgba(251, 191, 36, 0.25)" />
        )}

        <path
          d="M 36 20 
             L 64 20 
             C 64 24, 62 26, 62 30 
             C 77 38, 84 52, 84 72 
             C 84 95, 74 104, 50 104 
             C 26 104, 16 95, 16 72 
             C 16 52, 23 38, 38 30 
             C 38 26, 36 24, 36 20 Z"
          fill="none"
          stroke="rgba(255, 255, 255, 0.28)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        <rect x="33" y="14" width="34" height="6" rx="2" fill="none" stroke="rgba(255, 255, 255, 0.38)" strokeWidth="2" />
        <line x1="33" y1="17" x2="67" y2="17" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1" />

        {coins.map((coin) => (
          <g key={coin.id} transform={`translate(${coin.x}, ${coin.y}) rotate(${coin.rotate})`}>
            <circle cx="0" cy="0" r={coin.size / 2} fill="#eab308" stroke="#fef08a" strokeWidth="0.75" filter="url(#glow)" />
            <circle cx="0" cy="0" r={coin.size / 3} fill="none" stroke="#ca8a04" strokeWidth="0.5" />
            <line x1="-1" y1="-1" x2="1" y2="1" stroke="#ca8a04" strokeWidth="0.5" />
          </g>
        ))}

        <path d="M 23 52 A 22 22 0 0 1 34 36" fill="none" stroke="rgba(255, 255, 255, 0.18)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M 26 82 A 28 28 0 0 0 19 68" fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {total > 0 && <span className="jar-badge pulse-glowing">{total}</span>}
    </div>
  );
}

function MoneyBasket({ friends, logs, isAuth, isAdmin, toast, settings: propSettings, updateSettings: propUpdateSettings, finesPaid: propFinesPaid, updateFinesPaid: propUpdateFinesPaid }) {
  const [localSettings, setLocalSettings] = useState(() => {
    return loadJson("meow:fine-settings:v1", {
      finePerMiss: 5,
      startDate: "2026-05-20",
      currency: "$"
    });
  });

  const settings = propSettings || localSettings;
  const updateSettings = propUpdateSettings || ((patch) => {
    setLocalSettings((prev) => {
      const next = { ...prev, ...patch };
      saveJson("meow:fine-settings:v1", next);
      return next;
    });
  });

  const [localFinesPaid, setLocalFinesPaid] = useState(() => {
    return loadJson("meow:fines-paid:v1", {});
  });

  const finesPaid = propFinesPaid || localFinesPaid;
  const updateFinesPaid = propUpdateFinesPaid || ((nextPaid) => {
    setLocalFinesPaid(nextPaid);
    saveJson("meow:fines-paid:v1", nextPaid);
  });

  const [showSettings, setShowSettings] = useState(false);

  const recordPayment = (friendId, amount) => {
    const next = { ...finesPaid, [friendId]: (finesPaid[friendId] || 0) + amount };
    updateFinesPaid(next);
    toast("Payment recorded!");
  };

  const clearBalance = (friendId, totalDue) => {
    const next = { ...finesPaid, [friendId]: totalDue };
    updateFinesPaid(next);
    toast("Outstanding fines marked as paid!");
  };

  const resetPayments = (friendId) => {
    const next = { ...finesPaid, [friendId]: 0 };
    updateFinesPaid(next);
    toast("Payments history reset!");
  };

  const { totalPool, breakdown } = useMemo(() => {
    return calculateFines(friends, logs, Number(settings.finePerMiss) || 5, settings.startDate);
  }, [friends, logs, settings.finePerMiss, settings.startDate]);

  const adjustedBreakdown = useMemo(() => {
    return breakdown.map((item) => {
      const paid = finesPaid[item.friendId] || 0;
      const netOutstanding = Math.max(0, item.grossFine - paid);
      return {
        ...item,
        paid,
        netOutstanding
      };
    });
  }, [breakdown, finesPaid]);

  const netOutstandingPool = adjustedBreakdown.reduce((sum, item) => sum + item.netOutstanding, 0);

  return (
    <section className="panel money-basket-panel">
      <div className="section-head">
        <div>
          <h2>Fine Money Basket</h2>
          <p>Shared pool tracking fines for missed daily targets since {settings.startDate}.</p>
        </div>
        {isAuth && isAdmin && (
          <div>
            <button
              type="button"
              className="secondary mini-retry"
              onClick={() => setShowSettings(!showSettings)}
              style={{ padding: "6px 12px", fontSize: "13px", height: "30px", display: "flex", alignItems: "center", gap: "6px", width: "auto" }}
            >
              <Settings size={14} />
              Configure
            </button>
          </div>
        )}
      </div>

      {showSettings && isAuth && isAdmin && (
        <CardSpotlight className="basket-settings-card" style={{ padding: "16px", marginTop: "10px", border: "1px solid var(--line)", borderRadius: "14px", background: "rgba(2, 6, 23, 0.4)" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "700" }}>Fine Configuration</h3>
          <div className="setup-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
            <label style={{ fontSize: "12px" }}>
              Fine Amount (per miss)
              <input
                type="number"
                min="0"
                value={settings.finePerMiss}
                onChange={(e) => updateSettings({ finePerMiss: e.target.value })}
                style={{ marginTop: "4px" }}
              />
            </label>
            <label style={{ fontSize: "12px" }}>
              Fines Start Date
              <input
                type="date"
                max={todayKey()}
                value={settings.startDate}
                onChange={(e) => updateSettings({ startDate: e.target.value })}
                style={{ marginTop: "4px" }}
              />
            </label>
            <label style={{ fontSize: "12px" }}>
              Currency Symbol
              <input
                type="text"
                maxLength="3"
                value={settings.currency}
                onChange={(e) => updateSettings({ currency: e.target.value })}
                placeholder="$"
                style={{ marginTop: "4px" }}
              />
            </label>
          </div>
        </CardSpotlight>
      )}

      <div className="basket-grid" style={{ display: "grid", gridTemplateColumns: isAuth ? "repeat(auto-fit, minmax(320px, 1fr))" : "1fr", gap: "16px", marginTop: "14px" }}>
        <CardSpotlight className="basket-main-card" style={{ display: "flex", gap: "20px", alignItems: "center", padding: "20px", justifyContent: "space-between", maxWidth: isAuth ? "none" : "540px", margin: isAuth ? "0" : "0 auto", width: "100%" }}>
          <div className="basket-stats">
            <div className="stat-head" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Coins size={20} style={{ color: "#fbbf24" }} />
              <span style={{ fontSize: "14px", fontWeight: "700" }}>Pool Total Fines</span>
            </div>
            <div style={{ margin: "10px 0 4px 0", display: "flex", alignItems: "baseline", gap: "6px" }}>
              <span className="basket-amount" style={{ fontSize: "38px", fontWeight: "900", fontFamily: "Geist Mono, monospace", color: "#fbbf24" }}>
                {settings.currency}{netOutstandingPool}
              </span>
              <span className="muted" style={{ fontSize: "13px" }}>
                outstanding
              </span>
            </div>
            <p className="muted" style={{ fontSize: "12px" }}>
              Accumulated gross pool: <strong>{settings.currency}{totalPool}</strong> (Paid: {settings.currency}{totalPool - netOutstandingPool})
            </p>
            <p className="muted" style={{ fontSize: "11px", marginTop: "10px", borderTop: "1px dashed var(--line)", paddingTop: "8px" }}>
              Challenge fine is <strong>{settings.currency}{settings.finePerMiss}</strong> per player for any completed day solving fewer than their daily goal.
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <MoneyJar total={netOutstandingPool} />
          </div>
        </CardSpotlight>

        {isAuth && (
          <div className="basket-players-grid" style={{ display: "grid", gap: "10px" }}>
            {adjustedBreakdown.map((item) => (
              <CardSpotlight key={item.friendId} className="player-basket-card" style={{ "--you": item.color, display: "grid", gap: "10px", padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span className="mini-avatar" style={{ "--tag": item.color, width: "24px", height: "24px", fontSize: "11px" }}>{item.initials}</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "700" }}>{item.name}</h4>
                      <span className="muted" style={{ fontSize: "11px" }}>Target: {item.dailyGoal} / day</span>
                    </div>
                  </div>
                  <div>
                    <span className="status-pill loaded" style={{ margin: 0, fontSize: "10px", background: item.netOutstanding > 0 ? "rgba(239,68,68,0.06)" : "rgba(34,197,94,0.06)", color: item.netOutstanding > 0 ? "#fca5a5" : "#86efac", borderColor: item.netOutstanding > 0 ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)" }}>
                      {item.netOutstanding > 0 ? `${item.missedDays} missed` : "All Clear"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", padding: "8px", border: "1px solid var(--line)", borderRadius: "8px", background: "rgba(2, 6, 23, 0.4)" }}>
                  <div>
                    <span className="muted" style={{ fontSize: "10px", display: "block" }}>Gross Fines</span>
                    <strong style={{ fontSize: "13px", fontFamily: "Geist Mono, monospace", color: "var(--fg)" }}>{settings.currency}{item.grossFine}</strong>
                  </div>
                  <div>
                    <span className="muted" style={{ fontSize: "10px", display: "block" }}>Outstanding</span>
                    <strong style={{ fontSize: "13px", fontFamily: "Geist Mono, monospace", color: item.netOutstanding > 0 ? "#ef4444" : "var(--green)" }}>{settings.currency}{item.netOutstanding}</strong>
                  </div>
                </div>

                {isAuth && isAdmin && (
                  <div style={{ display: "flex", gap: "6px", marginTop: "2px" }}>
                    <button
                      type="button"
                      className="secondary mini-retry"
                      onClick={() => recordPayment(item.friendId, Number(settings.finePerMiss))}
                      disabled={item.netOutstanding <= 0}
                      style={{ fontSize: "10px", padding: "2px 6px", minWidth: "50px", height: "22px" }}
                    >
                      + {settings.currency}{settings.finePerMiss} Paid
                    </button>
                    <button
                      type="button"
                      className="secondary mini-retry"
                      onClick={() => clearBalance(item.friendId, item.grossFine)}
                      disabled={item.netOutstanding <= 0}
                      style={{ fontSize: "10px", padding: "2px 6px", minWidth: "50px", height: "22px", color: "var(--green)", borderColor: "rgba(34,197,94,0.2)" }}
                    >
                      Clear All
                    </button>
                    {item.paid > 0 && (
                      <button
                        type="button"
                        className="secondary mini-retry"
                        onClick={() => resetPayments(item.friendId)}
                        style={{ fontSize: "10px", padding: "2px 6px", minWidth: "36px", height: "22px", color: "#fca5a5", borderColor: "rgba(239,68,68,0.2)" }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                )}
              </CardSpotlight>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PersonalLogHistory({ friend, logs, onDeleteLog, toast, isAuth }) {
  const myLogs = useMemo(() => {
    return logs
      .filter((log) => log.user_id === friend.id)
      .sort((a, b) => b.log_date.localeCompare(a.log_date) || b.created_at.localeCompare(a.created_at));
  }, [logs, friend.id]);

  const handleDelete = async (id, date, count) => {
    if (!window.confirm(`Delete entry of ${count} problems on ${date}?`)) return;
    try {
      await onDeleteLog(id);
      toast("Entry deleted successfully.");
    } catch (err) {
      toast("Could not delete entry.");
    }
  };

  return (
    <section className="panel log-history-panel">
      <div className="section-head">
        <div>
          <h2>Your Recent Log Entries</h2>
          <p>Chronological history of your manual submissions. Click trash to delete.</p>
        </div>
        <Clock size={18} />
      </div>

      {!myLogs.length ? (
        <CardSpotlight className="empty-history-card" style={{ padding: "30px", border: "1px dashed var(--line)", borderRadius: "16px", display: "flex", justifyContent: "center" }}>
          <p className="muted" style={{ textAlign: "center", margin: 0, fontSize: "13px" }}>No logged entries yet. Add entries using the Log button at the bottom-right!</p>
        </CardSpotlight>
      ) : (
        <div className="log-history-list" style={{ display: "grid", gap: "10px", maxHeight: "300px", overflowY: "auto", paddingRight: "4px" }}>
          {myLogs.slice(0, 15).map((log) => {
            const total = Number(log.count) || 0;
            return (
              <div
                key={log.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  border: "1px solid var(--line)",
                  borderRadius: "12px",
                  background: "rgba(2, 6, 23, 0.4)",
                  gap: "12px"
                }}
              >
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <strong style={{ fontSize: "13px", fontFamily: "Geist Mono, monospace", color: "var(--fg)" }}>
                      {log.log_date}
                    </strong>
                    {log.note && (
                      <span className="muted" style={{ fontSize: "11px", marginTop: "1px" }}>
                        "{log.note}"
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {log.difficulty_easy > 0 && (
                      <span className="status-pill loaded" style={{ margin: 0, fontSize: "10px", background: "rgba(34,197,94,0.06)", color: "#86efac", borderColor: "rgba(34,197,94,0.2)", padding: "1px 5px" }}>
                        {log.difficulty_easy}E
                      </span>
                    )}
                    {log.difficulty_medium > 0 && (
                      <span className="status-pill loaded" style={{ margin: 0, fontSize: "10px", background: "rgba(245,158,11,0.06)", color: "#fde047", borderColor: "rgba(245,158,11,0.2)", padding: "1px 5px" }}>
                        {log.difficulty_medium}M
                      </span>
                    )}
                    {log.difficulty_hard > 0 && (
                      <span className="status-pill loaded" style={{ margin: 0, fontSize: "10px", background: "rgba(239,68,68,0.06)", color: "#fca5a5", borderColor: "rgba(239,68,68,0.2)", padding: "1px 5px" }}>
                        {log.difficulty_hard}H
                      </span>
                    )}
                    <span className="status-pill loaded" style={{ margin: 0, fontSize: "10px", fontWeight: "900", background: "rgba(255,255,255,0.06)", color: "var(--fg)", borderColor: "rgba(255,255,255,0.2)", padding: "1px 5px" }}>
                      {total} Total
                    </span>
                  </div>

                  {isAuth && (
                    <button
                      type="button"
                      className="icon-btn mini-delete"
                      onClick={() => handleDelete(log.id, log.log_date, total)}
                      style={{ padding: "4px", color: "#fca5a5", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SharedGoalsPanel({ sharedGoals, addSharedGoal, updateSharedGoal, deleteSharedGoal, friends, toast, offline, isAuth, isAdmin }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", daily_target: 4, long_term_target: 200, deadline: "", color: COLORS[1] });
  const [editingGoalId, setEditingGoalId] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingGoalId) {
        await updateSharedGoal(editingGoalId, form);
        toast("Shared challenge updated.");
      } else {
        await addSharedGoal(form);
        toast("Shared challenge created.");
      }
      setForm({ title: "", description: "", daily_target: 4, long_term_target: 200, deadline: "", color: COLORS[1] });
      setEditingGoalId(null);
      setShowForm(false);
    } catch (err) {
      setError(err.message || "Could not save challenge.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (goal) => {
    setForm({
      title: goal.title,
      description: goal.description || "",
      daily_target: goal.daily_target,
      long_term_target: goal.long_term_target,
      deadline: goal.deadline || "",
      color: goal.color || COLORS[1]
    });
    setEditingGoalId(goal.id);
    setShowForm(true);
  };

  const cancelEdit = () => {
    setForm({ title: "", description: "", daily_target: 4, long_term_target: 200, deadline: "", color: COLORS[1] });
    setEditingGoalId(null);
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this shared challenge?")) return;
    try {
      await deleteSharedGoal(id);
      toast("Shared challenge deleted.");
    } catch (err) {
      toast("Could not delete shared challenge.");
    }
  };

  const goals = sharedGoals.length ? sharedGoals : [
    {
      id: "default",
      title: "Daily Grit Challenge",
      description: "A common target set for all of us. Track your progress individually!",
      daily_target: 4,
      long_term_target: 200,
      color: COLORS[1]
    }
  ];

  return <section className="panel shared-goals">
    <div className="section-head">
      <div><h2>Shared Challenges</h2><p>Common targets that each friend strives to achieve individually.</p></div>
      {isAuth && isAdmin && <button className="primary" onClick={() => { if (showForm) cancelEdit(); else setShowForm(true); }}><Plus size={16} /> {editingGoalId ? "Cancel Edit" : "New Challenge"}</button>}
    </div>
    {offline && <div className="offline-banner">Shared challenges table is not available yet. Run the latest Supabase schema to save them.</div>}

    {showForm && isAuth && isAdmin && <form className="shared-goal-form" onSubmit={save}>
      <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", fontWeight: "700" }}>{editingGoalId ? "Edit Shared Challenge" : "Create New Shared Challenge"}</h3>
      <label>Challenge Name<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Daily 4 Problems Challenge" /></label>
      <label>Description<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description or note" /></label>
      <div className="setup-row difficulties">
        <label>Daily target (per person)<input type="number" min="0" value={form.daily_target} onChange={(e) => setForm({ ...form, daily_target: e.target.value })} /></label>
        <label>Total target (per person)<input type="number" min="0" value={form.long_term_target} onChange={(e) => setForm({ ...form, long_term_target: e.target.value })} /></label>
        <label>Deadline<input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></label>
      </div>
      <label>Theme Color<input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></label>
      {error && <p className="error-text">{error}</p>}
      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
        <button className="primary" disabled={saving}>{saving ? "Saving..." : editingGoalId ? "Save Changes" : "Create Shared Challenge"}</button>
        {editingGoalId && <button className="secondary" type="button" onClick={cancelEdit}>Cancel</button>}
      </div>
    </form>}

    <div className="shared-goal-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))" }}>
      {goals.map((goal) => {
        const calculateDaysLeft = (deadlineStr) => {
          if (!deadlineStr) return null;
          const deadline = new Date(deadlineStr);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const diffTime = deadline - today;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays;
        };
        const daysLeft = calculateDaysLeft(goal.deadline);

        return <CardSpotlight key={goal.id} className="shared-goal-card" style={{ "--you": goal.color, "--tag": goal.color, display: "grid", gap: "14px" }}>
          <div>
            <div className="stat-head"><Target size={18} style={{ color: goal.color }} /><span>Shared Target</span></div>
            <h3 style={{ margin: "6px 0 2px 0", fontSize: "20px", fontWeight: "700" }}>{goal.title}</h3>
            {goal.description && <p className="muted" style={{ fontSize: "13px", marginTop: "4px" }}>{goal.description}</p>}
            <p className="muted" style={{ fontSize: "12px", marginTop: "6px", display: "flex", gap: "10px" }}>
              <span>Target: <b>{goal.daily_target} today</b></span>
              <span>•</span>
              <span><b>{goal.long_term_target} total</b>{goal.deadline ? ` by ${goal.deadline}` : ""}</span>
            </p>
            {daysLeft !== null && (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                <span className="status-pill loaded" style={{ margin: 0, fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", background: "rgba(34,197,94,0.06)", color: "#86efac", borderColor: "rgba(34,197,94,0.2)" }}>
                  <Clock size={12} />
                  {daysLeft > 0 ? `${daysLeft} days left` : daysLeft === 0 ? "Ends today!" : "Challenge ended"}
                </span>
                {daysLeft > 0 && (
                  <span className="status-pill loaded" style={{ margin: 0, fontSize: "11px", display: "flex", alignItems: "center", gap: "5px", background: "rgba(56,189,248,0.06)", color: "#87cef8", borderColor: "rgba(56,189,248,0.2)" }}>
                    Req: {(goal.long_term_target / daysLeft).toFixed(1)}/day
                  </span>
                )}
              </div>
            )}
            {isAuth && isAdmin && goal.id !== "default" && (
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button className="secondary mini-retry" onClick={() => startEdit(goal)} style={{ fontSize: "11px", padding: "4px 8px", minWidth: "50px", height: "24px" }}>Edit</button>
                <button className="secondary mini-retry" onClick={() => handleDelete(goal.id)} style={{ fontSize: "11px", padding: "4px 8px", minWidth: "50px", height: "24px", color: "#fca5a5", borderColor: "rgba(239,68,68,0.2)" }}>Delete</button>
              </div>
            )}
          </div>

          <div className="friend-goal-progress-list" style={{ display: "grid", gap: "10px", marginTop: "4px" }}>
            {friends.map((f) => {
              const todayPct = (f.todaySolved / Math.max(1, goal.daily_target)) * 100;
              const totalPct = (f.totalSolved / Math.max(1, goal.long_term_target)) * 100;
              const remaining = Math.max(0, goal.long_term_target - f.totalSolved);
              const individualRequiredPace = (daysLeft && daysLeft > 0)
                ? (remaining / daysLeft).toFixed(1)
                : null;

              return (
                <div key={f.id} className="friend-goal-row" style={{ display: "grid", gap: "8px", padding: "10px", border: "1px solid var(--line)", borderRadius: "12px", background: "rgba(2, 6, 23, 0.4)" }}>
                  <div className="friend-line" style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span className="mini-avatar" style={{ "--tag": f.color, width: "22px", height: "22px", fontSize: "10px" }}>{f.initials}</span>
                      <b style={{ color: f.color, fontSize: "13px" }}>{f.isYou ? "You" : f.name}</b>
                    </div>
                    {remaining > 0 ? (
                      <span className="muted" style={{ fontSize: "11px", fontFamily: "Geist Mono, monospace" }}>
                        {remaining} left {individualRequiredPace && `• Req: ${individualRequiredPace}/d`}
                      </span>
                    ) : (
                      <span style={{ fontSize: "11px", color: "var(--green)", fontWeight: "800", fontFamily: "Geist Mono, monospace" }}>
                        🎉 Finished
                      </span>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "3px" }}>
                        <span>Today</span>
                        <span className="muted">{f.todaySolved}/{goal.daily_target}</span>
                      </div>
                      <ProgressBar value={todayPct} color={f.color} />
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "3px" }}>
                        <span>Total</span>
                        <span className="muted">{f.totalSolved}/{goal.long_term_target}</span>
                      </div>
                      <ProgressBar value={totalPct} color={f.color} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardSpotlight>;
      })}
    </div>
  </section>;
}

function ActivityFeed({ logs, friends, toast }) {
  const byId = Object.fromEntries(friends.map((friend) => [friend.id, friend]));
  const recent = [...logs].sort((a, b) => new Date(b.created_at || b.log_date) - new Date(a.created_at || a.log_date)).slice(0, 8);
  return <section className="panel activity-feed">
    <div className="section-head"><div><h2>Activity Feed</h2><p>Recent check-ins, notes, and quick encouragement.</p></div><Check /></div>
    {recent.length ? <div className="feed-list">
      {recent.map((log) => {
        const friend = byId[log.user_id] || {};
        return <div className="feed-item" key={log.id}>
          <span className="mini-avatar" style={{ "--tag": friend.color || COLORS[0] }}>{friend.initials || "?"}</span>
          <div><b>{friend.id ? friend.isYou ? "You" : friend.name : "Friend"} logged {log.count} problems</b><small>{formatDay(log.log_date)} • E{log.difficulty_easy} M{log.difficulty_medium} H{log.difficulty_hard}</small>{log.note && <p>{log.note}</p>}</div>
          <button className="secondary mini-retry" onClick={() => toast(`Cheered ${friend.name || "friend"} on.`)}><Sparkles size={13} /> Cheer</button>
        </div>;
      })}
    </div> : <div className="empty-chart">No manual logs yet. Add one to start the shared feed.</div>}
  </section>;
}

function ProfilesPanel({ friends, activeId, setActiveId, openSettings }) {
  return <section className="panel">
    <div className="section-head"><div><h2>Profiles</h2><p>Three friend profiles, shared stats, and your own editable setup.</p></div><Settings /></div>
    <div className="profile-grid">
      {friends.map((friend) => <CardSpotlight key={friend.id} className={`profile-card ${friend.isYou ? "you-card" : ""} ${activeId === friend.id ? "active" : ""}`} style={{ "--you": friend.color }}>
        <button className="profile-card-main" onClick={() => setActiveId(friend.id)}>
          <span className="profile-avatar" style={{ "--tag": friend.color }}>{friend.initials}</span>
          <b>{friend.isYou ? "You" : friend.name}</b>
          <small>Manual logs only</small>
        </button>
        <div className="profile-meta">
          <span><AnimatedCounter value={friend.totalSolved} /> solved</span>
          <span>{friend.streak}d streak</span>
        </div>
        {friend.isYou ? <button className="primary" onClick={openSettings}><Settings size={15} /> Edit Profile</button> : <button className="secondary" onClick={() => setActiveId(friend.id)}>View Profile</button>}
      </CardSpotlight>)}
    </div>
  </section>;
}

function BattleMode({ friends }) {
  const [a, setA] = useState(friends[0]?.id || "");
  const [b, setB] = useState(friends[1]?.id || "");
  useEffect(() => {
    if (!friends.find((f) => f.id === a)) setA(friends[0]?.id || "");
    if (!friends.find((f) => f.id === b)) setB(friends[1]?.id || friends[0]?.id || "");
  }, [friends, a, b]);
  if (friends.length < 2) return null;
  const left = friends.find((f) => f.id === a) || friends[0];
  const right = friends.find((f) => f.id === b && f.id !== left.id) || friends.find((f) => f.id !== left.id);
  const days = Array.from({ length: 7 }, (_, i) => {
    const key = todayKey(i - 6);
    return { date: key, left: mergedCount(left, key), right: mergedCount(right, key) };
  });
  const leftWins = days.filter((d) => d.left > d.right).length;
  const rightWins = days.filter((d) => d.right > d.left).length;
  return <section className="panel">
    <div className="section-head"><div><h2>Battle Mode</h2><p>Last seven days, merged source totals.</p></div><Swords /></div>
    <div className="battle-select"><Select value={left.id} onChange={setA} friends={friends} /><span>VS</span><Select value={right.id} onChange={setB} friends={friends.filter((f) => f.id !== left.id)} /></div>
    <CardSpotlight className="battle-card">
      <div className="versus"><strong style={{ color: left.color }}>{left.isYou ? "You" : left.name}</strong><b>{leftWins} - {rightWins}</b><strong style={{ color: right.color }}>{right.isYou ? "You" : right.name}</strong></div>
      <div className="mini-calendar">{days.map((d) => <div key={d.date} className={d.left === d.right ? "tie" : d.left > d.right ? "left" : "right"} title={`${formatDay(d.date)}: ${left.name} ${d.left}, ${right.name} ${d.right}`}>{d.left}:{d.right}</div>)}</div>
      <button className="primary"><Zap size={16} /> Challenge for 7 days</button>
    </CardSpotlight>
  </section>;
}

function Select({ value, onChange, friends }) {
  return <label className="select-wrap"><select value={value} onChange={(e) => onChange(e.target.value)}>{friends.map((f) => <option key={f.id} value={f.id}>{f.isYou ? "You" : f.name}</option>)}</select><ChevronDown size={16} /></label>;
}

function SettingsDrawer({ open, onClose, profile, auth, reloadFriends, toast }) {
  const [form, setForm] = useState({ display_name: "", avatar_color: COLORS[0], password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setForm({
      display_name: profile?.display_name || "",
      avatar_color: profile?.avatar_color || COLORS[0],
      password: ""
    });
  }, [open, profile]);
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await auth.updateProfile({ display_name: form.display_name.trim(), avatar_color: form.avatar_color });
      
      if (form.password.trim()) {
        const newPassword = form.password.trim();
        
        // 1. Update the password client-side using Supabase Auth (standard API, no RPC/SQL setup needed!)
        const { error: authErr } = await supabase.auth.updateUser({ password: newPassword });
        if (authErr) throw authErr;
        
        // 2. Update the password in the public.login_shortcuts database table
        const { error: dbErr } = await supabase
          .from("login_shortcuts")
          .update({ password: newPassword })
          .eq("email", auth.user.email);
        if (dbErr) console.warn("Failed to update shortcut card in database:", dbErr);

        // 3. Keep local storage shortcut card in sync immediately
        const savedShortcuts = loadJson(LOGIN_SHORTCUTS_KEY, null);
        if (savedShortcuts) {
          const updated = savedShortcuts.map((item) =>
            item.email.toLowerCase() === auth.user.email.toLowerCase()
              ? { ...item, password: newPassword }
              : item
          );
          saveJson(LOGIN_SHORTCUTS_KEY, updated);
        }
        
        toast("Saved profile and updated password!");
      } else {
        toast("Saved profile settings.");
      }

      await reloadFriends();
      onClose();
    } catch (err) {
      setError(err.message || "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };
  return <AnimatePresence>{open && <motion.div className="drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <motion.form className="drawer settings-drawer" initial={{ x: 460 }} animate={{ x: 0 }} exit={{ x: 460 }} onSubmit={save}>
      <div className="section-head"><div><h2>Edit Profile</h2><p>Customize your profile card and settings.</p></div><button type="button" className="icon-btn" onClick={onClose}><X /></button></div>
      <h3>Profile</h3>
      <label>Display name<input required value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></label>
      <label>Avatar color<input type="color" value={form.avatar_color} onChange={(e) => setForm({ ...form, avatar_color: e.target.value })} /></label>
      <label>New Password (Optional)<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Leave blank to keep current password" /></label>
      {error && <p className="error-text">{error}</p>}
      <button className="primary" disabled={saving}>{saving ? "Saving..." : "Save Settings"}</button>
    </motion.form>
  </motion.div>}</AnimatePresence>;
}

function ManualLogModal({ open, onClose, user, addLog, toast }) {
  const [form, setForm] = useState({ log_date: todayKey(), difficulty_easy: 0, difficulty_medium: 0, difficulty_hard: 0, note: "" });
  const total = Number(form.difficulty_easy || 0) + Number(form.difficulty_medium || 0) + Number(form.difficulty_hard || 0);
  const save = async (e) => {
    e.preventDefault();
    if (total <= 0) return toast("Add at least one problem.");
    await addLog({ user_id: user.id, platform: "other", ...form });
    toast(`Logged ${total} problems for ${form.log_date === todayKey() ? "today" : form.log_date}`);
    setForm({ log_date: todayKey(), difficulty_easy: 0, difficulty_medium: 0, difficulty_hard: 0, note: "" });
    onClose();
  };
  return <AnimatePresence>{open && <motion.div className="drawer-backdrop modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <motion.form className="log-modal" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} onSubmit={save}>
      <div className="section-head"><div><h2>Manual Log</h2><p>Realtime insert into Supabase manual_logs.</p></div><button type="button" className="icon-btn" onClick={onClose}><X /></button></div>
      <label>Date<input type="date" max={todayKey()} value={form.log_date} onChange={(e) => setForm({ ...form, log_date: e.target.value })} /></label>
      <div className="setup-row difficulties">{["difficulty_easy", "difficulty_medium", "difficulty_hard"].map((k) => <label key={k}>{k.replace("difficulty_", "")}<input min="0" type="number" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>)}</div>
      <label>Note<textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Solved two-sum and binary search" /></label>
      <button className="primary"><Plus size={16} /> Save Log ({total})</button>
    </motion.form>
  </motion.div>}</AnimatePresence>;
}

function Toast({ toast }) {
  return <AnimatePresence>{toast && <motion.div className="toast" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}><Check size={16} />{toast}</motion.div>}</AnimatePresence>;
}

function AdminGoalsManager({ friends, reloadFriends, toast }) {
  const [selectedUserId, setSelectedUserId] = useState(friends[0]?.id || "");
  const [form, setForm] = useState({ daily_target: 2, long_term_target: 300, deadline: "", challenge_start_date: "" });
  const [updating, setUpdating] = useState(false);
  const { updateGoal } = useGoals();

  const selectedFriend = friends.find((f) => f.id === selectedUserId);

  useEffect(() => {
    if (selectedFriend) {
      setForm({
        daily_target: selectedFriend.dailyGoal || 2,
        long_term_target: selectedFriend.longGoal || 300,
        deadline: selectedFriend.deadline || "",
        challenge_start_date: selectedFriend.challengeStartDate || ""
      });
    }
  }, [selectedFriend]);

  const save = async (e) => {
    e.preventDefault();
    if (selectedUserId && selectedUserId.startsWith("mock-")) {
      return toast(`This contestant (${selectedFriend.name}) has not registered yet. Please log in as them once using their shortcut button to activate their database profile.`);
    }
    setUpdating(true);
    try {
      await updateGoal({
        daily_target: Number(form.daily_target),
        long_term_target: Number(form.long_term_target),
        long_term_deadline: form.deadline || null,
        challenge_start_date: form.challenge_start_date || null
      }, selectedUserId);
      await reloadFriends();
      toast(`Updated goals for ${selectedFriend.name}!`);
    } catch (err) {
      toast("Could not update goals.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <CardSpotlight className="contestant-goals-manager" style={{ padding: "20px" }}>
      <div className="section-head" style={{ marginBottom: "14px" }}>
        <div>
          <h2 style={{ fontSize: "15px", fontWeight: "800", margin: 0 }}>Configure Contestant Goals</h2>
          <p className="muted" style={{ fontSize: "12px", margin: "4px 0 0 0" }}>Adjust daily, long-term targets, and deadlines for active contestants.</p>
        </div>
        <Target size={18} />
      </div>

      <form onSubmit={save} style={{ display: "grid", gap: "14px" }}>
        <label style={{ fontSize: "12px", display: "grid", gap: "6px" }}>
          Select Contestant
          <div className="select-wrap">
            <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              {friends.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <ChevronDown size={16} />
          </div>
        </label>

        <div className="setup-row difficulties" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px", alignItems: "end" }}>
          <label style={{ fontSize: "12px", display: "grid", gap: "6px" }}>
            Daily Problem Target
            <input
              type="number"
              min="0"
              value={form.daily_target}
              onChange={(e) => setForm({ ...form, daily_target: e.target.value })}
            />
          </label>
          <label style={{ fontSize: "12px", display: "grid", gap: "6px" }}>
            Long-term Total Target
            <input
              type="number"
              min="0"
              value={form.long_term_target}
              onChange={(e) => setForm({ ...form, long_term_target: e.target.value })}
            />
          </label>
          <label style={{ fontSize: "12px", display: "grid", gap: "6px" }}>
            Goal Deadline
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </label>
          <label style={{ fontSize: "12px", display: "grid", gap: "6px" }}>
            Challenge Start Date
            <input
              type="date"
              value={form.challenge_start_date}
              onChange={(e) => setForm({ ...form, challenge_start_date: e.target.value })}
            />
          </label>
        </div>

        <button className="primary" disabled={updating} style={{ height: "36px", fontSize: "12px", width: "fit-content", marginTop: "4px" }}>
          {updating ? "Saving..." : "Update Contestant Goals"}
        </button>
      </form>
    </CardSpotlight>
  );
}

function AdminProfileManager({ friends, reloadFriends, toast }) {
  const [selectedUserId, setSelectedUserId] = useState(friends[0]?.id || "");
  const [displayName, setDisplayName] = useState("");
  const [avatarColor, setAvatarColor] = useState("#38bdf8");
  const [password, setPassword] = useState("");
  const [updating, setUpdating] = useState(false);

  const selectedFriend = friends.find((f) => f.id === selectedUserId);

  useEffect(() => {
    if (selectedFriend) {
      setDisplayName(selectedFriend.name || "");
      setAvatarColor(selectedFriend.color || "#38bdf8");
      setPassword("");
    }
  }, [selectedFriend]);

  const save = async (e) => {
    e.preventDefault();
    if (selectedUserId && selectedUserId.startsWith("mock-")) {
      return toast(`This contestant (${selectedFriend.name}) has not registered yet. Please log in as them once using their shortcut button to activate their database profile.`);
    }
    if (!displayName.trim()) return toast("Display name is required.");
    setUpdating(true);
    try {
      // 1. Update Profile display name and color
      const { error } = await supabase.from("users").update({
        display_name: displayName.trim(),
        avatar_color: avatarColor
      }).eq("id", selectedUserId);
      if (error) throw error;

      // 2. Update Password if specified
      if (password.trim()) {
        const targetEmail = selectedFriend.email || (selectedFriend.display_name.toLowerCase() + "@gmail.com");
        const nextPassword = password.trim();

        // A. Update the password in public.login_shortcuts first (accessible client-side!)
        const { error: dbErr } = await supabase
          .from("login_shortcuts")
          .update({ password: nextPassword })
          .eq("email", targetEmail);
        if (dbErr) console.warn("Failed to update shortcut card in database:", dbErr);

        // B. Keep local storage shortcut card in sync immediately
        const savedShortcuts = loadJson(LOGIN_SHORTCUTS_KEY, null);
        if (savedShortcuts) {
          const updated = savedShortcuts.map((item) =>
            item.email.toLowerCase() === targetEmail.toLowerCase()
              ? { ...item, password: nextPassword }
              : item
          );
          saveJson(LOGIN_SHORTCUTS_KEY, updated);
        }

        // C. Try to update standard Supabase Auth using the change_user_password RPC
        let rpcSuccess = false;
        try {
          const { error: rpcErr } = await supabase.rpc("change_user_password", {
            target_email: targetEmail,
            new_password: nextPassword
          });
          if (!rpcErr) {
            rpcSuccess = true;
          } else {
            console.warn("RPC change_user_password failed:", rpcErr);
          }
        } catch (rpcCatch) {
          console.warn("RPC change_user_password caught error:", rpcCatch);
        }

        if (rpcSuccess) {
          toast(`Updated profile and set new password for ${displayName.trim()}!`);
        } else {
          toast(`Updated profile & shortcut card for ${displayName.trim()}! (Note: Auth password requires SQL function script to be run in Supabase)`);
        }
      } else {
        toast(`Updated profile for ${displayName.trim()}!`);
      }

      await reloadFriends();
    } catch (err) {
      toast("Could not update profile or password.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <CardSpotlight className="contestant-profile-manager" style={{ padding: "20px" }}>
      <div className="section-head" style={{ marginBottom: "14px" }}>
        <div>
          <h2 style={{ fontSize: "15px", fontWeight: "800", margin: 0 }}>Configure Contestant Profiles</h2>
          <p className="muted" style={{ fontSize: "12px", margin: "4px 0 0 0" }}>Modify display names, theme colors, and passwords of contestants directly.</p>
        </div>
        <User size={18} />
      </div>

      <form onSubmit={save} style={{ display: "grid", gap: "14px" }}>
        <label style={{ fontSize: "12px", display: "grid", gap: "6px" }}>
          Select Contestant
          <div className="select-wrap">
            <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              {friends.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <ChevronDown size={16} />
          </div>
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", alignItems: "end" }}>
          <label style={{ fontSize: "12px", display: "grid", gap: "6px" }}>
            Display Name
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label style={{ fontSize: "12px", display: "grid", gap: "6px" }}>
            Theme Color
            <input
              type="color"
              value={avatarColor}
              onChange={(e) => setAvatarColor(e.target.value)}
              style={{ width: "60px", height: "36px", padding: 0, border: "1px solid var(--line)", borderRadius: "8px", cursor: "pointer", background: "transparent" }}
            />
          </label>
        </div>

        <label style={{ fontSize: "12px", display: "grid", gap: "6px" }}>
          Reset Password (Optional)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Type a new password to reset it on the site"
          />
        </label>

        <button className="primary" disabled={updating} style={{ height: "36px", fontSize: "12px", width: "fit-content", marginTop: "4px" }}>
          {updating ? "Saving..." : "Update Contestant Profile"}
        </button>
      </form>
    </CardSpotlight>
  );
}

function AdminDashboard({ friends, reloadFriends, sharedGoals, addSharedGoal, updateSharedGoal, deleteSharedGoal, sharedGoalsOffline, toast, settings: propSettings, updateSettings: propUpdateSettings }) {
  const [localSettings, setLocalSettings] = useState(() => {
    return loadJson("meow:fine-settings:v1", {
      finePerMiss: 5,
      startDate: "2026-05-20",
      currency: "$"
    });
  });

  const settings = propSettings || localSettings;
  const updateSettings = async (patch) => {
    if (propUpdateSettings) {
      await propUpdateSettings(patch);
    } else {
      setLocalSettings((prev) => {
        const next = { ...prev, ...patch };
        saveJson("meow:fine-settings:v1", next);
        return next;
      });
    }
    toast("Fine configuration saved.");
  };

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", daily_target: 4, long_term_target: 200, deadline: "", color: COLORS[1] });
  const [editingGoalId, setEditingGoalId] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingGoalId) {
        await updateSharedGoal(editingGoalId, form);
        toast("Shared challenge updated.");
      } else {
        await addSharedGoal(form);
        toast("Shared challenge created.");
      }
      setForm({ title: "", description: "", daily_target: 4, long_term_target: 200, deadline: "", color: COLORS[1] });
      setEditingGoalId(null);
      setShowForm(false);
    } catch (err) {
      setError(err.message || "Could not save challenge.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (goal) => {
    setForm({
      title: goal.title,
      description: goal.description || "",
      daily_target: goal.daily_target,
      long_term_target: goal.long_term_target,
      deadline: goal.deadline || "",
      color: goal.color || COLORS[1]
    });
    setEditingGoalId(goal.id);
    setShowForm(true);
  };

  const cancelEdit = () => {
    setForm({ title: "", description: "", daily_target: 4, long_term_target: 200, deadline: "", color: COLORS[1] });
    setEditingGoalId(null);
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this shared challenge?")) return;
    try {
      await deleteSharedGoal(id);
      toast("Shared challenge deleted.");
    } catch (err) {
      toast("Could not delete shared challenge.");
    }
  };

  const goals = sharedGoals.length ? sharedGoals : [
    {
      id: "default",
      title: "Daily Grit Challenge",
      description: "A common target set for all of us. Track your progress individually!",
      daily_target: 4,
      long_term_target: 200,
      color: COLORS[1]
    }
  ];

  return (
    <div className="admin-dashboard" style={{ display: "grid", gap: "24px" }}>
      {/* 1. Admin Hero Banner */}
      <div className="admin-hero" style={{ padding: "28px 24px", background: "radial-gradient(circle at top right, rgba(239, 68, 68, 0.08), transparent)", borderRadius: "20px", border: "1px solid var(--line)", position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <span style={{ display: "inline-flex", padding: "6px", background: "rgba(239, 68, 68, 0.12)", borderRadius: "8px", color: "#fca5a5", border: "1px solid rgba(239, 68, 68, 0.25)" }}>
            <Shield size={18} />
          </span>
          <span className="eyebrow" style={{ textTransform: "uppercase", letterSpacing: "0.05em", color: "#fca5a5", fontSize: "11px", fontWeight: "700" }}>System Admin Portal</span>
        </div>
        <h1 style={{ fontSize: "1.8rem", fontWeight: "900", margin: "0 0 6px 0", color: "var(--fg)" }}>
          Administrative Settings
        </h1>
        <p className="muted" style={{ fontSize: "13px", maxWidth: "600px", margin: 0 }}>
          Direct configuration management. Tweak platform parameters and control shared challenges directly without any user statistics or competitor logs.
        </p>
      </div>

      {/* 2. Fine Basket Settings Editor */}
      <CardSpotlight className="basket-settings-panel" style={{ padding: "20px" }}>
        <div className="section-head" style={{ marginBottom: "14px" }}>
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: "800", margin: 0 }}>Fines & Basket Configuration</h2>
            <p className="muted" style={{ fontSize: "12px", margin: "4px 0 0 0" }}>Adjust global basket fine conditions. Updates are applied instantly to fine pool calculations.</p>
          </div>
          <Settings size={18} />
        </div>

        <div className="setup-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          <label style={{ fontSize: "12px", display: "grid", gap: "6px" }}>
            Fine Amount (per miss)
            <input
              type="number"
              min="0"
              value={settings.finePerMiss}
              onChange={(e) => updateSettings({ finePerMiss: e.target.value })}
            />
          </label>
          <label style={{ fontSize: "12px", display: "grid", gap: "6px" }}>
            Fines Start Date
            <input
              type="date"
              max={todayKey()}
              value={settings.startDate}
              onChange={(e) => updateSettings({ startDate: e.target.value })}
            />
          </label>
          <label style={{ fontSize: "12px", display: "grid", gap: "6px" }}>
            Currency Symbol
            <input
              type="text"
              maxLength="3"
              value={settings.currency}
              onChange={(e) => updateSettings({ currency: e.target.value })}
              placeholder="$"
            />
          </label>
        </div>
      </CardSpotlight>

      {/* 2.5. Contestant Goals Settings Editor */}
      <AdminGoalsManager friends={friends} reloadFriends={reloadFriends} toast={toast} />

      {/* 2.7. Contestant Profile Settings Editor */}
      <AdminProfileManager friends={friends} reloadFriends={reloadFriends} toast={toast} />

      {/* 3. Shared Challenges Manager */}
      <CardSpotlight className="shared-challenges-settings-panel" style={{ padding: "20px" }}>
        <div className="section-head" style={{ marginBottom: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: "800", margin: 0 }}>Shared Challenges Manager</h2>
            <p className="muted" style={{ fontSize: "12px", margin: "4px 0 0 0" }}>Configure, modify, or delete active contestant challenges.</p>
          </div>
          <button
            type="button"
            className="primary"
            onClick={() => { if (showForm) cancelEdit(); else setShowForm(true); }}
            style={{ height: "30px", padding: "0 12px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px", width: "auto" }}
          >
            <Plus size={14} /> {editingGoalId ? "Cancel Edit" : "New Challenge"}
          </button>
        </div>

        {sharedGoalsOffline && <div className="offline-banner" style={{ marginBottom: "12px" }}>Shared challenges table is not available yet.</div>}

        {showForm && (
          <form className="shared-goal-form" onSubmit={save} style={{ margin: "0 0 20px 0", border: "1px solid var(--line)", padding: "16px", borderRadius: "12px", background: "rgba(2, 6, 23, 0.4)", display: "grid", gap: "10px" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "700" }}>{editingGoalId ? "Edit Shared Challenge" : "Create New Shared Challenge"}</h3>
            <label style={{ fontSize: "12px", display: "grid", gap: "4px" }}>Challenge Name<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Daily 4 Problems Challenge" /></label>
            <label style={{ fontSize: "12px", display: "grid", gap: "4px" }}>Description<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description or note" /></label>
            <div className="setup-row difficulties" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              <label style={{ fontSize: "12px", display: "grid", gap: "4px" }}>Daily target (per person)<input type="number" min="0" value={form.daily_target} onChange={(e) => setForm({ ...form, daily_target: e.target.value })} /></label>
              <label style={{ fontSize: "12px", display: "grid", gap: "4px" }}>Total target (per person)<input type="number" min="0" value={form.long_term_target} onChange={(e) => setForm({ ...form, long_term_target: e.target.value })} /></label>
              <label style={{ fontSize: "12px", display: "grid", gap: "4px" }}>Deadline<input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></label>
            </div>
            <label style={{ fontSize: "12px", display: "grid", gap: "4px" }}>Theme Color<input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></label>
            {error && <p className="error-text">{error}</p>}
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button className="primary" disabled={saving} style={{ height: "32px", fontSize: "12px" }}>{saving ? "Saving..." : editingGoalId ? "Save Changes" : "Create Shared Challenge"}</button>
              {editingGoalId && <button className="secondary" type="button" onClick={cancelEdit} style={{ height: "32px", fontSize: "12px" }}>Cancel</button>}
            </div>
          </form>
        )}

        <div className="admin-goals-list" style={{ display: "grid", gap: "12px" }}>
          {goals.map((goal) => (
            <div
              key={goal.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                border: `1px solid ${goal.color}33`,
                borderRadius: "12px",
                background: "rgba(2, 6, 23, 0.4)",
                gap: "16px"
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "13px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
                  <i style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: goal.color }} />
                  {goal.title}
                </h3>
                {goal.description && <p className="muted" style={{ margin: "0 0 6px 0", fontSize: "11px" }}>{goal.description}</p>}
                <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: "#94a3b8" }}>
                  <span>Daily Target: <strong>{goal.daily_target}</strong></span>
                  <span>•</span>
                  <span>Long-term Target: <strong>{goal.long_term_target}</strong></span>
                  {goal.deadline && (
                    <>
                      <span>•</span>
                      <span>Deadline: <strong>{goal.deadline}</strong></span>
                    </>
                  )}
                </div>
              </div>

              {goal.id !== "default" && (
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    className="secondary mini-retry"
                    onClick={() => startEdit(goal)}
                    style={{ fontSize: "10px", padding: "2px 8px", height: "24px" }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="secondary mini-retry"
                    onClick={() => handleDelete(goal.id)}
                    style={{ fontSize: "10px", padding: "2px 8px", height: "24px", color: "#fca5a5", borderColor: "rgba(239,68,68,0.2)" }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardSpotlight>
    </div>
  );
}

function App() {
  const auth = useAuth();
  const { friends, reloadFriends, offline: friendsOffline } = useFriends(auth.session);
  const { logs, addLog, deleteLog, lastRealtimeLog } = useManualLogs(auth.session);
  const { updateGoal } = useGoals(auth.user || {});
  const { sharedGoals, addSharedGoal, updateSharedGoal, deleteSharedGoal, offline: sharedGoalsOffline } = useSharedGoals(auth.session, auth.user || {});
  const { stats, realtimeStatus } = useStats(friends, logs);
  const { settings, updateSettings, finesPaid, updateFinesPaid } = useGlobalSettings();
  const [activeId, setActiveId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [toast, setToast] = useState("");

  const hydratedStats = stats.map((f) => ({ ...f, isYou: f.id === auth.user?.id }));
  const currentFriend = hydratedStats.find((f) => f.id === auth.user?.id);
  const daysToShow = useMemo(() => {
    if (!logs.length) return 42; // default to 6 weeks
    const oldestDateStr = logs.reduce((oldest, log) => log.log_date < oldest ? log.log_date : oldest, todayKey());
    const oldestDate = new Date(oldestDateStr);
    const diffTime = Math.abs(new Date() - oldestDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const rawDays = Math.max(30, diffDays + 14); // show at least 30 days, or oldest log date minus 14 days
    return Math.ceil(rawDays / 7) * 7; // Round to whole weeks
  }, [logs]);

  useEffect(() => {
    if (auth.user?.id) {
      setActiveId(auth.user.id);
    }
  }, [auth.user?.id]);

  useEffect(() => {
    if (hydratedStats.length && !hydratedStats.find((f) => f.id === activeId)) {
      setActiveId(auth.user?.id || hydratedStats[0].id);
    }
  }, [hydratedStats, activeId, auth.user?.id]);

  useEffect(() => {
    if (lastRealtimeLog && lastRealtimeLog.user_id !== auth.user?.id) setToast("Logged by a friend just now");
  }, [lastRealtimeLog, auth.user?.id]);

  const activeFriend = hydratedStats.find((f) => f.id === activeId) || currentFriend || hydratedStats[0];

  const toastNow = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  const handleFabClick = () => {
    if (auth.session) setLogOpen(true);
    else setLoginOpen(true);
  };

  if (auth.loading) {
    return (
      <main>
        <BackgroundBeams />
        <SparklesCore />
        <div className="auth-page" style={{ padding: "0" }}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="card-spotlight" 
            style={{ 
              width: "100%", 
              maxWidth: "380px", 
              padding: "40px 30px", 
              textAlign: "center", 
              display: "grid", 
              gap: "24px", 
              justifyItems: "center",
              borderRadius: "28px",
              background: "rgba(12, 18, 35, 0.65)",
              border: "1px solid rgba(167, 139, 250, 0.15)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 20px 80px rgba(0,0,0,0.5)"
            }}
          >
            <div aria-label="Orange hamster running in a metal wheel" role="img" className="wheel-and-hamster" style={{ marginBottom: "10px" }}>
              <div className="wheel"></div>
              <div className="hamster">
                <div className="hamster__body">
                  <div className="hamster__head">
                    <div className="hamster__ear"></div>
                    <div className="hamster__eye"></div>
                    <div className="hamster__nose"></div>
                  </div>
                  <div className="hamster__limb hamster__limb--fr"></div>
                  <div className="hamster__limb hamster__limb--fl"></div>
                  <div className="hamster__limb hamster__limb--br"></div>
                  <div className="hamster__limb hamster__limb--bl"></div>
                  <div className="hamster__tail"></div>
                </div>
              </div>
              <div className="spoke"></div>
            </div>

            <div style={{ display: "grid", gap: "8px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "900", color: "#f3f4f6", margin: 0, letterSpacing: "-0.01em" }}>
                Meow
              </h2>
              <p className="muted" style={{ fontSize: "13px", margin: 0, minHeight: "20px" }}>
                <TypewriterEffect text="Fetching catnip and stats..." />
              </p>
            </div>

            {/* Micro loading progress line */}
            <div style={{ width: "120px", height: "4px", background: "rgba(148, 163, 184, 0.1)", borderRadius: "99px", overflow: "hidden" }}>
              <motion.div 
                animate={{ x: [-120, 120] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                style={{ 
                  width: "60px", 
                  height: "100%", 
                  background: "linear-gradient(90deg, #38bdf8, #a78bfa)", 
                  borderRadius: "inherit" 
                }}
              />
            </div>
          </motion.div>
        </div>
      </main>
    );
  }

  return <main>
    <BackgroundBeams />
    <SparklesCore />
    <nav className="top-nav">
      <a className="logo" href="#top"><span className="cat-logo"><Cat size={18} /></span> Meow</a>

      {auth.session ? (
        <div className="profile-actions">
          {auth.isAdmin ? (
            <span className="profile-pill admin-pill" style={{ cursor: "default", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "100px", fontSize: "13px" }}>
              <Shield size={14} /> System Admin
            </span>
          ) : (
            <button className="profile-pill" onClick={() => setSettingsOpen(true)}>
              <span className="mini-avatar" style={{ "--tag": auth.profile?.avatar_color || COLORS[0] }}>
                {initials(auth.profile?.display_name)}
              </span>
              {auth.profile?.display_name || "You"}
            </button>
          )}
          <button type="button" className="icon-btn" onClick={() => auth.logout()} style={{ zIndex: 100, position: "relative" }}><LogOut /></button>
        </div>
      ) : (
        <div className="profile-actions">
          <button className="primary" onClick={() => setLoginOpen(true)} style={{ display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 12px", fontSize: "13px", width: "auto" }}>
            <Lock size={14} /> Login
          </button>
        </div>
      )}
    </nav>

    <div id="top" className="page">
      {(auth.offline || friendsOffline) && <div className="offline-banner">Offline mode: showing local cached dashboard data.</div>}

      {auth.session && auth.isAdmin ? (
        <AdminDashboard
          friends={hydratedStats}
          reloadFriends={reloadFriends}
          sharedGoals={sharedGoals}
          addSharedGoal={addSharedGoal}
          updateSharedGoal={updateSharedGoal}
          deleteSharedGoal={deleteSharedGoal}
          sharedGoalsOffline={sharedGoalsOffline}
          toast={toastNow}
          settings={settings}
          updateSettings={updateSettings}
        />
      ) : (
        <>
          <TodayStrip friends={hydratedStats} realtimeStatus={realtimeStatus} />
          <Hero friends={hydratedStats} activeId={activeId} setActiveId={setActiveId} />

          {!auth.session && (
            <>
              {/* Goal Progress Bars (full width card) - public page only */}
              <GoalProgressCard friends={hydratedStats} startDate={settings.startDate} />

              {/* Competition & Pace Leaderboard - public page only */}
              <CompetitionPacePanel friends={hydratedStats} logs={logs} startDate={settings.startDate} />

              {/* Head-to-Head Duel Cards - public page only */}
              <HeadToHeadDuels friends={hydratedStats} logs={logs} startDate={settings.startDate} />

              {/* Consistency Scoreboard - public page only */}
              <ConsistencyScoreboard friends={hydratedStats} logs={logs} startDate={settings.startDate} />

              {/* Comeback Tracker - public page only */}
              <ComebackTracker friends={hydratedStats} startDate={settings.startDate} />

              {/* Who's Winning Summary - public page only */}
              <WhoIsWinningBanner friends={hydratedStats} logs={logs} startDate={settings.startDate} />

              {/* Fines Basket Total Pool (Only pool card is shown when logged out) */}
              <MoneyBasket friends={hydratedStats} logs={logs} isAuth={false} isAdmin={false} toast={toastNow} settings={settings} updateSettings={updateSettings} finesPaid={finesPaid} updateFinesPaid={updateFinesPaid} />

              {/* All contestants heatmaps displayed together for public view */}
              <Heatmap friends={hydratedStats} daysToShow={daysToShow} />
            </>
          )}

          {auth.session && (
            <>
              {/* 1. Fine Money Basket (Common) */}
              <MoneyBasket friends={hydratedStats} logs={logs} isAuth={Boolean(auth.session)} isAdmin={auth.isAdmin} toast={toastNow} settings={settings} updateSettings={updateSettings} finesPaid={finesPaid} updateFinesPaid={updateFinesPaid} />

              {/* 2. Shared Challenges (Common) */}
              <SharedGoalsPanel sharedGoals={sharedGoals} addSharedGoal={addSharedGoal} updateSharedGoal={updateSharedGoal} deleteSharedGoal={deleteSharedGoal} friends={hydratedStats} toast={toastNow} offline={sharedGoalsOffline} isAuth={Boolean(auth.session)} isAdmin={auth.isAdmin} />
            </>
          )}

          {auth.session && (
            <>
              {/* 3. Activity Feed (Common) */}
              <ActivityFeed logs={logs} friends={hydratedStats} toast={toastNow} />

              {/* 4. Profiles Panel (Common) */}
              <ProfilesPanel friends={hydratedStats} activeId={activeId} setActiveId={setActiveId} openSettings={() => setSettingsOpen(true)} />

              {/* 5. Personal Bento Stats for Selected Player (Common) */}
              {activeFriend && <PersonalStats friend={activeFriend} friends={hydratedStats} logs={logs} />}

              {/* 7. Heatmap (Individual Selected Profile Only) */}
              {activeFriend && <Heatmap friends={hydratedStats} daysToShow={daysToShow} singleFriend={activeFriend} />}

              {/* 8. Analytics Comparison Charts (Common) */}
              {activeFriend && <Analytics friends={hydratedStats} daysToShow={daysToShow} />}
            </>
          )}

          {/* 9. Personal Logs Management (Authenticated Only) */}
          {auth.session ? (
            <div className="personal-workspace-section" style={{ marginTop: "32px", borderTop: "1px solid var(--line)", paddingTop: "24px" }}>
              <div className="section-head" style={{ marginBottom: "14px" }}>
                <div>
                  <h2>Personal Log Management: {auth.profile?.display_name}</h2>
                  <p>Chronological history of your logged entries. You can delete items here in realtime.</p>
                </div>
                <Sparkles size={20} style={{ color: auth.profile?.avatar_color || COLORS[0] }} />
              </div>

              {currentFriend && (
                <div style={{ marginTop: "14px" }}>
                  <PersonalLogHistory friend={currentFriend} logs={logs} onDeleteLog={deleteLog} toast={toastNow} isAuth={true} />
                </div>
              )}
            </div>
          ) : (
            <section className="panel public-cta-panel" style={{ marginTop: "32px" }}>
              <CardSpotlight className="public-cta-card" style={{ padding: "32px", textAlign: "center", display: "grid", gap: "16px", justifyContent: "center", border: "1px solid var(--line)" }}>
                <Lock size={32} style={{ color: "var(--fg)", margin: "0 auto" }} />
                <h2 style={{ fontSize: "20px", fontWeight: "800", margin: 0 }}>Locked Log Submissions</h2>
                <p className="muted" style={{ maxWidth: "460px", fontSize: "13px", margin: "0 auto" }}>
                  Unlock manual logging to submit your solved problems, edit your profile color/name, and delete recent entries!
                </p>
                <button className="primary" onClick={() => setLoginOpen(true)} style={{ width: "fit-content", margin: "0 auto" }}>
                  Unlock Log Panel
                </button>
              </CardSpotlight>
            </section>
          )}
        </>
      )}
    </div>

    {!auth.isAdmin && (
      <button className="fab" onClick={handleFabClick}><Plus /><span>Log</span></button>
    )}

    <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} profile={auth.profile} auth={auth} reloadFriends={reloadFriends} toast={toastNow} />
    <ManualLogModal open={logOpen} onClose={() => setLogOpen(false)} user={auth.user} addLog={addLog} toast={toastNow} />
    <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} auth={auth} />
    <Toast toast={toast} />
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);
