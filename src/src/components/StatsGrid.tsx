import { motion } from "framer-motion";
import { Activity, CheckCircle2, XCircle, Gauge } from "lucide-react";
import type { Stats } from "../types";

interface StatsGridProps {
  stats: Stats | null;
}

export function StatsGrid({ stats }: StatsGridProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.4, 0, 0.2, 1] as const
      }
    }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
    >
      <motion.div
        variants={itemVariants}
        whileHover={{ scale: 1.02, y: -4 }}
        className="relative group overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700/50 p-6 shadow-xl shadow-black/20"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-blue-500/20 border border-blue-500/30">
              <Activity className="h-5 w-5 text-blue-400" />
            </div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Uptime</span>
          </div>
          <p className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-1">
            {stats ? Math.round(stats.overallUptime) : 0}%
          </p>
          <p className="text-sm text-slate-400">Overall system health</p>
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        whileHover={{ scale: 1.02, y: -4 }}
        className="relative group overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700/50 p-6 shadow-xl shadow-black/20"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Online</span>
          </div>
          <p className="text-4xl font-bold text-emerald-400 mb-1">{stats?.servicesUp || 0}</p>
          <p className="text-sm text-slate-400">Services online</p>
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        whileHover={{ scale: 1.02, y: -4 }}
        className="relative group overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700/50 p-6 shadow-xl shadow-black/20"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30">
              <XCircle className="h-5 w-5 text-rose-400" />
            </div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Offline</span>
          </div>
          <p className="text-4xl font-bold text-rose-400 mb-1">{stats?.servicesDown || 0}</p>
          <p className="text-sm text-slate-400">Services down</p>
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        whileHover={{ scale: 1.02, y: -4 }}
        className="relative group overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700/50 p-6 shadow-xl shadow-black/20"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/30">
              <Gauge className="h-5 w-5 text-amber-400" />
            </div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Response</span>
          </div>
          <p className="text-4xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent mb-1">
            {stats?.avgResponseTime || 0}ms
          </p>
          <p className="text-sm text-slate-400">Average latency</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

