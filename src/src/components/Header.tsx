import { motion } from "framer-motion";
import { Search, Plus, Activity, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddService: () => void;
  onExportMonitors: () => void;
  lastUpdate: Date;
}

export function Header({ searchQuery, onSearchChange, onAddService, onExportMonitors, lastUpdate }: HeaderProps) {
  return (
    <motion.header 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="sticky top-0 z-50 glass-effect border-b border-white/10"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="relative flex items-center justify-center"
            >
              <div className="relative h-11 w-11 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-slate-200" />
              </div>
            </motion.div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold gradient-text tracking-tight leading-none">
                NanoStatus
              </h1>
              <motion.p 
                key={lastUpdate.getTime()}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-slate-300/60 font-medium flex items-center gap-2 mt-1"
              >
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                {lastUpdate.toLocaleTimeString()}
              </motion.p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.div 
              className="relative group"
              whileHover={{ scale: 1.01 }}
            >
              <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-purple-400 transition-colors z-10" />
              <Input
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-14 pr-5 w-64 sm:w-80 h-11 glass-card border-white/10 focus:border-white/20 focus:ring-2 focus:ring-white/10 text-white placeholder:text-slate-400/60 rounded-xl transition-all duration-200 text-sm"
              />
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.03 }} 
              whileTap={{ scale: 0.98 }}
            >
              <Button 
                className="glass-card border-white/10 hover:border-white/20 hover:bg-white/5 text-white h-11 px-4 rounded-xl font-semibold transition-all duration-200 text-sm"
                onClick={onExportMonitors}
              >
                <Download className="h-4 w-4 mr-2" />
                Export YAML
              </Button>
            </motion.div>
            <motion.div 
              whileHover={{ scale: 1.03 }} 
              whileTap={{ scale: 0.98 }}
            >
              <Button 
                className="relative overflow-hidden bg-white text-slate-900 hover:bg-white/90 h-11 px-4 rounded-xl font-semibold transition-all duration-200 group"
                onClick={onAddService}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add monitor
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.header>
  );
}

