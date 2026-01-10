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
        className="space-y-6"
      >
        <div className={`rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border p-8 shadow-2xl shadow-black/30 ${
          isPaused ? "border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-slate-900/50" : "border-slate-700/50"
        }`}>
          {isPaused && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center gap-2">
              <Pause className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold text-amber-400">Monitoring is paused</span>
            </div>
          )}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              {monitor.icon ? (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-4xl">
                  {monitor.icon}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-700/50 border border-slate-600/50">
                  <Globe className="h-8 w-8 text-slate-400" />
                </div>
              )}
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-1">
                  {monitor.name}
                </h2>
                <p className="text-slate-400 mb-2">{monitor.url}</p>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Last update: {secondsSinceUpdate === 0 ? "just now" : formatTimeAgo(secondsSinceUpdate)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Interval: {monitor.checkInterval || 60}s</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                className={`border-slate-700/50 bg-slate-800/30 text-white hover:bg-slate-700/50 hover:text-white hover:border-slate-600/50 ${
                  isPaused ? "border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20" : ""
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
              <Button 
                variant="outline" 
                size="sm" 
                className="border-slate-700/50 bg-slate-800/30 text-white hover:bg-slate-700/50 hover:text-white hover:border-slate-600/50"
                onClick={() => onEdit(monitor)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button 
                variant="destructive" 
                size="sm"
                className="bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white"
                onClick={() => onDelete(monitor.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase">Current</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {monitor.status === "up" ? `${monitor.responseTime}ms` : "N/A"}
              </p>
            </div>
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase">Avg (24h)</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {avgResponseTime > 0 ? `${avgResponseTime}ms` : "N/A"}
              </p>
            </div>
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase">Uptime</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {monitor.uptime ? `${Math.round(monitor.uptime)}%` : "N/A"}
              </p>
            </div>
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-slate-400 uppercase">Status</span>
              </div>
              {isPaused ? (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 border px-3 py-1">
                  Paused
                </Badge>
              ) : (
                <Badge
                  className={`${
                    monitor.status === "up"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                  } border px-3 py-1`}
                >
                  {monitor.status === "up" ? "Online" : "Offline"}
                </Badge>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-slate-800/30 border border-slate-700/50 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-blue-400" />
                <h3 className="text-lg font-bold text-white">Response Time History</h3>
              </div>
              <div className="flex items-center gap-2">
                {(["1h", "12h", "1w", "1y"] as const).map((range) => (
                  <Button
                    key={range}
                    variant={timeRange === range ? "default" : "outline"}
                    size="sm"
                    className={`text-xs px-3 h-7 transition-all ${
                      timeRange === range
                        ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg shadow-blue-500/25"
                        : "border-slate-700/50 bg-slate-800/30 text-white hover:bg-slate-700/50 hover:border-slate-600/50"
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
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={responseTimeData}>
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis 
                  dataKey="time" 
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  stroke="#475569"
                />
                <YAxis 
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  stroke="#475569"
                  domain={[0, 1200]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#f1f5f9"
                  }}
                  formatter={(value: number | undefined) => [
                    value !== undefined ? `${value.toFixed(2)} ms` : "N/A",
                    "Response Time"
                  ]}
                />
                <Area 
                  type="monotone" 
                  dataKey="responseTime" 
                  stroke="#22c55e"
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

