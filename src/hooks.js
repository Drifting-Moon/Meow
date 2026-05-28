import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigured } from "./lib/supabase";
import { countStreak, initials, loadJson, saveJson, todayKey } from "./lib/platforms";

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(!supabaseConfigured);

  const loadProfile = useCallback(async (authUser) => {
    if (!authUser || !supabaseConfigured) return null;

    try {
      const isHardcodedAdmin = authUser.email === "admin@gmail.com";
      const { data: adminData } = await supabase.from("admins").select("*").eq("email", authUser.email).maybeSingle();
      setIsAdmin(isHardcodedAdmin || Boolean(adminData));
    } catch {
      setIsAdmin(authUser.email === "admin@gmail.com");
    }

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
      else {
        setProfile(null);
        setIsAdmin(false);
      }
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message?.includes("Invalid login credentials") || error.status === 400) {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        const { error: retryError } = await supabase.auth.signInWithPassword({ email, password });
        if (retryError) throw retryError;
        return;
      }
      throw error;
    }
  };
  const logout = async () => supabase.auth.signOut();
  const updateProfile = async (patch) => {
    const { data, error } = await supabase.from("users").update(patch).eq("id", user.id).select("*").single();
    if (error) throw error;
    setProfile(data);
  };

  return { session, user, profile, loading, offline, login, logout, updateProfile, isAdmin, supabaseConfigured };
}

export function useFriends(session) {
  const [friends, setFriends] = useState([]);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!supabaseConfigured) return;
    try {
      const [usersRes, goalsRes] = await Promise.all([
        supabase.from("users").select("*").order("created_at"),
        supabase.from("goals").select("*")
      ]);
      if (usersRes.error || goalsRes.error) throw usersRes.error || goalsRes.error;
      
      const dbUsers = usersRes.data || [];
      const dbGoals = goalsRes.data || [];

      const DEFAULT_FRIENDS = [
        { name: "Jayant", display_name: "jayant", email: "jayant@gmail.com", color: "#00ff87", initials: "JY" },
        { name: "Krish", display_name: "krish", email: "krish@gmail.com", color: "#38bdf8", initials: "KR" },
        { name: "Arshita", display_name: "arshita", email: "arshita@gmail.com", color: "#a78bfa", initials: "AR" }
      ];

      const next = DEFAULT_FRIENDS.map((df, index) => {
        const dbUser = dbUsers.find((u) => u.display_name.toLowerCase() === df.display_name);
        if (dbUser) {
          const goal = dbGoals.find((g) => g.user_id === dbUser.id) || {};
          return {
            id: dbUser.id,
            name: dbUser.display_name.replace(/\b\w/g, c => c.toUpperCase()),
            display_name: dbUser.display_name,
            initials: initials(dbUser.display_name),
            color: dbUser.avatar_color === "#00ff87" ? df.color : dbUser.avatar_color,
            avatar_color: dbUser.avatar_color,
            dailyGoal: goal.daily_target ?? 2,
            longGoal: goal.long_term_target ?? 300,
            deadline: goal.long_term_deadline,
            challengeStartDate: goal.challenge_start_date || null,
            isMock: false
          };
        } else {
          return {
            id: `mock-${df.display_name}`,
            name: df.name,
            display_name: df.display_name,
            initials: df.initials,
            color: df.color,
            avatar_color: df.color,
            dailyGoal: 2,
            longGoal: 300,
            deadline: null,
            challengeStartDate: null,
            isMock: true
          };
        }
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
    if (!supabaseConfigured) return undefined;
    const channel = supabase.channel("friends-live-" + Math.random().toString(36).substring(7))
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, load)
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
    if (!supabaseConfigured) return;
    const since = new Date();
    since.setDate(since.getDate() - 370);
    const { data, error } = await supabase.from("manual_logs").select("*").gte("log_date", since.toISOString().slice(0, 10));
    if (error) throw error;
    
    if ((!data || data.length === 0) && !session) {
      setLogs(loadJson(OFFLINE_KEY, { logs: [] }).logs || []);
      return;
    }
    
    setLogs(data || []);
    saveJson(OFFLINE_KEY, { ...loadJson(OFFLINE_KEY, {}), logs: data || [] });
  }, [session]);

  useEffect(() => {
    load().catch(() => setLogs(loadJson(OFFLINE_KEY, { logs: [] }).logs || []));
    if (!supabaseConfigured) return undefined;
    const channel = supabase.channel("manual-logs-live-" + Math.random().toString(36).substring(7))
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

  const deleteLog = async (id) => {
    const { error } = await supabase.from("manual_logs").delete().eq("id", id);
    if (error) throw error;
  };

  return { logs, addLog, deleteLog, reloadLogs: load, lastRealtimeLog };
}

export function useGoals(user = {}) {
  const updateGoal = async (patch, targetUserId = null) => {
    const { error } = await supabase.from("goals").upsert({ user_id: targetUserId || user.id, ...patch }, { onConflict: "user_id" });
    if (error) throw error;
  };
  return { updateGoal };
}

export function useSharedGoals(session, user) {
  const [sharedGoals, setSharedGoals] = useState([]);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!supabaseConfigured) return;
    const { data, error } = await supabase.from("shared_goals").select("*").order("created_at");
    if (error) throw error;
    
    if ((!data || data.length === 0) && !session) {
      setSharedGoals(loadJson(OFFLINE_KEY, { sharedGoals: [] }).sharedGoals || []);
      return;
    }

    setSharedGoals(data || []);
    saveJson(OFFLINE_KEY, { ...loadJson(OFFLINE_KEY, {}), sharedGoals: data || [] });
  }, [session]);

  useEffect(() => {
    load().catch(() => {
      setOffline(true);
      setSharedGoals(loadJson(OFFLINE_KEY, { sharedGoals: [] }).sharedGoals || []);
    });
    if (!supabaseConfigured) return undefined;
    const channel = supabase.channel("shared-goals-live-" + Math.random().toString(36).substring(7))
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_goals" }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load, session]);

  const addSharedGoal = async (goal) => {
    const payload = {
      title: goal.title.trim(),
      description: goal.description?.trim() || null,
      daily_target: Number(goal.daily_target) || 1,
      long_term_target: Number(goal.long_term_target) || 100,
      deadline: goal.deadline || null,
      color: goal.color || "#38bdf8",
      created_by: user.id
    };
    if (!payload.title) throw new Error("Goal name is required.");
    const { error } = await supabase.from("shared_goals").insert(payload);
    if (error) throw error;
  };

  const updateSharedGoal = async (id, patch) => {
    const { error } = await supabase.from("shared_goals").update(patch).eq("id", id);
    if (error) throw error;
  };

  const deleteSharedGoal = async (id) => {
    const { error } = await supabase.from("shared_goals").delete().eq("id", id);
    if (error) throw error;
  };

  return { sharedGoals, addSharedGoal, updateSharedGoal, deleteSharedGoal, reloadSharedGoals: load, offline };
}

export function useStats(friends, logs) {
  const stats = useMemo(() => friends.map((friend) => {
    const friendLogs = logs.filter((log) => log.user_id === friend.id);
    const heatmap = {};
    friendLogs.forEach((log) => { heatmap[log.log_date] = (heatmap[log.log_date] || 0) + Number(log.count || 0); });
    return {
      ...friend,
      heatmap,
      totalSolved: friendLogs.reduce((s, log) => s + Number(log.count || 0), 0),
      todaySolved: heatmap[todayKey()] || 0,
      easy: friendLogs.reduce((s, l) => s + Number(l.difficulty_easy || 0), 0),
      medium: friendLogs.reduce((s, l) => s + Number(l.difficulty_medium || 0), 0),
      hard: friendLogs.reduce((s, l) => s + Number(l.difficulty_hard || 0), 0),
      streak: countStreak(heatmap),
      loading: false,
      sourceIcon: "manual",
      lastFetched: 0
    };
  }), [friends, logs]);

  return { stats, realtimeStatus: "connected" };
}

export function useGlobalSettings() {
  const [settings, setSettings] = useState({
    finePerMiss: 5,
    startDate: "2026-05-20",
    currency: "$",
    defaultDailyTarget: 2
  });
  const [finesPaid, setFinesPaid] = useState({});
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!supabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from("global_settings")
        .select("*");
      if (error) throw error;
      
      const settingsRow = data?.find(r => r.key === "fine-settings");
      if (settingsRow && settingsRow.value) {
        setSettings(settingsRow.value);
        saveJson("meow:fine-settings:v1", settingsRow.value);
      }
      
      const paidRow = data?.find(r => r.key === "fines-paid");
      if (paidRow && paidRow.value) {
        setFinesPaid(paidRow.value);
        saveJson("meow:fines-paid:v1", paidRow.value);
      }
    } catch (err) {
      setOffline(true);
      const localS = loadJson("meow:fine-settings:v1", null);
      if (localS) setSettings(localS);
      const localP = loadJson("meow:fines-paid:v1", null);
      if (localP) setFinesPaid(localP || {});
    }
  }, []);

  useEffect(() => {
    load();
    if (!supabaseConfigured) return undefined;
    const channel = supabase.channel("global-settings-live-" + Math.random().toString(36).substring(7))
      .on("postgres_changes", { event: "*", schema: "public", table: "global_settings" }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load]);

  const updateSettings = async (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveJson("meow:fine-settings:v1", next);

    if (supabaseConfigured) {
      const { error } = await supabase
        .from("global_settings")
        .upsert({ key: "fine-settings", value: next }, { onConflict: "key" });
      if (error) throw error;
    }
  };

  const updateFinesPaid = async (nextPaid) => {
    setFinesPaid(nextPaid);
    saveJson("meow:fines-paid:v1", nextPaid);

    if (supabaseConfigured) {
      const { error } = await supabase
        .from("global_settings")
        .upsert({ key: "fines-paid", value: nextPaid }, { onConflict: "key" });
      if (error) throw error;
    }
  };

  return { settings, updateSettings, finesPaid, updateFinesPaid, offline, reloadSettings: load };
}
