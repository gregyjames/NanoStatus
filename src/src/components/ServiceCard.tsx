import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Server, Pause } from "lucide-react";
import type { Monitor } from "../types";

interface ServiceCardProps {
  monitor: Monitor;
  isSelected: boolean;
  onClick: () => void;
  index: number;
}

export function ServiceCard({ monitor, isSelected, onClick, index }: ServiceCardProps) {
  const isPaused = monitor.paused || false;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ x: 4 }}
      onClick={onClick}
      className={`relative group cursor-pointer rounded-xl overflow-hidden border transition-all duration-300 ${
        isSelected
          ? isPaused
            ? "border-amber-500/50 bg-gradient-to-br from-amber-500/10 to-slate-900/50 shadow-xl shadow-amber-500/20"
            : "border-blue-500/50 bg-gradient-to-br from-blue-500/10 to-purple-500/10 shadow-xl shadow-blue-500/20"
          : isPaused
            ? "border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-slate-900/50 hover:border-amber-500/50"
            : "border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 hover:border-slate-600/50"
      } backdrop-blur-xl shadow-lg shadow-black/20`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative p-4">
        {isPaused && (
          <div className="mb-2 px-2 py-1 rounded-md bg-amber-500/20 border border-amber-500/30 flex items-center gap-1.5 w-fit">
            <Pause className="h-3 w-3 text-amber-400" />
            <span className="text-xs font-semibold text-amber-400">Paused</span>
          </div>
        )}
        <div className="flex items-center gap-3 mb-3">
          {monitor.icon ? (
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-xl flex-shrink-0">
              {monitor.icon}
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-slate-700/50 border border-slate-600/50 flex-shrink-0">
              <Server className="h-4 w-4 text-slate-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base text-white mb-0.5 truncate">{monitor.name}</h3>
            <p className="text-xs text-slate-400 truncate">{monitor.url}</p>
          </div>
          <div className={`p-1.5 rounded-lg flex-shrink-0 ${
            isPaused
              ? "bg-amber-500/20 border border-amber-500/30"
              : monitor.status === "up" 
                ? "bg-emerald-500/20 border border-emerald-500/30" 
                : "bg-rose-500/20 border border-rose-500/30"
          }`}>
            {isPaused ? (
              <Pause className="h-4 w-4 text-amber-400" />
            ) : monitor.status === "up" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-400" />
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Uptime</span>
            <span className="font-bold text-white">{Math.round(monitor.uptime)}%</span>
          </div>
          {!isPaused && monitor.status === "up" && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Response</span>
              <span className="font-bold text-white">{monitor.responseTime}ms</span>
            </div>
          )}
          {isPaused && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Status</span>
              <span className="font-bold text-amber-400">Paused</span>
            </div>
          )}
          <div className="w-full bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${monitor.uptime}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`h-full rounded-full ${
                isPaused
                  ? "bg-gradient-to-r from-amber-500 to-amber-400"
                  : monitor.uptime === 100 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                  monitor.uptime === 0 ? "bg-gradient-to-r from-rose-500 to-rose-400" :
                  "bg-gradient-to-r from-amber-500 to-amber-400"
              }`}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

