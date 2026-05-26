import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigured } from "./lib/supabase";
import { CACHE_TTL, PLATFORMS, fetchPlatform, initials, loadJson, saveJson, todayKey } from "./lib/platforms";

const OFFLINE_KEY = "meow:offline-snapshot:v3";

function emptyProfile(user) {
  return {
    id: user.id,
    display_name: user.email?.split("@")[0] || "Grinder",
    avatar_color: "#00ff87"
  };
}

export function useAuth() {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(!supabaseConfigured);

  const loadProfile = useCallback(async (authUser) => {
    if (!authUser || !supabaseConfigured) return null;
    const { data, error } = await supabase.from("users").select("*").eq("id", authUser.id).maybeSingle();
    if (error) throw error;
    if (data) {
      setProfile(data);
      return data;
    }
    const fresh = emptyProfile(authUser);
    const { data: inserted, error: insertError } = await supabase.from("users").insert(fresh).select("*").single();
    if (insertError) throw insertError;
    await supabase.from("goals").insert({ user_id: authUser.id }).select("id").maybeSingle();
    setProfile(inserted);
    return inserted;
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setUser(data.session?.user || null);
      try {
        if (data.session?.user) await loadProfile(data.session.user);
      } catch {
        setOffline(true);
      } finally {
        setLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user || null);
      if (nextSession?.user) loadProfile(nextSession.user).catch(() => setOffline(true));
      else setProfile(null);
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };
  const signup = async (email, password, displayName, avatarColor) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (data.user) {
      await supabase.from("users").upsert({ id: data.user.id, display_name: displayName, avatar_color: avatarColor });
      await supabase.from("goals").upsert({ user_id: data.user.id });
    }
  };
  const loginWithGoogle = async () => supabase.auth.signInWithOAuth({ provider: "google" });
  const logout = async () => supabase.auth.signOut();
  const updateProfile = async (patch) => {
    const { data, error } = await supabase.from("users").update(patch).eq("id", user.id).select("*").single();
    if (error) throw error;
    setProfile(data);
  };

  return { session, user, profile, loading, offline, login, signup, loginWithGoogle, logout, updateProfile, supabaseConfigured };
}

export function useFriends(session) {
  const [friends, setFriends] = useState([]);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!session || !supabaseConfigured) return;
    try {
      const [usersRes, platformsRes, goalsRes] = await Promise.all([
        supabase.from("users").select("*").order("created_at"),
        supabase.from("platform_usernames").select("*"),
        supabase.from("goals").select("*")
      ]);
      if (usersRes.error || platformsRes.error || goalsRes.error) throw usersRes.error || platformsRes.error || goalsRes.error;
      const next = usersRes.data.map((u) => {
        const platformRows = platformsRes.data.filter((p) => p.user_id === u.id);
        const goal = goalsRes.data.find((g) => g.user_id === u.id) || {};
        const platforms = Object.fromEntries(PLATFORMS.map((p) => [p, platformRows.find((row) => row.platform === p) || { platform: p, username: "", auto_sync_enabled: false }]));
        return {
          id: u.id,
          name: u.display_name,
          display_name: u.display_name,
          initials: initials(u.display_name),
          color: u.avatar_color,
          avatar_color: u.avatar_color,
          platforms,
          dailyGoal: goal.daily_target ?? 2,
          longGoal: goal.long_term_target ?? 300,
          deadline: goal.long_term_deadline
        };
      });
      saveJson(OFFLINE_KEY, { friends: next });
      setFriends(next);
    } catch {
      setOffline(true);
      setFriends(loadJson(OFFLINE_KEY, { friends: [] }).friends || []);
    }
  }, [session]);

  useEffect(() => {
    load();
    if (!session || !supabaseConfigured) return undefined;
    const channel = supabase.channel("friends-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_usernames" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load, session]);

  return { friends, reloadFriends: load, offline };
}

export function useManualLogs(session) {
  const [logs, setLogs] = useState([]);
  const [lastRealtimeLog, setLastRealtimeLog] = useState(null);

  const load = useCallback(async () => {
    if (!session || !supabaseConfigured) return;
    const since = new Date();
    since.setDate(since.getDate() - 370);
    const { data, error } = await supabase.from("manual_logs").select("*").gte("log_date", since.toISOString().slice(0, 10));
    if (error) throw error;
    setLogs(data || []);
    saveJson(OFFLINE_KEY, { ...loadJson(OFFLINE_KEY, {}), logs: data || [] });
  }, [session]);

  useEffect(() => {
    load().catch(() => setLogs(loadJson(OFFLINE_KEY, { logs: [] }).logs || []));
    if (!session || !supabaseConfigured) return undefined;
    const channel = supabase.channel("manual-logs-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "manual_logs" }, (payload) => {
        setLogs((prev) => [payload.new, ...prev]);
        setLastRealtimeLog(payload.new);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "manual_logs" }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load, session]);

  const addLog = async (log) => {
    const easy = Number(log.difficulty_easy) || 0;
    const medium = Number(log.difficulty_medium) || 0;
    const hard = Number(log.difficulty_hard) || 0;
    if (easy < 0 || medium < 0 || hard < 0) throw new Error("Counts cannot be negative");
    const payload = { ...log, count: easy + medium + hard, difficulty_easy: easy, difficulty_medium: medium, difficulty_hard: hard };
    const { error } = await supabase.from("manual_logs").insert(payload);
    if (error) throw error;
  };

  return { logs, addLog, reloadLogs: load, lastRealtimeLog };
}

export function useGoals(user) {
  const updateGoal = async (patch) => {
    const { error } = await supabase.from("goals").upsert({ user_id: user.id, ...patch });
    if (error) throw error;
  };
  return { updateGoal };
}

function platformEmpty(platform, status = "idle") {
  return { platform, heatmap: {}, todaySolved: 0, totalSolved: 0, streak: 0, status };
}

function manualFor(logs, userId, platform) {
  return logs.filter((log) => log.user_id === userId && (platform ? log.platform === platform : true));
}

function mergePlatform(apiData, logs, platformRow, userId, platform) {
  const auto = Boolean(platformRow?.username && platformRow?.auto_sync_enabled);
  const usernameSetAt = platformRow?.updated_at ? new Date(platformRow.updated_at) : null;
  const relevant = manualFor(logs, userId, platform).filter((log) => {
    if (!auto) return true;
    if (!usernameSetAt) return false;
    return new Date(`${log.log_date}T00:00:00`) < usernameSetAt;
  });
  const heatmap = { ...(auto ? apiData?.heatmap || {} : {}) };
  relevant.forEach((log) => {
    heatmap[log.log_date] = (heatmap[log.log_date] || 0) + (Number(log.count) || 0);
  });
  const manualTotal = relevant.reduce((s, log) => s + (Number(log.count) || 0), 0);
  const manualEasy = relevant.reduce((s, log) => s + (Number(log.difficulty_easy) || 0), 0);
  const manualMedium = relevant.reduce((s, log) => s + (Number(log.difficulty_medium) || 0), 0);
  const manualHard = relevant.reduce((s, log) => s + (Number(log.difficulty_hard) || 0), 0);
  return {
    ...(auto ? apiData || platformEmpty(platform) : platformEmpty(platform, platformRow?.username ? "disabled" : "manual")),
    heatmap,
    todaySolved: heatmap[todayKey()] || 0,
    totalSolved: (auto ? Number(apiData?.totalSolved) || 0 : 0) + manualTotal,
    easy: (auto ? Number(apiData?.easy) || 0 : 0) + manualEasy,
    medium: (auto ? Number(apiData?.medium) || 0 : 0) + manualMedium,
    hard: (auto ? Number(apiData?.hard) || 0 : 0) + manualHard,
    sourceIcon: auto && relevant.length ? "sync+manual" : auto ? "sync" : "manual"
  };
}

export function useStats(friends, logs, session) {
  const [cacheRows, setCacheRows] = useState([]);
  const [syncing, setSyncing] = useState({});
  const [realtimeStatus, setRealtimeStatus] = useState("connecting");

  const loadCache = useCallback(async () => {
    if (!session || !supabaseConfigured) return;
    const { data, error } = await supabase.from("cached_stats").select("*");
    if (error) throw error;
    setCacheRows(data || []);
    saveJson(OFFLINE_KEY, { ...loadJson(OFFLINE_KEY, {}), cacheRows: data || [] });
  }, [session]);

  const refreshPlatform = useCallback(async (friend, platform, force = false, index = 0) => {
    const row = friend.platforms?.[platform];
    if (!session || !supabaseConfigured || !row?.username || !row.auto_sync_enabled) return;
    const cache = cacheRows.find((c) => c.user_id === friend.id && c.platform === platform);
    const fresh = cache?.fetched_at && Date.now() - new Date(cache.fetched_at).getTime() < CACHE_TTL;
    if (!force && fresh) return;
    setSyncing((prev) => ({ ...prev, [`${friend.id}:${platform}`]: true }));
    try {
      const data = await fetchPlatform(platform, row.username, index);
      const payload = { user_id: friend.id, platform, data, fetched_at: new Date().toISOString() };
      const { data: saved, error } = await supabase.from("cached_stats").upsert(payload, { onConflict: "user_id,platform" }).select("*").single();
      if (error) throw error;
      setCacheRows((prev) => [...prev.filter((c) => !(c.user_id === friend.id && c.platform === platform)), saved]);
    } finally {
      setSyncing((prev) => ({ ...prev, [`${friend.id}:${platform}`]: false }));
    }
  }, [cacheRows, session]);

  useEffect(() => {
    loadCache().catch(() => setCacheRows(loadJson(OFFLINE_KEY, { cacheRows: [] }).cacheRows || []));
  }, [loadCache]);

  useEffect(() => {
    if (!session || !supabaseConfigured) return undefined;
    const channel = supabase.channel("stats-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "cached_stats" }, loadCache)
      .subscribe((status) => setRealtimeStatus(status === "SUBSCRIBED" ? "connected" : "connecting"));
    return () => supabase.removeChannel(channel);
  }, [loadCache, session]);

  useEffect(() => {
    friends.forEach((friend, index) => {
      PLATFORMS.forEach((platform) => {
        refreshPlatform(friend, platform, false, index).catch(() => {});
      });
    });
  }, [friends, refreshPlatform]);

  const stats = useMemo(() => friends.map((friend) => {
    const platforms = Object.fromEntries(PLATFORMS.map((platform) => {
      const row = friend.platforms?.[platform];
      const cache = cacheRows.find((c) => c.user_id === friend.id && c.platform === platform);
      const stale = cache?.fetched_at ? Date.now() - new Date(cache.fetched_at).getTime() > CACHE_TTL : false;
      const syncingKey = `${friend.id}:${platform}`;
      const apiData = cache?.data ? { ...cache.data, stale, status: syncing[syncingKey] ? "loading" : stale ? "stale" : "loaded", fetched_at: cache.fetched_at } : platformEmpty(platform, row?.auto_sync_enabled ? "loading" : "manual");
      return [platform, mergePlatform(apiData, logs, row, friend.id, platform)];
    }));
    const otherLogs = manualFor(logs, friend.id, "other");
    const otherTotal = otherLogs.reduce((s, log) => s + Number(log.count || 0), 0);
    const otherToday = otherLogs.filter((log) => log.log_date === todayKey()).reduce((s, log) => s + Number(log.count || 0), 0);
    const heatmap = {};
    Object.values(platforms).forEach((p) => Object.entries(p.heatmap || {}).forEach(([key, count]) => { heatmap[key] = (heatmap[key] || 0) + count; }));
    otherLogs.forEach((log) => { heatmap[log.log_date] = (heatmap[log.log_date] || 0) + Number(log.count || 0); });
    const totalSolved = Object.values(platforms).reduce((s, p) => s + Number(p.totalSolved || 0), 0) + otherTotal;
    return {
      ...friend,
      ...platforms,
      heatmap,
      totalSolved,
      todaySolved: Object.values(platforms).reduce((s, p) => s + Number(p.todaySolved || 0), 0) + otherToday,
      easy: Object.values(platforms).reduce((s, p) => s + Number(p.easy || 0), 0) + otherLogs.reduce((s, l) => s + Number(l.difficulty_easy || 0), 0),
      medium: Object.values(platforms).reduce((s, p) => s + Number(p.medium || 0), 0) + otherLogs.reduce((s, l) => s + Number(l.difficulty_medium || 0), 0),
      hard: Object.values(platforms).reduce((s, p) => s + Number(p.hard || 0), 0) + otherLogs.reduce((s, l) => s + Number(l.difficulty_hard || 0), 0),
      streak: Math.max(...Object.values(platforms).map((p) => Number(p.streak || 0)), 0),
      loading: Object.values(platforms).some((p) => p.status === "loading"),
      sourceIcon: Object.values(platforms).some((p) => p.sourceIcon === "sync") ? "sync" : "manual",
      lastFetched: Math.max(...cacheRows.filter((c) => c.user_id === friend.id).map((c) => new Date(c.fetched_at).getTime()), 0)
    };
  }), [friends, logs, cacheRows, syncing]);

  return { stats, refreshPlatform, realtimeStatus, reloadCache: loadCache };
}
