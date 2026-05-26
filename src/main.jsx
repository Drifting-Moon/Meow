import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Award,
  BarChart3,
  Cat,
  Check,
  ChevronDown,
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
import { useAuth, useFriends, useGoals, useManualLogs, useSharedGoals, useStats } from "./hooks";
import { clamp, formatDay, initials, loadJson, saveJson, todayKey } from "./lib/platforms";
import { supabase } from "./lib/supabase";
import "./styles.css";

const COLORS = ["#00ff87", "#38bdf8", "#a78bfa", "#fbbf24", "#fb7185", "#2dd4bf"];
const LOGIN_SHORTCUTS_KEY = "meow:friend-login-shortcuts:v1";
const DEFAULT_LOGIN_SHORTCUTS = [
  { name: "Jayant", email: "jayant@gmail.com", password: "Jayant", color: COLORS[0] },
  { name: "krish", email: "krish@gmail.com", password: "krish", color: COLORS[1] },
  { name: "Arshita", email: "arshita@gmail.com", password: "Arshita", color: COLORS[2] }
];
const DIFFICULTIES = {
  easy: { label: "Easy", color: "#22c55e" },
  medium: { label: "Medium", color: "#f59e0b" },
  hard: { label: "Hard", color: "#ef4444" }
};
const BADGES = [
  { id: "first", name: "First Solve", icon: Check, test: (f) => f.totalSolved > 0 },
  { id: "three", name: "3-Day Streak", icon: Flame, test: (f) => f.streak >= 3 },
  { id: "seven", name: "7-Day Warrior", icon: Zap, test: (f) => f.streak >= 7 },
  { id: "thirty", name: "30-Day Streak", icon: Shield, test: (f) => f.streak >= 30 },
  { id: "hard10", name: "10 Hards Solved", icon: Swords, test: (f) => f.hard >= 10 },
  { id: "fifty", name: "50 Total", icon: Medal, test: (f) => f.totalSolved >= 50 },
  { id: "century", name: "Century Club", icon: Trophy, test: (f) => f.totalSolved >= 100 },
  { id: "week", name: "Top of Week", icon: Award, test: (f, friends) => weekTotal(f) === Math.max(...friends.map(weekTotal)) && f.totalSolved > 0 }
];

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
  return [...friends].sort((a, b) => Number(b.isYou) - Number(a.isYou) || b.totalSolved - a.totalSolved);
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

function LoginPage({ auth }) {
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

  // Fetch shortcuts from Supabase on mount
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

  // Keep form fields reactive when shortcuts update or selection changes
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
    // 1. Update local state immediately for lag-free typing
    setShortcuts((prev) => {
      const next = prev.map((item, i) => i === index ? { ...item, ...patch } : item);
      saveJson(LOGIN_SHORTCUTS_KEY, next);
      return next;
    });

    // 2. Persist to Supabase if configured
    if (auth.supabaseConfigured) {
      try {
        const { error: updateErr } = await supabase
          .from("login_shortcuts")
          .update(patch)
          .eq("id", index);
        if (updateErr) {
          console.warn("Supabase update error:", updateErr);
        }
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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  return <main>
    <BackgroundBeams />
    <SparklesCore />
    <div className="auth-page">
      <Spotlight className="auth-card">
        <div className="eyebrow"><Sparkles size={15} /> Meow</div>
        <h1>Pick your profile</h1>
        <p>A private dashboard to track daily problem solved counts, view consistency heatmaps, and compare weekly stats in a shared space.</p>
        {!auth.supabaseConfigured && <div className="offline-banner">Supabase env vars are missing. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env`.</div>}
        <div className="login-shortcuts">
          {shortcuts.map((friend, index) => <button type="button" key={index} onClick={() => loginShortcut(index)} onFocus={() => selectFriend(index)} className={`login-shortcut ${selected === index ? "active" : ""}`} style={{ "--tag": friend.color }} disabled={loading || !auth.supabaseConfigured}>
            <span className="mini-avatar" style={{ "--tag": friend.color }}>{initials(friend.name)}</span>
            <b>{friend.name || `Friend ${index + 1}`}</b>
            <small>{friend.email || "Add email"}</small>
            <em>Click to login</em>
          </button>)}
        </div>
        <form onSubmit={submit} className="auth-form">
          <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></label>
          <label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" /></label>
          {error && <p className="error-text">{error}</p>}
          <button className="primary" disabled={loading || !auth.supabaseConfigured}>{loading ? "Opening..." : `Login as ${shortcuts[selected]?.name || "friend"}`}</button>
          <button className="secondary" type="button" onClick={() => setEditingShortcuts((v) => !v)}>{editingShortcuts ? "Done editing cards" : "Edit friend cards"}</button>
        </form>
        {editingShortcuts && <div className="shortcut-editor">
          {shortcuts.map((friend, index) => <CardSpotlight key={index} className="shortcut-editor-card">
            <label>Name<input value={friend.name} onChange={(e) => updateShortcut(index, { name: e.target.value })} /></label>
            <label>Email<input type="email" value={friend.email} onChange={(e) => updateShortcut(index, { email: e.target.value })} /></label>
            <label>Password<input type="text" value={friend.password || ""} onChange={(e) => updateShortcut(index, { password: e.target.value })} /></label>
            <label>Color<input type="color" value={friend.color} onChange={(e) => updateShortcut(index, { color: e.target.value })} /></label>
          </CardSpotlight>)}
        </div>}
      </Spotlight>
    </div>
  </main>;
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
  const king = [...friends].sort((a, b) => b.todaySolved - a.todaySolved)[0] || friends[0];
  return <WavyBackground>
    <section className="hero">
      <div>
        <div className="eyebrow"><Sparkles size={15} /> Shared dashboard</div>
        <h1><TypewriterEffect text="Solve together. Compete daily." /></h1>
        <p>Track and compare your solved problems in realtime. Set common targets, log daily progress, and build streaks together.</p>
      </div>
      <Spotlight className="king-card">
        <span>Today's King</span>
        <strong>{king?.isYou ? "You" : king?.name || "Syncing"}</strong>
        <small>{king ? `${king.todaySolved} problems solved today` : "Add a manual log to begin"}</small>
        <Trophy className="king-trophy" />
      </Spotlight>
    </section>
    <div className="leader-strip">
      <AnimatedTooltip friends={ranked} activeId={activeId} onSelect={setActiveId} />
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

function PersonalStats({ friend, friends }) {
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
  </BentoGrid>;
}

function Heatmap({ friends, activeId, daysToShow }) {
  const [mode, setMode] = useState("single");
  const shown = mode === "single" ? friends.filter((f) => f.id === activeId) : friends;
  
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

  return <section className="panel">
    <div className="section-head">
      <div><h2>Activity Heatmap</h2><p>Manual problem logs since your first activity.</p></div>
      <div className="toolbar-pair"><div className="segmented"><button className={mode === "single" ? "active" : ""} onClick={() => setMode("single")}>Single</button><button className={mode === "all" ? "active" : ""} onClick={() => setMode("all")}>All Friends</button></div></div>
    </div>
    <div className={`heatmap-stack ${mode}`}>
      {shown.map((friend) => {
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

function SharedGoalsPanel({ sharedGoals, addSharedGoal, updateSharedGoal, deleteSharedGoal, friends, toast, offline }) {
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
      <button className="primary" onClick={() => { if (showForm) cancelEdit(); else setShowForm(true); }}><Plus size={16} /> {editingGoalId ? "Cancel Edit" : "New Challenge"}</button>
    </div>
    {offline && <div className="offline-banner">Shared challenges table is not available yet. Run the latest Supabase schema to save them.</div>}
    
    {showForm && <form className="shared-goal-form" onSubmit={save}>
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
            {goal.id !== "default" && (
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
              return (
                <div key={f.id} className="friend-goal-row" style={{ display: "grid", gap: "8px", padding: "10px", border: "1px solid var(--line)", borderRadius: "12px", background: "rgba(2, 6, 23, 0.4)" }}>
                  <div className="friend-line" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span className="mini-avatar" style={{ "--tag": f.color, width: "22px", height: "22px", fontSize: "10px" }}>{f.initials}</span>
                    <b style={{ color: f.color, fontSize: "13px" }}>{f.isYou ? "You" : f.name}</b>
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

function QuickOptions({ openSettings, openLog }) {
  return <section className="panel quick-options" style={{ padding: "16px 20px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
      <div>
        <h2 style={{ fontSize: "20px", fontWeight: "700" }}>Quick Actions</h2>
        <p className="muted" style={{ fontSize: "13px", marginTop: "2px" }}>Log daily problem solves or edit your profile settings.</p>
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <button className="primary" onClick={openLog} style={{ padding: "10px 16px", borderRadius: "10px" }}><Plus size={16} /> Add Manual Log</button>
        <button className="secondary" onClick={openSettings} style={{ padding: "10px 16px", borderRadius: "10px" }}><Settings size={16} /> Edit My Profile</button>
      </div>
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

function Badges({ friend, friends }) {
  return <section className="panel">
    <div className="section-head"><div><h2>Badges & Achievements</h2><p>{friend.isYou ? "Your" : `${friend.name}'s`} unlocked bragging rights.</p></div><Award /></div>
    <HoverEffect items={BADGES} render={(badge) => {
      const earned = badge.test(friend, friends);
      const Icon = badge.icon;
      return <CardSpotlight key={badge.id} className={`badge ${earned ? "earned" : "locked"}`}>
        {earned && <SparklesCore />}
        <Icon size={26} />
        <b>{badge.name}</b>
        <span>{earned ? "Unlocked" : <><Lock size={13} /> Locked</>}</span>
      </CardSpotlight>;
    }} />
  </section>;
}

function SettingsDrawer({ open, onClose, profile, auth, reloadFriends, toast }) {
  const [form, setForm] = useState({ display_name: "", avatar_color: COLORS[0] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setForm({
      display_name: profile?.display_name || "",
      avatar_color: profile?.avatar_color || COLORS[0]
    });
  }, [open, profile]);
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await auth.updateProfile({ display_name: form.display_name.trim(), avatar_color: form.avatar_color });
      await reloadFriends();
      toast("Saved profile settings.");
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

function App() {
  const auth = useAuth();
  const { friends, reloadFriends, offline: friendsOffline } = useFriends(auth.session);
  const { logs, addLog, lastRealtimeLog } = useManualLogs(auth.session);
  const { updateGoal } = useGoals(auth.user || {});
  const { sharedGoals, addSharedGoal, updateSharedGoal, deleteSharedGoal, offline: sharedGoalsOffline } = useSharedGoals(auth.session, auth.user || {});
  const { stats, realtimeStatus } = useStats(friends, logs);
  const [activeId, setActiveId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
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
    if (hydratedStats.length && !hydratedStats.find((f) => f.id === activeId)) setActiveId(currentFriend?.id || hydratedStats[0].id);
  }, [hydratedStats, activeId, currentFriend]);
  useEffect(() => {
    if (lastRealtimeLog && lastRealtimeLog.user_id !== auth.user?.id) setToast("Logged by a friend just now");
  }, [lastRealtimeLog, auth.user?.id]);
  const activeFriend = hydratedStats.find((f) => f.id === activeId) || currentFriend || hydratedStats[0];
  const toastNow = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };
  if (auth.loading) return <main><BackgroundBeams /><SparklesCore /><div className="auth-page"><Skeleton className="skeleton-chart" /></div></main>;
  if (!auth.session) return <LoginPage auth={auth} />;

  return <main>
    <BackgroundBeams />
    <SparklesCore />
    <nav className="top-nav">
      <a className="logo" href="#top"><span className="cat-logo"><Cat size={18} /></span> Meow</a>
      <div className="profile-actions"><button className="profile-pill" onClick={() => setSettingsOpen(true)}><span className="mini-avatar" style={{ "--tag": auth.profile?.avatar_color || COLORS[0] }}>{initials(auth.profile?.display_name)}</span>{auth.profile?.display_name || "You"}</button><button className="icon-btn" onClick={auth.logout}><LogOut /></button></div>
    </nav>
    <div id="top" className="page">
      {(auth.offline || friendsOffline) && <div className="offline-banner">Offline mode: showing local cached dashboard data.</div>}
      <TodayStrip friends={hydratedStats} realtimeStatus={realtimeStatus} />
      <Hero friends={hydratedStats} activeId={activeId} setActiveId={setActiveId} />
      <QuickOptions openSettings={() => setSettingsOpen(true)} openLog={() => setLogOpen(true)} />
      <ActivityFeed logs={logs} friends={hydratedStats} toast={toastNow} />
      <ProfilesPanel friends={hydratedStats} activeId={activeId} setActiveId={setActiveId} openSettings={() => setSettingsOpen(true)} />
      {activeFriend && <PersonalStats friend={activeFriend} friends={hydratedStats} />}
      <Heatmap friends={hydratedStats} activeId={activeId} daysToShow={daysToShow} />
      {activeFriend && <Analytics friends={hydratedStats} daysToShow={daysToShow} />}
    </div>
    <button className="fab" onClick={() => setLogOpen(true)}><Plus /><span>Log</span></button>
    <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} profile={auth.profile} auth={auth} reloadFriends={reloadFriends} toast={toastNow} />
    <ManualLogModal open={logOpen} onClose={() => setLogOpen(false)} user={auth.user} addLog={addLog} toast={toastNow} />
    <Toast toast={toast} />
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);
