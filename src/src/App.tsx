import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Search, 
  Plus, 
  Pause, 
  Edit, 
  Trash2, 
  CheckCircle2,
  XCircle,
  Activity,
  TrendingUp,
  Clock,
  AlertCircle,
  Zap,
  Server,
  BarChart3,
  Gauge,
  Globe
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Area, AreaChart } from "recharts";
import "./index.css";

interface Monitor {
  id: string | number;
  name: string;
  url: string;
  uptime: number;
  status: "up" | "down";
  responseTime: number;
  lastCheck: string;
  isThirdParty?: boolean;
  icon?: string;
  checkInterval?: number;
}

interface Stats {
  overallUptime: number;
  servicesUp: number;
  servicesDown: number;
  avgResponseTime: number;
}

interface ResponseTimeData {
  time: string;
  responseTime: number;
}

export function App() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null);
  const [responseTimeData, setResponseTimeData] = useState<ResponseTimeData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newService, setNewService] = useState({
    name: "",
    url: "",
    isThirdParty: false,
    icon: "",
    checkInterval: 60,
  });

  const fetchMonitors = useCallback(async () => {
    try {
      const response = await fetch("/api/monitors?t=" + Date.now());
      const data = await response.json();
      setMonitors(data);
      
      if (data.length > 0) {
        setSelectedMonitor((prev) => {
          if (prev) {
            const updatedMonitor = data.find((m: Monitor) => String(m.id) === String(prev.id));
            if (updatedMonitor) {
              return updatedMonitor;
            }
          }
          return data[0];
        });
      }
      setLoading(false);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Failed to fetch monitors:", error);
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/stats?t=" + Date.now());
      const data = await response.json();
      setStats(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, []);

  const fetchResponseTimeData = useCallback(async (monitorId: string) => {
    try {
      const response = await fetch(`/api/response-time?id=${monitorId}&t=${Date.now()}`);
      const data = await response.json();
      setResponseTimeData(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Failed to fetch response time data:", error);
    }
  }, []);

  const createService = async () => {
    try {
      const response = await fetch("/api/monitors/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newService),
      });

      if (!response.ok) {
        const error = await response.text();
        alert("Failed to create service: " + error);
        return;
      }

      setNewService({ name: "", url: "", isThirdParty: false, icon: "", checkInterval: 60 });
      setDialogOpen(false);
      fetchMonitors();
      fetchStats();
    } catch (error) {
      console.error("Failed to create service:", error);
      alert("Failed to create service. Please try again.");
    }
  };

  const deleteService = async (monitorId: string | number) => {
    if (!confirm("Are you sure you want to delete this service?")) {
      return;
    }

    try {
      const response = await fetch(`/api/monitor?id=${monitorId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.text();
        alert("Failed to delete service: " + error);
        return;
      }

      if (selectedMonitor && String(selectedMonitor.id) === String(monitorId)) {
        setSelectedMonitor(null);
      }

      fetchMonitors();
      fetchStats();
    } catch (error) {
      console.error("Failed to delete service:", error);
      alert("Failed to delete service. Please try again.");
    }
  };

  useEffect(() => {
    fetchMonitors();
    fetchStats();
  }, [fetchMonitors, fetchStats]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchMonitors();
      fetchStats();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchMonitors, fetchStats]);

  useEffect(() => {
    if (selectedMonitor) {
      fetchResponseTimeData(String(selectedMonitor.id));
    }
  }, [selectedMonitor, fetchResponseTimeData]);

  useEffect(() => {
    if (!selectedMonitor) return;

    const interval = setInterval(() => {
      fetchResponseTimeData(String(selectedMonitor.id));
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedMonitor, fetchResponseTimeData]);

  const filteredMonitors = monitors.filter(monitor =>
    monitor.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    return status === "up" ? "text-emerald-400" : "text-rose-400";
  };

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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Modern Header */}
      <motion.header 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-slate-800/50 shadow-2xl"
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 shadow-lg shadow-blue-500/10"
              >
                <Activity className="h-6 w-6 text-blue-400" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  NanoStatus
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  {lastUpdate.toLocaleTimeString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                <Input
                  placeholder="Search services..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-11 pr-4 w-72 h-11 bg-slate-800/50 border-slate-700/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 text-white placeholder:text-slate-500 rounded-xl"
                />
              </div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg shadow-blue-500/25 h-11 px-6 rounded-xl font-semibold"
                  onClick={() => setDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="container mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full"
            />
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            {/* Stats Grid - Modern Design */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div
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
                  <p className="text-sm text-slate-400">Services running</p>
                </div>
              </motion.div>

              <motion.div
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

            {/* Services Grid - Modern Cards */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredMonitors.map((monitor, index) => (
                  <motion.div
                    key={monitor.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.1, duration: 0.4 }}
                    whileHover={{ scale: 1.02, y: -4 }}
                    onClick={() => setSelectedMonitor(monitor)}
                    className={`relative group cursor-pointer rounded-2xl overflow-hidden border transition-all duration-300 ${
                      selectedMonitor && String(selectedMonitor.id) === String(monitor.id)
                        ? "border-blue-500/50 bg-gradient-to-br from-blue-500/10 to-purple-500/10 shadow-2xl shadow-blue-500/20"
                        : "border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 hover:border-slate-600/50"
                    } backdrop-blur-xl shadow-xl shadow-black/20`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {monitor.icon ? (
                            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-2xl">
                              {monitor.icon}
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl bg-slate-700/50 border border-slate-600/50">
                              <Server className="h-5 w-5 text-slate-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg text-white mb-1 truncate">{monitor.name}</h3>
                            <p className="text-xs text-slate-400 truncate">{monitor.url}</p>
                          </div>
                        </div>
                        <div className={`p-2 rounded-lg ${
                          monitor.status === "up" 
                            ? "bg-emerald-500/20 border border-emerald-500/30" 
                            : "bg-rose-500/20 border border-rose-500/30"
                        }`}>
                          {monitor.status === "up" ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                          ) : (
                            <XCircle className="h-5 w-5 text-rose-400" />
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">Uptime</span>
                          <span className="font-bold text-white">{Math.round(monitor.uptime)}%</span>
                        </div>
                        {monitor.status === "up" && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">Response</span>
                            <span className="font-bold text-white">{monitor.responseTime}ms</span>
                          </div>
                        )}
                        <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${monitor.uptime}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full rounded-full ${
                              monitor.uptime === 100 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                              monitor.uptime === 0 ? "bg-gradient-to-r from-rose-500 to-rose-400" :
                              "bg-gradient-to-r from-amber-500 to-amber-400"
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {/* Selected Monitor Details */}
            <AnimatePresence>
              {selectedMonitor && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-6"
                >
                  <div className="rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700/50 p-8 shadow-2xl shadow-black/30">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        {selectedMonitor.icon ? (
                          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-4xl">
                            {selectedMonitor.icon}
                          </div>
                        ) : (
                          <div className="p-4 rounded-2xl bg-slate-700/50 border border-slate-600/50">
                            <Globe className="h-8 w-8 text-slate-400" />
                          </div>
                        )}
                        <div>
                          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-1">
                            {selectedMonitor.name}
                          </h2>
                          <p className="text-slate-400">{selectedMonitor.url}</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button variant="outline" size="sm" className="border-slate-700/50 hover:bg-slate-800/50">
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </Button>
                        <Button variant="outline" size="sm" className="border-slate-700/50 hover:bg-slate-800/50">
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          className="bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700"
                          onClick={() => selectedMonitor && deleteService(selectedMonitor.id)}
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
                          {selectedMonitor.status === "up" ? `${selectedMonitor.responseTime}ms` : "N/A"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-800/30 border border-slate-700/50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-blue-400" />
                          <span className="text-xs font-semibold text-slate-400 uppercase">Avg (24h)</span>
                        </div>
                        <p className="text-2xl font-bold text-white">
                          {responseTimeData.length > 0
                            ? `${Math.round(responseTimeData.reduce((sum, data) => sum + data.responseTime, 0) / responseTimeData.length)}ms`
                            : "N/A"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-800/30 border border-slate-700/50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="h-4 w-4 text-emerald-400" />
                          <span className="text-xs font-semibold text-slate-400 uppercase">Uptime</span>
                        </div>
                        <p className="text-2xl font-bold text-white">
                          {selectedMonitor.uptime ? `${Math.round(selectedMonitor.uptime)}%` : "N/A"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-800/30 border border-slate-700/50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-primary" />
                          <span className="text-xs font-semibold text-slate-400 uppercase">Status</span>
                        </div>
                        <Badge
                          className={`${
                            selectedMonitor.status === "up"
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                          } border px-3 py-1`}
                        >
                          {selectedMonitor.status === "up" ? "Online" : "Offline"}
                        </Badge>
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-800/30 border border-slate-700/50 p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <BarChart3 className="h-5 w-5 text-blue-400" />
                        <h3 className="text-lg font-bold text-white">Response Time History</h3>
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
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Add Service Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Add New Service</DialogTitle>
            <DialogDescription className="text-slate-400">
              Add a new service to monitor. Enter the service name and URL.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-slate-300">Service Name</Label>
              <Input
                id="name"
                placeholder="My Service"
                value={newService.name}
                onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="url" className="text-slate-300">URL</Label>
              <Input
                id="url"
                placeholder="https://example.com"
                value={newService.url}
                onChange={(e) => setNewService({ ...newService, url: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="icon" className="text-slate-300">Icon (optional)</Label>
              <Input
                id="icon"
                placeholder="📧"
                value={newService.icon}
                onChange={(e) => setNewService({ ...newService, icon: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="checkInterval" className="text-slate-300">Check Interval (seconds)</Label>
              <Input
                id="checkInterval"
                type="number"
                min="10"
                max="3600"
                placeholder="60"
                value={newService.checkInterval}
                onChange={(e) => setNewService({ ...newService, checkInterval: parseInt(e.target.value) || 60 })}
                className="bg-slate-800 border-slate-700 text-white"
              />
              <p className="text-xs text-slate-500">
                How often to check this service (10-3600 seconds, default: 60)
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="thirdParty"
                checked={newService.isThirdParty}
                onChange={(e) => setNewService({ ...newService, isThirdParty: e.target.checked })}
                className="rounded border-slate-600 bg-slate-800"
              />
              <Label htmlFor="thirdParty" className="text-sm font-normal text-slate-300">
                Third-party service
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-slate-700">
              Cancel
            </Button>
            <Button 
              onClick={createService}
              disabled={!newService.name || !newService.url}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            >
              Add Service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
