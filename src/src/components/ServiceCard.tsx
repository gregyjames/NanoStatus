import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Server, Pause } from "lucide-react";
import type { Monitor } from "../types";

interface ServiceCardProps {
  monitor: Monitor;
  isSelected: boolean;
  onClick: () => void;
  index: number;
  variant?: "card" | "row";
}

function getStatusDotClass(monitor: Monitor, isPaused: boolean) {
  if (isPaused) return "bg-amber-400";
  if (monitor.status === "up") return "bg-emerald-400";
  return "bg-rose-400";
}

export function ServiceCard({ monitor, isSelected, onClick, index, variant = "card" }: ServiceCardProps) {
  const isPaused = monitor.paused || false;

  if (variant === "row") {
    return (
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.02, 0.2), duration: 0.18 }}
        onClick={onClick}
        className={`w-full text-left rounded-xl border px-3 py-2 glass-card card-hover ${
          isSelected ? "border-white/20 bg-white/[0.06]" : "border-white/10 hover:border-white/16"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${getStatusDotClass(monitor, isPaused)}`} />

          {monitor.icon ? (
            <div className="h-8 w-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-base">
              {monitor.icon}
            </div>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center">
              <Server className="h-4 w-4 text-slate-300" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white truncate">{monitor.name}</span>
              {isPaused && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-200 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  <Pause className="h-3 w-3" />
                  Paused
                </span>
              )}
            </div>
            <div className="text-xs text-slate-300/70 truncate">{monitor.url}</div>
          </div>

          <div className="hidden xl:flex items-center gap-6 text-xs text-slate-200/80">
            <div className="text-right">
              <div className="text-[11px] text-slate-300/60">Uptime</div>
              <div className="font-semibold text-white tabular-nums">{Math.round(monitor.uptime)}%</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-300/60">Latency</div>
              <div className="font-semibold text-white tabular-nums">
                {!isPaused && monitor.status === "up" ? `${monitor.responseTime}ms` : "—"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-300/60">Last check</div>
              <div className="font-semibold text-white tabular-nums">{monitor.lastCheck || "—"}</div>
            </div>
          </div>

          <div className="flex-shrink-0">
            {isPaused ? (
              <Pause className="h-4 w-4 text-amber-300" />
            ) : monitor.status === "up" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-300" />
            )}
          </div>
        </div>
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -6, scale: 1.02 }}
      onClick={onClick}
      className={`relative group cursor-pointer rounded-3xl overflow-hidden border-2 transition-all duration-500 card-hover ${
        isSelected
          ? isPaused
            ? "border-amber-400/60 glass-card shadow-2xl shadow-amber-500/40"
            : "border-purple-400/60 glass-card shadow-2xl shadow-purple-500/40"
          : isPaused
            ? "border-amber-500/30 glass-card hover:border-amber-400/60 hover:shadow-xl hover:shadow-amber-500/30"
            : "border-white/10 glass-card hover:border-purple-400/40 hover:shadow-xl hover:shadow-purple-500/20"
      }`}
    >
      <div className={`absolute inset-0 transition-opacity duration-700 ${
        isSelected
          ? isPaused
            ? "bg-gradient-to-br from-amber-600/30 to-amber-700/15 opacity-100"
            : "bg-gradient-to-br from-purple-600/30 via-blue-600/30 to-pink-600/15 opacity-100"
          : "bg-gradient-to-br from-purple-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100"
      }`} />
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      <div className="relative p-6">
        {isPaused && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500/40 to-amber-600/30 border-2 border-amber-400/50 flex items-center gap-2.5 w-fit shadow-xl shadow-amber-500/30"
          >
            <Pause className="h-4 w-4 text-amber-200" />
            <span className="text-xs font-black text-amber-200 uppercase tracking-wider">Paused</span>
          </motion.div>
        )}
        <div className="flex items-center gap-5 mb-6">
          {monitor.icon ? (
            <motion.div 
              className="p-4 rounded-3xl bg-gradient-to-br from-purple-500/40 via-blue-500/40 to-pink-500/40 border-2 border-white/30 text-3xl flex-shrink-0 shadow-2xl shadow-purple-500/30"
              whileHover={{ rotate: [0, -15, 15, 0], scale: 1.15 }}
            >
              {monitor.icon}
            </motion.div>
          ) : (
            <div className="p-4 rounded-3xl glass-card border-white/15 flex-shrink-0">
              <Server className="h-6 w-6 text-slate-200" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-xl text-white mb-1.5 truncate">{monitor.name}</h3>
            <p className="text-sm text-slate-300/70 truncate font-semibold">{monitor.url}</p>
          </div>
          <motion.div 
            className={`p-3 rounded-2xl flex-shrink-0 shadow-xl border-2 ${
              isPaused
                ? "bg-gradient-to-br from-amber-500/40 to-amber-600/30 border-amber-400/50"
                : monitor.status === "up" 
                  ? "bg-gradient-to-br from-emerald-500/40 to-green-500/30 border-emerald-400/50" 
                  : "bg-gradient-to-br from-rose-500/40 to-red-500/30 border-rose-400/50"
            }`}
            whileHover={{ scale: 1.15, rotate: [0, -10, 10, 0] }}
          >
            {isPaused ? (
              <Pause className="h-6 w-6 text-amber-200" />
            ) : monitor.status === "up" ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-200" />
            ) : (
              <XCircle className="h-6 w-6 text-rose-200" />
            )}
          </motion.div>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-300/60 uppercase tracking-widest px-2 py-1 rounded-lg bg-white/5">Uptime</span>
            <span className="text-2xl font-black text-white">{Math.round(monitor.uptime)}%</span>
          </div>
          {!isPaused && monitor.status === "up" && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-300/60 uppercase tracking-widest px-2 py-1 rounded-lg bg-white/5">Response</span>
              <span className="text-2xl font-black text-white">{monitor.responseTime}ms</span>
            </div>
          )}
          {isPaused && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-300/60 uppercase tracking-widest px-2 py-1 rounded-lg bg-white/5">Status</span>
              <span className="text-2xl font-black text-amber-300">Paused</span>
            </div>
          )}
          <div className="w-full bg-black/30 rounded-full h-3 overflow-hidden backdrop-blur-sm border border-white/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${monitor.uptime}%` }}
              transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1] }}
              className={`h-full rounded-full shadow-lg ${
                isPaused
                  ? "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300"
                  : monitor.uptime === 100 ? "bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-300" :
                  monitor.uptime === 0 ? "bg-gradient-to-r from-rose-500 via-rose-400 to-rose-300" :
                  "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300"
              }`}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

