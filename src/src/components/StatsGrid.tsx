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
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
    >
      <motion.div
        variants={itemVariants}
        whileHover={{ y: -2 }}
        className="relative group overflow-hidden rounded-2xl glass-card p-5 card-hover"
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <motion.div 
              className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10"
              whileHover={{ scale: 1.03 }}
            >
              <Activity className="h-5 w-5 text-slate-200" />
            </motion.div>
            <span className="text-[11px] font-semibold text-slate-200/70 uppercase tracking-wider">Uptime</span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div className="text-3xl font-semibold text-white tabular-nums">
              {stats ? Math.round(stats.overallUptime) : 0}%
            </div>
            <div className="text-xs text-slate-300/60">last 24h</div>
          </div>
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        whileHover={{ y: -2 }}
        className="relative group overflow-hidden rounded-2xl glass-card p-5 card-hover"
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <motion.div 
              className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10"
              whileHover={{ scale: 1.03 }}
            >
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            </motion.div>
            <span className="text-[11px] font-semibold text-slate-200/70 uppercase tracking-wider">Online</span>
          </div>
          <div className="text-3xl font-semibold text-white tabular-nums">{stats?.servicesUp || 0}</div>
          <div className="text-xs text-slate-300/60 mt-1">monitors</div>
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        whileHover={{ y: -2 }}
        className="relative group overflow-hidden rounded-2xl glass-card p-5 card-hover"
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <motion.div 
              className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10"
              whileHover={{ scale: 1.03 }}
            >
              <XCircle className="h-5 w-5 text-rose-300" />
            </motion.div>
            <span className="text-[11px] font-semibold text-slate-200/70 uppercase tracking-wider">Offline</span>
          </div>
          <div className="text-3xl font-semibold text-white tabular-nums">{stats?.servicesDown || 0}</div>
          <div className="text-xs text-slate-300/60 mt-1">monitors</div>
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        whileHover={{ y: -2 }}
        className="relative group overflow-hidden rounded-2xl glass-card p-5 card-hover"
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <motion.div 
              className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10"
              whileHover={{ scale: 1.03 }}
            >
              <Gauge className="h-5 w-5 text-amber-300" />
            </motion.div>
            <span className="text-[11px] font-semibold text-slate-200/70 uppercase tracking-wider">Avg latency</span>
          </div>
          <div className="text-3xl font-semibold text-white tabular-nums">{stats?.avgResponseTime || 0}ms</div>
          <div className="text-xs text-slate-300/60 mt-1">last 24h</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

