import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Award,
  BarChart3,
  Check,
  ChevronDown,
  Flame,
  GitGraph,
  Lock,
  LogOut,
  Medal,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Target,
  Trophy,
  UserPlus,
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
import { useAuth, useFriends, useGoals, useManualLogs, useStats } from "./hooks";
import { supabase, supabaseConfigured } from "./lib/supabase";
import { clamp, formatDay, initials, todayKey } from "./lib/platforms";
import "./styles.css";

const COLORS = ["#00ff87", "#38bdf8", "#a78bfa", "#fbbf24", "#fb7185", "#2dd4bf"];
const PLATFORMS = ["leetcode", "codeforces", "gfg"];
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

function heatmapArray(friend, platform = "all", days = 365) {
  return Array.from({ length: days }, (_, i) => {
    const key = todayKey(i - days + 1);
    const lc = friend.leetcode?.heatmap?.[key] || 0;
    const cf = friend.codeforces?.heatmap?.[key] || 0;
    const gfg = friend.gfg?.heatmap?.[key] || 0;
    const all = friend.heatmap?.[key] || lc + cf + gfg;
    const count = platform === "leetcode" ? lc : platform === "codeforces" ? cf : platform === "gfg" ? gfg : all;
    return { date: key, count, leetcode: lc, codeforces: cf, gfg };
  });
}

function mergedCount(friend, key) {
  return friend.heatmap?.[key] || 0;
}

function weekTotal(friend) {
  return Array.from({ length: 7 }, (_, i) => mergedCount(friend, todayKey(-i))).reduce((s, n) => s + n, 0);
}

function rankFriends(friends) {
  return [...friends].sort((a, b) => (b.id === b.currentUser ? 1 : 0) - (a.id === a.currentUser ? 1 : 0) || b.totalSolved - a.totalSolved);
}

function cfRankColor(rank = "") {
  const r = rank.toLowerCase();
  if (r.includes("legendary")) return "#ff0000";
  if (r.includes("grandmaster")) return "#ff3b30";
  if (r.includes("master")) return "#ff8c00";
  if (r.includes("candidate")) return "#aa00aa";
  if (r.includes("expert")) return "#0000ff";
  if (r.includes("specialist")) return "#03a89e";
  if (r.includes("pupil")) return "#008000";
  if (r.includes("newbie")) return "#808080";
  return "#94a3b8";
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
  return <div className="beams" aria-hidden="true"><span /><span /><span /></div>;
}

function SparklesCore() {
  return <div className="sparkles" aria-hidden="true">{Array.from({ length: 36 }).map((_, i) => <i key={i} style={{ "--x": `${(i * 37) % 100}%`, "--y": `${(i * 53) % 100}%`, "--d": `${(i % 7) * 0.35}s` }} />)}</div>;
}

function Spotlight({ children, className = "" }) {
  return <div className={`spotlight ${className}`}>{children}</div>;
}

function CardSpotlight({ children, className = "", style }) {
  return <motion.div whileHover={{ y: -4, rotateX: 1, rotateY: -1 }} className={`card-spotlight ${className}`} style={style}>{children}</motion.div>;
}

function BentoGrid({ children }) {
  return <section className="bento-grid">{children}</section>;
}

function HoverEffect({ items, render }) {
  return <div className="hover-grid">{items.map((item) => render(item))}</div>;
}

function WavyBackground({ children }) {
  return <div className="wavy"><div className="wave one" /><div className="wave two" />{children}</div>;
}

function ProgressBar({ value, color = "#22c55e" }) {
  return <div className="progress-track"><motion.div initial={{ width: 0 }} animate={{ width: `${clamp(value, 0, 100)}%` }} transition={{ duration: 1, ease: "easeOut" }} className="progress-fill" style={{ "--bar": color }} /></div>;
}

function Skeleton({ className = "" }) {
  return <span className={`skeleton ${className}`} />;
}

function PlatformDots({ friend }) {
  return <span className="platform-dots">{PLATFORMS.map((p) => <i key={p} className={friend[p]?.status || "idle"} title={`${p}: ${friend[p]?.status || "idle"}`} />)}</span>;
}

function SourceIcon({ source }) {
  const label = source === "sync" ? "sync" : source === "sync+manual" ? "sync + manual" : "manual";
  return <span className="source-chip" title={label}>{source === "sync" ? "↻" : source === "sync+manual" ? "↻+✎" : "✎"}</span>;
}

function AnimatedTooltip({ friends, activeId, onSelect }) {
  return <div className="avatar-row">{friends.map((f) => <button key={f.id} onClick={() => onSelect(f.id)} className={`avatar-btn ${activeId === f.id ? "active" : ""} ${f.isYou ? "you" : ""}`} style={{ "--tag": f.color }}><span>{f.initials}</span><em>{f.isYou ? "You" : f.name}</em></button>)}</div>;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><b>{label}</b>{payload.map((p) => <span key={p.dataKey} style={{ color: p.color }}>{p.name || p.dataKey}: {p.value}</span>)}</div>;
}

function LoginPage({ auth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", displayName: "", avatarColor: COLORS[0] });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.email || !form.password) return setError("Email and password are required.");
    if (mode === "signup" && !form.displayName.trim()) return setError("Display name is required.");
    setLoading(true);
    try {
      if (mode === "signup") await auth.signup(form.email, form.password, form.displayName, form.avatarColor);
      else await auth.login(form.email, form.password);
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
        <h1>Join Meow</h1>
        <p>Sign in to sync the friend group, live logs, goals, and cached platform stats.</p>
        {!auth.supabaseConfigured && <div className="offline-banner">Supabase env vars are missing. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env`.</div>}
        <form onSubmit={submit} className="auth-form">
          {mode === "signup" && <>
            <label>Display name<input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Rahul" /></label>
            <label>Avatar color<input type="color" value={form.avatarColor} onChange={(e) => setForm({ ...form, avatarColor: e.target.value })} /></label>
          </>}
          <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></label>
          <label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" /></label>
          {error && <p className="error-text">{error}</p>}
          <button className="primary" disabled={loading || !auth.supabaseConfigured}>{loading ? "Working..." : mode === "signup" ? "Create account" : "Login"}</button>
          <button className="secondary" type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Need an account?" : "Already have an account?"}</button>
          <button className="secondary" type="button" disabled={!auth.supabaseConfigured} onClick={() => auth.loginWithGoogle()}>Continue with Google</button>
        </form>
      </Spotlight>
    </div>
  </main>;
}

function OnboardingWizard({ profile, friend, openSettings }) {
  const step = !profile?.display_name ? 1 : !PLATFORMS.some((p) => friend?.platforms?.[p]?.username) ? 2 : !friend?.dailyGoal ? 3 : 0;
  if (!step) return null;
  return <section className="panel onboarding-inline">
    <div className="section-head"><div><h2>Finish Setup</h2><p>Step {step} of 3: {step === 1 ? "set display name" : step === 2 ? "add platform usernames" : "set goals"}.</p></div><button className="primary" onClick={openSettings}><Settings size={16} /> Open Settings</button></div>
    <div className="wizard-progress"><i className={step >= 1 ? "active" : ""} /><i className={step >= 2 ? "active" : ""} /><i className={step >= 3 ? "active" : ""} /></div>
  </section>;
}

function TodayStrip({ friends, refresh, realtimeStatus }) {
  const leader = [...friends].sort((a, b) => b.todaySolved - a.todaySolved)[0];
  const lastFetched = Math.max(...friends.map((f) => f.lastFetched || 0));
  const minutes = lastFetched ? Math.max(0, Math.round((Date.now() - lastFetched) / 60000)) : null;
  return <section className="today-strip">
    <div className="today-head"><strong>Today</strong><span className={`live-dot ${realtimeStatus}`}>Live</span><span>{minutes === null ? "Syncing live stats" : `Last synced ${minutes} min ago`}</span><button onClick={refresh}><RefreshCw size={15} /> Refresh</button></div>
    <div className="today-grid">
      {friends.map((f) => <CardSpotlight key={f.id} className={`today-card ${leader?.id === f.id && f.todaySolved > 0 ? "leading" : ""} ${f.isYou ? "you-card" : ""}`} style={{ "--you": f.color }}>
        <div className="friend-line"><span className="mini-avatar" style={{ "--tag": f.color }}>{f.initials}</span><b>{f.isYou ? "You" : f.name}</b><PlatformDots friend={f} />{leader?.id === f.id && f.todaySolved > 0 && <Flame className="fire-icon" />}</div>
        <div className="today-number">{f.loading ? <Skeleton className="skeleton-small" /> : <AnimatedCounter value={f.todaySolved} />}</div>
        <ProgressBar value={(f.todaySolved / Math.max(1, f.dailyGoal)) * 100} color={f.color} />
        <p className="muted">{f.todaySolved}/{f.dailyGoal} daily goal <SourceIcon source={f.sourceIcon} /></p>
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
        <div className="eyebrow"><Sparkles size={15} /> Shared live dashboard</div>
        <h1><TypewriterEffect text="Who's grinding hardest?" /></h1>
        <p>Supabase Auth, realtime logs, distributed cache refreshes, and live LeetCode, Codeforces, and GFG stats.</p>
      </div>
      <Spotlight className="king-card">
        <span>Today's King</span>
        <strong>{king?.isYou ? "You" : king?.name || "Syncing"}</strong>
        <small>{king ? `${king.todaySolved}/${king.dailyGoal} solved today` : "Add handles to begin"}</small>
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
    <div className="ticker"><div>{ranked.concat(ranked).map((f, i) => <span key={`${f.id}-${i}`} style={{ "--dot": f.color }}>{f.name}: LC {f.leetcode?.todaySolved || 0} • CF {f.codeforces?.todaySolved || 0} • GFG {f.gfg?.todaySolved || 0}</span>)}</div></div>
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

function PersonalStats({ friend, friends, retry }) {
  const rank = rankFriends(friends).findIndex((f) => f.id === friend.id) + 1;
  const goalPct = (friend.totalSolved / Math.max(1, friend.longGoal)) * 100;
  const pace = heatmapArray(friend, "all", 30).reduce((s, d) => s + d.count, 0) / 30;
  const daysLeft = pace ? Math.ceil(Math.max(friend.longGoal - friend.totalSolved, 0) / pace) : null;
  const pie = ["easy", "medium", "hard"].map((k) => ({ name: DIFFICULTIES[k].label, value: friend[k], color: DIFFICULTIES[k].color }));
  return <BentoGrid>
    <StatCard owner={friend} source={friend.sourceIcon} icon={GitGraph} label="Total Solved" value={friend.totalSolved} accent={friend.color} loading={friend.loading} detail={`${friend.easy} easy / ${friend.medium} medium / ${friend.hard} hard`} className="span-3" />
    <StatCard owner={friend} icon={Flame} label="Current Streak" value={friend.streak} suffix="d" accent="#f97316" loading={friend.loading} detail={<span className="fire">max across platforms</span>} />
    <StatCard owner={friend} icon={Trophy} label="Friend Rank" value={rank} accent="#38bdf8" loading={friend.loading} detail={`of ${friends.length} grinders`} />
    <CardSpotlight className={`span-3 tall ${friend.isYou ? "you-card" : ""}`} style={{ "--you": friend.color }}>
      <span className="owner-mini" style={{ "--tag": friend.color }}>{friend.initials}</span>
      <div className="stat-head"><BarChart3 size={18} /><span>Difficulty Mix</span></div>
      {friend.loading ? <Skeleton className="skeleton-chart" /> : <ResponsiveContainer width="100%" height={210}>
        <PieChart><Pie data={pie} dataKey="value" innerRadius={54} outerRadius={82} paddingAngle={4}>{pie.map((p) => <Cell key={p.name} fill={p.color} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart>
      </ResponsiveContainer>}
      <div className="legend">{pie.map((p) => <span key={p.name}><i style={{ background: p.color }} />{p.name}</span>)}</div>
    </CardSpotlight>
    <CardSpotlight className="span-3">
      <div className="stat-head"><Target size={18} /><span>Long-Term Goal</span></div>
      <div className="goal-row"><AnimatedCounter value={friend.totalSolved} className="goal-big" /><span>/ {friend.longGoal}</span></div>
      <ProgressBar value={goalPct} color={friend.color} />
      <div className="checkpoints"><i>25%</i><i>50%</i><i>75%</i><i>100%</i></div>
      <p className="muted">{daysLeft ? `Estimated completion in ${daysLeft} days` : "Need recent activity to estimate pace"}</p>
    </CardSpotlight>
    <CardSpotlight className="span-3">
      <div className="stat-head"><Swords size={18} /><span>Codeforces</span></div>
      <CfBadge cf={friend.codeforces} />
      <p className="muted">Max: {friend.codeforces?.maxRating || 0} • {friend.codeforces?.maxRank || "unrated"}</p>
      {Object.values(friend).some((p) => p?.status === "stale") && <p className="muted">Showing stale cache.</p>}
      <button className="retry" onClick={retry}>Force refresh</button>
    </CardSpotlight>
  </BentoGrid>;
}

function CfBadge({ cf }) {
  const color = cfRankColor(cf?.rank);
  if (cf?.status === "manual" || cf?.status === "idle") return <p className="muted">No Codeforces auto-sync configured.</p>;
  if (cf?.status === "loading") return <Skeleton className="skeleton-small" />;
  if (cf?.status === "failed") return <p className="error-text">Codeforces failed: {cf.error}</p>;
  return <div className="cf-badge" style={{ "--rank": color }}><strong>{cf.rating || "Unrated"}</strong><span>{cf.rank || "unrated"}</span></div>;
}

function Heatmap({ friends, activeId }) {
  const [mode, setMode] = useState("single");
  const [platform, setPlatform] = useState("all");
  const shown = mode === "single" ? friends.filter((f) => f.id === activeId) : friends;
  return <section className="panel">
    <div className="section-head">
      <div><h2>Activity Heatmap</h2><p>API data plus manual logs, merged without double counting.</p></div>
      <div className="toolbar-pair"><div className="segmented">{["all", ...PLATFORMS].map((p) => <button key={p} className={platform === p ? "active" : ""} onClick={() => setPlatform(p)}>{p}</button>)}</div><div className="segmented"><button className={mode === "single" ? "active" : ""} onClick={() => setMode("single")}>Single</button><button className={mode === "all" ? "active" : ""} onClick={() => setMode("all")}>All Friends</button></div></div>
    </div>
    <div className={`heatmap-stack ${mode}`}>
      {shown.map((friend) => {
        const days = heatmapArray(friend, platform);
        return <div className="heatmap-card" key={friend.id}>
          <div className="heatmap-title"><b style={{ color: friend.color }}>{friend.isYou ? "You" : friend.name}</b><span>{platform === "all" ? "All sources" : platform}</span></div>
          <div className="months">{["Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"].map((m) => <span key={m}>{m}</span>)}</div>
          <div className="heatmap-wrap">
            <div className="week-labels"><span>Mon</span><span>Wed</span><span>Fri</span></div>
            <div className="heatmap-grid">{days.map((d) => <div key={d.date} title={`${formatDay(d.date)} - ${d.count} total (LC: ${d.leetcode}, CF: ${d.codeforces}, GFG/manual: ${d.gfg})`} className={`heat-cell level-${clamp(d.count, 0, 4)}`} />)}</div>
          </div>
        </div>;
      })}
    </div>
  </section>;
}

function chartSeries(friends) {
  const points = [];
  for (let i = 364; i >= 0; i -= 7) {
    const key = todayKey(-i);
    const point = { date: formatDay(key) };
    friends.forEach((f) => {
      point[f.name] = heatmapArray(f, "all", i + 1).reduce((s, d) => s + d.count, 0);
    });
    points.push(point);
  }
  return points;
}

function dailySeries(friends) {
  return Array.from({ length: 30 }, (_, i) => {
    const key = todayKey(i - 29);
    const point = { date: formatDay(key) };
    friends.forEach((f) => (point[f.name] = mergedCount(f, key)));
    return point;
  });
}

function streakSeries(friends) {
  return Array.from({ length: 90 }, (_, i) => {
    const key = todayKey(i - 89);
    const point = { date: formatDay(key) };
    friends.forEach((f) => {
      let streak = 0;
      for (let j = i; j >= 0; j--) {
        const day = todayKey(j - 89);
        if (mergedCount(f, day) > 0) streak += 1;
        else break;
      }
      point[f.name] = streak;
    });
    return point;
  });
}

function Analytics({ friends, activeFriend }) {
  const [tab, setTab] = useState("progress");
  const progress = useMemo(() => chartSeries(friends), [friends]);
  const daily = useMemo(() => dailySeries(friends), [friends]);
  const streak = useMemo(() => streakSeries(friends), [friends]);
  const breakdown = friends.map((f) => ({ name: f.name, Easy: f.easy, Medium: f.medium, Hard: f.hard }));
  const rating = activeFriend.codeforces?.ratingHistory || [];
  return <section className="panel">
    <div className="section-head"><div><h2>Charts & Analytics</h2><p>Shared live group telemetry.</p></div><div className="tabs">{["progress", "daily", "difficulty", "streak", "rating"].map((t) => <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>)}</div></div>
    <div className="chart-box">
      {tab === "progress" && <ResponsiveContainer width="100%" height={330}><LineChart data={progress}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="date" stroke="#64748b" /><YAxis stroke="#64748b" /><Tooltip content={<ChartTooltip />} />{friends.map((f) => <Line key={f.id} type="monotone" dataKey={f.name} stroke={f.color} strokeWidth={3} dot={false} />)}</LineChart></ResponsiveContainer>}
      {tab === "daily" && <ResponsiveContainer width="100%" height={330}><BarChart data={daily}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="date" stroke="#64748b" interval={5} /><YAxis stroke="#64748b" /><Tooltip content={<ChartTooltip />} />{friends.map((f) => <Bar key={f.id} dataKey={f.name} fill={f.color} radius={[4, 4, 0, 0]} />)}</BarChart></ResponsiveContainer>}
      {tab === "difficulty" && <ResponsiveContainer width="100%" height={330}><BarChart data={breakdown}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="name" stroke="#64748b" /><YAxis stroke="#64748b" /><Tooltip content={<ChartTooltip />} /><Bar dataKey="Easy" stackId="a" fill="#22c55e" /><Bar dataKey="Medium" stackId="a" fill="#f59e0b" /><Bar dataKey="Hard" stackId="a" fill="#ef4444" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>}
      {tab === "streak" && <ResponsiveContainer width="100%" height={330}><AreaChart data={streak}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="date" stroke="#64748b" interval={12} /><YAxis stroke="#64748b" /><Tooltip content={<ChartTooltip />} />{friends.map((f) => <Area key={f.id} type="monotone" dataKey={f.name} stroke={f.color} fill={f.color} fillOpacity={0.12} />)}</AreaChart></ResponsiveContainer>}
      {tab === "rating" && (rating.length ? <ResponsiveContainer width="100%" height={330}><LineChart data={rating}><CartesianGrid stroke="#1f2937" /><XAxis dataKey="date" stroke="#64748b" /><YAxis stroke="#64748b" /><Tooltip content={<ChartTooltip />} /><Line type="monotone" dataKey="newRating" name={`${activeFriend.name} CF rating`} stroke={activeFriend.color} strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer> : <div className="empty-chart">No Codeforces rating history for {activeFriend.name} yet.</div>)}
    </div>
  </section>;
}

function GoalsPanel({ friends }) {
  return <section className="panel">
    <div className="section-head"><div><h2>Goals Panel</h2><p>Shared goals from Supabase, live via realtime.</p></div><Target /></div>
    <div className="goal-grid">{friends.map((f) => {
      const pct = (f.totalSolved / Math.max(1, f.longGoal)) * 100;
      return <CardSpotlight key={f.id} className={f.isYou ? "you-card" : ""} style={{ "--you": f.color }}>
        <div className="friend-line"><span className="mini-avatar" style={{ "--tag": f.color }}>{f.initials}</span><b>{f.isYou ? "You" : f.name}</b></div>
        <div className="today-number"><AnimatedCounter value={f.todaySolved} /></div>
        <ProgressBar value={(f.todaySolved / Math.max(1, f.dailyGoal)) * 100} color={f.color} />
        <p className="muted">{f.todaySolved}/{f.dailyGoal} today</p>
        <ProgressBar value={pct} color={f.color} />
        <p className="muted">{Math.max(0, f.longGoal - f.totalSolved)} left by {f.deadline || "no deadline"}</p>
      </CardSpotlight>;
    })}</div>
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

function SettingsDrawer({ open, onClose, user, profile, currentFriend, auth, reloadFriends, refreshPlatform, updateGoal }) {
  const [form, setForm] = useState({ display_name: "", avatar_color: COLORS[0], daily_target: 2, long_term_target: 300, long_term_deadline: "", platforms: {} });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setForm({
      display_name: profile?.display_name || "",
      avatar_color: profile?.avatar_color || COLORS[0],
      daily_target: currentFriend?.dailyGoal || 2,
      long_term_target: currentFriend?.longGoal || 300,
      long_term_deadline: currentFriend?.deadline || "",
      platforms: Object.fromEntries(PLATFORMS.map((p) => [p, {
        username: currentFriend?.platforms?.[p]?.username || "",
        auto_sync_enabled: Boolean(currentFriend?.platforms?.[p]?.auto_sync_enabled)
      }]))
    });
  }, [open, profile, currentFriend]);
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await auth.updateProfile({ display_name: form.display_name.trim(), avatar_color: form.avatar_color });
      await updateGoal({ daily_target: Number(form.daily_target) || 0, long_term_target: Number(form.long_term_target) || 0, long_term_deadline: form.long_term_deadline || null });
      for (const platform of PLATFORMS) {
        const row = form.platforms[platform];
        if (row.username.trim()) {
          await supabase.from("platform_usernames").upsert({ user_id: user.id, platform, username: row.username.trim(), auto_sync_enabled: row.auto_sync_enabled }, { onConflict: "user_id,platform" });
        } else {
          await supabase.from("platform_usernames").delete().eq("user_id", user.id).eq("platform", platform);
        }
      }
      await reloadFriends();
      onClose();
    } finally {
      setSaving(false);
    }
  };
  return <AnimatePresence>{open && <motion.div className="drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <motion.form className="drawer settings-drawer" initial={{ x: 460 }} animate={{ x: 0 }} exit={{ x: 460 }} onSubmit={save}>
      <div className="section-head"><div><h2>Settings</h2><p>Your profile, goals, usernames, and sync controls.</p></div><button type="button" className="icon-btn" onClick={onClose}><X /></button></div>
      <h3>Profile</h3>
      <label>Display name<input required value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></label>
      <label>Avatar color<input type="color" value={form.avatar_color} onChange={(e) => setForm({ ...form, avatar_color: e.target.value })} /></label>
      <h3>Platform Usernames</h3>
      {PLATFORMS.map((platform) => {
        const current = currentFriend?.[platform];
        return <CardSpotlight key={platform} className="settings-platform">
          <div className="friend-line"><b>{platform}</b><span className={`status-pill ${current?.status || "idle"}`}>{current?.status || "idle"}</span></div>
          <label>Username<input value={form.platforms[platform]?.username || ""} onChange={(e) => setForm({ ...form, platforms: { ...form.platforms, [platform]: { ...form.platforms[platform], username: e.target.value } } })} placeholder={`${platform} username`} /></label>
          <label className="toggle"><input type="checkbox" checked={Boolean(form.platforms[platform]?.auto_sync_enabled)} onChange={(e) => setForm({ ...form, platforms: { ...form.platforms, [platform]: { ...form.platforms[platform], auto_sync_enabled: e.target.checked } } })} /><span>↻</span><b>Auto-sync enabled</b><em>{current?.fetched_at ? `Last synced ${Math.round((Date.now() - new Date(current.fetched_at).getTime()) / 60000)}m ago` : "Never"}</em></label>
          <button type="button" className="secondary" onClick={() => refreshPlatform(currentFriend, platform, true)}>Force Refresh</button>
        </CardSpotlight>;
      })}
      <h3>Goals</h3>
      <label>Daily target<input type="number" min="0" value={form.daily_target} onChange={(e) => setForm({ ...form, daily_target: e.target.value })} /></label>
      <label>Long-term target<input type="number" min="0" value={form.long_term_target} onChange={(e) => setForm({ ...form, long_term_target: e.target.value })} /></label>
      <label>Deadline<input type="date" value={form.long_term_deadline || ""} onChange={(e) => setForm({ ...form, long_term_deadline: e.target.value })} /></label>
      <button className="primary" disabled={saving}>{saving ? "Saving..." : "Save Settings"}</button>
    </motion.form>
  </motion.div>}</AnimatePresence>;
}

function ManualLogModal({ open, onClose, user, addLog, toast }) {
  const [form, setForm] = useState({ platform: "leetcode", log_date: todayKey(), difficulty_easy: 0, difficulty_medium: 0, difficulty_hard: 0, note: "" });
  const total = Number(form.difficulty_easy || 0) + Number(form.difficulty_medium || 0) + Number(form.difficulty_hard || 0);
  const save = async (e) => {
    e.preventDefault();
    if (total <= 0) return toast("Add at least one problem.");
    await addLog({ user_id: user.id, ...form });
    toast(`Logged ${total} problems for ${form.log_date === todayKey() ? "today" : form.log_date} 🔥`);
    setForm({ platform: "leetcode", log_date: todayKey(), difficulty_easy: 0, difficulty_medium: 0, difficulty_hard: 0, note: "" });
    onClose();
  };
  return <AnimatePresence>{open && <motion.div className="drawer-backdrop modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <motion.form className="log-modal" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} onSubmit={save}>
      <div className="section-head"><div><h2>Manual Log</h2><p>Realtime insert into Supabase manual_logs.</p></div><button type="button" className="icon-btn" onClick={onClose}><X /></button></div>
      <label>Platform<select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>{[...PLATFORMS, "other"].map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
      <label>Date<input type="date" max={todayKey()} value={form.log_date} onChange={(e) => setForm({ ...form, log_date: e.target.value })} /></label>
      <div className="setup-row platforms">{["difficulty_easy", "difficulty_medium", "difficulty_hard"].map((k) => <label key={k}>{k.replace("difficulty_", "")}<input min="0" type="number" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>)}</div>
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
  const { stats, refreshPlatform, realtimeStatus, reloadCache } = useStats(friends, logs, auth.session);
  const [activeId, setActiveId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [toast, setToast] = useState("");

  const hydratedStats = stats.map((f) => ({ ...f, isYou: f.id === auth.user?.id }));
  const currentFriend = hydratedStats.find((f) => f.id === auth.user?.id);
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
  const forceAll = async () => {
    await Promise.allSettled(hydratedStats.flatMap((f, i) => PLATFORMS.map((p) => refreshPlatform(f, p, true, i))));
    await reloadCache();
    toastNow("Fresh sync requested.");
  };

  if (auth.loading) return <main><BackgroundBeams /><SparklesCore /><div className="auth-page"><Skeleton className="skeleton-chart" /></div></main>;
  if (!auth.session) return <LoginPage auth={auth} />;

  return <main>
    <BackgroundBeams />
    <SparklesCore />
    <nav className="top-nav">
      <a className="logo" href="#top"><span className="cat-logo">🐱</span> Meow</a>
      <AnimatedTooltip friends={hydratedStats} activeId={activeId} onSelect={setActiveId} />
      <div className="profile-actions"><button className="profile-pill" onClick={() => setSettingsOpen(true)}><span className="mini-avatar" style={{ "--tag": auth.profile?.avatar_color || COLORS[0] }}>{initials(auth.profile?.display_name)}</span>{auth.profile?.display_name || "You"}</button><button className="icon-btn" onClick={auth.logout}><LogOut /></button></div>
    </nav>
    <div id="top" className="page">
      {(auth.offline || friendsOffline) && <div className="offline-banner">Offline mode: showing local cached dashboard data.</div>}
      <OnboardingWizard profile={auth.profile} friend={currentFriend} openSettings={() => setSettingsOpen(true)} />
      <TodayStrip friends={hydratedStats} refresh={forceAll} realtimeStatus={realtimeStatus} />
      <Hero friends={hydratedStats} activeId={activeId} setActiveId={setActiveId} />
      {activeFriend && <PersonalStats friend={activeFriend} friends={hydratedStats} retry={forceAll} />}
      <Heatmap friends={hydratedStats} activeId={activeId} />
      {activeFriend && <Analytics friends={hydratedStats} activeFriend={activeFriend} />}
      <GoalsPanel friends={hydratedStats} />
      <BattleMode friends={hydratedStats} />
      {activeFriend && <Badges friend={activeFriend} friends={hydratedStats} />}
    </div>
    <button className="fab" onClick={() => setLogOpen(true)}><Plus /><span>Log</span></button>
    <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} user={auth.user} profile={auth.profile} currentFriend={currentFriend} auth={auth} reloadFriends={reloadFriends} refreshPlatform={refreshPlatform} updateGoal={updateGoal} />
    <ManualLogModal open={logOpen} onClose={() => setLogOpen(false)} user={auth.user} addLog={addLog} toast={toastNow} />
    <Toast toast={toast} />
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);
