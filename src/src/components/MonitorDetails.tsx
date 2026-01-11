import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Pause, Play, Edit, Trash2, Zap, TrendingUp, Activity, AlertCircle, BarChart3, Globe, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { Monitor, ResponseTimeData } from "../types";

interface MonitorDetailsProps {
  monitor: Monitor;
  responseTimeData: ResponseTimeData[];
  onDelete: (id: string | number) => void;
  onEdit: (monitor: Monitor) => void;
  onTogglePause: (id: string | number, paused: boolean) => void;
  onFetchResponseTime?: (monitorId: string, timeRange: string) => void;
}

export function MonitorDetails({ monitor, responseTimeData, onDelete, onEdit, onTogglePause, onFetchResponseTime }: MonitorDetailsProps) {
  const avgResponseTime = responseTimeData.length > 0
    ? Math.round(responseTimeData.reduce((sum, data) => sum + data.responseTime, 0) / responseTimeData.length)
    : 0;

  const isPaused = monitor.paused || false;
  
  // Time range state (default to 24h, but show as "12h" initially for better UX)
  const [timeRange, setTimeRange] = useState<string>("12h");
  
  // Format timestamp in user's local timezone
  const formatTime = (data: ResponseTimeData, range: string): string => {
    if (data.timestamp) {
      try {
        const date = new Date(data.timestamp);
        if (isNaN(date.getTime())) {
          // Invalid date, fallback to provided time string
          return data.time;
        }
        switch (range) {
          case "1h":
          case "12h":
          case "24h":
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          case "1w":
            return date.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
          case "1y":
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          default:
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        }
      } catch (e) {
        // Error parsing date, fallback to provided time string
        return data.time;
      }
    }
    // Fallback to provided time string
    return data.time;
  };
  
  // Format response time data with local timezone (recalculates when timeRange or responseTimeData changes)
  const formattedResponseTimeData = responseTimeData.map(data => ({
    ...data,
    time: formatTime(data, timeRange)
  }));
  
  // Calculate seconds since last update
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState<number>(0);
  
  // Format time in the best unit
  const formatTimeAgo = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s ago`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}${minutes === 1 ? ' minute' : ' minutes'} ago`;
    } else if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return `${hours}${hours === 1 ? ' hour' : ' hours'} ago`;
    } else if (seconds < 604800) {
      const days = Math.floor(seconds / 86400);
      return `${days}${days === 1 ? ' day' : ' days'} ago`;
    } else if (seconds < 2592000) {
      const weeks = Math.floor(seconds / 604800);
      return `${weeks}${weeks === 1 ? ' week' : ' weeks'} ago`;
    } else if (seconds < 31536000) {
      const months = Math.floor(seconds / 2592000);
      return `${months}${months === 1 ? ' month' : ' months'} ago`;
    } else {
      const years = Math.floor(seconds / 31536000);
      return `${years}${years === 1 ? ' year' : ' years'} ago`;
    }
  };
  
  useEffect(() => {
    const calculateSeconds = () => {
      if (monitor.updatedAt) {
        const updatedAt = new Date(monitor.updatedAt);
        const now = new Date();
        const diffSeconds = Math.floor((now.getTime() - updatedAt.getTime()) / 1000);
        setSecondsSinceUpdate(Math.max(0, diffSeconds));
      } else {
        // Fallback: parse lastCheck string
        const lastCheckStr = monitor.lastCheck || "";
        const lastCheck = lastCheckStr.toLowerCase();
        if (lastCheck === "just now" || lastCheck === "never" || lastCheck === "") {
          setSecondsSinceUpdate(0);
        } else if (lastCheck.includes("s ago")) {
          const match = lastCheck.match(/(\d+)s ago/);
          setSecondsSinceUpdate(match && match[1] ? parseInt(match[1], 10) : 0);
        } else if (lastCheck.includes("m ago")) {
          const match = lastCheck.match(/(\d+)m ago/);
          setSecondsSinceUpdate(match && match[1] ? parseInt(match[1], 10) * 60 : 0);
        } else if (lastCheck.includes("h ago")) {
          const match = lastCheck.match(/(\d+)h ago/);
          setSecondsSinceUpdate(match && match[1] ? parseInt(match[1], 10) * 3600 : 0);
        } else {
          setSecondsSinceUpdate(0);
        }
      }
    };
    
    calculateSeconds();
    const interval = setInterval(calculateSeconds, 1000);
    
    return () => clearInterval(interval);
  }, [monitor.updatedAt, monitor.lastCheck]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.4 }}
        className="space-y-5"
      >
        <div className={`rounded-2xl glass-card border p-6 ${
          isPaused ? "border-amber-500/20" : "border-white/10"
        }`}>
          {isPaused && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3"
            >
              <Pause className="h-5 w-5 text-amber-300" />
              <span className="text-sm font-semibold text-amber-200">Monitoring is paused</span>
            </motion.div>
          )}
          <div className="flex items-start justify-between gap-6 mb-6">
            <div className="flex items-start gap-4 min-w-0">
              {monitor.icon ? (
                <motion.div 
                  className="h-12 w-12 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-2xl"
                  whileHover={{ scale: 1.05 }}
                >
                  {monitor.icon}
                </motion.div>
              ) : (
                <div className="h-12 w-12 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
                  <Globe className="h-6 w-6 text-slate-200" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-2xl font-semibold text-white leading-snug truncate">
                  {monitor.name}
                </h2>
                <p className="text-sm text-slate-300/70 truncate">{monitor.url}</p>
                <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-300/70">
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10">
                    <Clock className="h-4 w-4 text-slate-300/70" />
                    <span>Last update: {secondsSinceUpdate === 0 ? "just now" : formatTimeAgo(secondsSinceUpdate)}</span>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10">
                    <RefreshCw className="h-4 w-4 text-slate-300/70" />
                    <span>Interval: {monitor.checkInterval || 60}s</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={`h-9 px-3 rounded-lg border bg-white/[0.04] text-white border-white/10 hover:bg-white/[0.06] ${
                    isPaused ? "border-amber-500/20" : ""
                  }`}
                  onClick={() => onTogglePause(monitor.id, !isPaused)}
                >
                  {isPaused ? (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </>
                  )}
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 px-3 rounded-lg border bg-white/[0.04] text-white border-white/10 hover:bg-white/[0.06]"
                  onClick={() => onEdit(monitor)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                <Button 
                  variant="destructive" 
                  size="sm"
                  className="h-9 px-3 rounded-lg"
                  onClick={() => onDelete(monitor.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </motion.div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4">
              <div className="flex items-center gap-2 text-[11px] text-slate-300/60 uppercase tracking-wider">
                <Zap className="h-4 w-4 text-slate-300/70" />
                Current
              </div>
              <div className="mt-2 text-2xl font-semibold text-white tabular-nums">
                {monitor.status === "up" ? `${monitor.responseTime}ms` : "—"}
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4">
              <div className="flex items-center gap-2 text-[11px] text-slate-300/60 uppercase tracking-wider">
                <TrendingUp className="h-4 w-4 text-slate-300/70" />
                Avg (24h)
              </div>
              <div className="mt-2 text-2xl font-semibold text-white tabular-nums">
                {avgResponseTime > 0 ? `${avgResponseTime}ms` : "—"}
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4">
              <div className="flex items-center gap-2 text-[11px] text-slate-300/60 uppercase tracking-wider">
                <Activity className="h-4 w-4 text-slate-300/70" />
                Uptime
              </div>
              <div className="mt-2 text-2xl font-semibold text-white tabular-nums">
                {monitor.uptime ? `${Math.round(monitor.uptime)}%` : "—"}
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4">
              <div className="flex items-center gap-2 text-[11px] text-slate-300/60 uppercase tracking-wider">
                <AlertCircle className="h-4 w-4 text-slate-300/70" />
                Status
              </div>
              <div className="mt-2">
                {isPaused ? (
                  <Badge className="bg-amber-500/10 text-amber-200 border-amber-500/20 border px-3 py-1">
                    Paused
                  </Badge>
                ) : (
                  <Badge
                    className={`${
                      monitor.status === "up"
                        ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-200 border-rose-500/20"
                    } border px-3 py-1`}
                  >
                    {monitor.status === "up" ? "Online" : "Offline"}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl glass-card p-6 border border-white/10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-slate-200" />
                </div>
                <h3 className="text-lg font-semibold text-white">Response time</h3>
              </div>
              <div className="flex items-center gap-2">
                {(["1h", "12h", "1w", "1y"] as const).map((range) => (
                  <motion.div key={range} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      variant={timeRange === range ? "default" : "outline"}
                      size="sm"
                      className={`text-xs px-3 h-8 font-semibold transition-all rounded-lg ${
                        timeRange === range
                          ? "bg-white text-slate-900 hover:bg-white/90"
                          : "bg-white/[0.04] text-white border border-white/10 hover:bg-white/[0.06]"
                      }`}
                      onClick={() => {
                        setTimeRange(range);
                        if (onFetchResponseTime) {
                          onFetchResponseTime(String(monitor.id), range);
                        }
                      }}
                    >
                      {range === "1h" ? "1 Hour" : range === "12h" ? "12 Hours" : range === "1w" ? "1 Week" : "1 Year"}
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={formattedResponseTimeData}>
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5}/>
                    <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="#ec4899" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" opacity={0.3} />
                <XAxis 
                  dataKey="time" 
                  tick={{ fill: "#e2e8f0", fontSize: 12, fontWeight: 600 }}
                  stroke="rgba(255,255,255,0.1)"
                  style={{ fontFamily: 'system-ui' }}
                />
                <YAxis 
                  tick={{ fill: "#e2e8f0", fontSize: 12, fontWeight: 600 }}
                  stroke="rgba(255,255,255,0.1)"
                  domain={[0, 1200]}
                  style={{ fontFamily: 'system-ui' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "rgba(10, 10, 20, 0.95)",
                    backdropFilter: "blur(24px)",
                    border: "2px solid rgba(255,255,255,0.15)",
                    borderRadius: "16px",
                    color: "#f1f5f9",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                    padding: "12px 16px"
                  }}
                  formatter={(value: number | undefined) => [
                    value !== undefined ? `${value.toFixed(2)} ms` : "N/A",
                    "Response Time"
                  ]}
                />
                <Area 
                  type="monotone" 
                  dataKey="responseTime" 
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#colorGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

