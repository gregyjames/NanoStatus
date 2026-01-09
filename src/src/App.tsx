import { useState, useEffect, useCallback } from "react";
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
  Server
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
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
      const response = await fetch("/api/monitors?t=" + Date.now()); // Add cache busting
      const data = await response.json();
      setMonitors(data);
      
      // Update selected monitor if it exists, or select first monitor if none selected
      if (data.length > 0) {
        setSelectedMonitor((prev) => {
          if (prev) {
            // Find and update the selected monitor with latest data
            const updatedMonitor = data.find((m: Monitor) => String(m.id) === String(prev.id));
            if (updatedMonitor) {
              return updatedMonitor;
            }
          }
          // Selected monitor no longer exists or no previous selection, select first one
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
      const response = await fetch("/api/stats?t=" + Date.now()); // Add cache busting
      const data = await response.json();
      setStats(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, []);

  const fetchResponseTimeData = useCallback(async (monitorId: string) => {
    try {
      const response = await fetch(`/api/response-time?id=${monitorId}&t=${Date.now()}`); // Add cache busting
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

      // Reset form and close dialog
      setNewService({ name: "", url: "", isThirdParty: false, icon: "", checkInterval: 60 });
      setDialogOpen(false);

      // Refresh monitors list
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

      // Clear selected monitor if it was deleted
      if (selectedMonitor && String(selectedMonitor.id) === String(monitorId)) {
        setSelectedMonitor(null);
      }

      // Refresh monitors list
      fetchMonitors();
      fetchStats();
    } catch (error) {
      console.error("Failed to delete service:", error);
      alert("Failed to delete service. Please try again.");
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchMonitors();
    fetchStats();
  }, [fetchMonitors, fetchStats]);

  // Poll monitors and stats every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMonitors();
      fetchStats();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [fetchMonitors, fetchStats]);

  // Fetch response time data when monitor is selected
  useEffect(() => {
    if (selectedMonitor) {
      fetchResponseTimeData(String(selectedMonitor.id));
    }
  }, [selectedMonitor, fetchResponseTimeData]);

  // Poll response time data every 10 seconds when monitor is selected
  useEffect(() => {
    if (!selectedMonitor) return;

    const interval = setInterval(() => {
      fetchResponseTimeData(String(selectedMonitor.id));
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [selectedMonitor, fetchResponseTimeData]);

  const filteredMonitors = monitors.filter(monitor =>
    monitor.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    return status === "up" ? "text-green-500" : "text-red-500";
  };

  const getStatusBgColor = (status: string) => {
    return status === "up" ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20";
  };

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">NanoStatus</h1>
              <p className="text-xs text-muted-foreground">
                Real-time monitoring dashboard
                {lastUpdate && (
                  <span className="ml-2">
                    • Updated {lastUpdate.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button 
              className="bg-primary hover:bg-primary/90"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-6">
        {/* Summary Stats */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="border-2">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Overall Status</p>
                      <p className="text-3xl font-bold text-foreground">
                        {stats ? Math.round(stats.overallUptime) : 0}%
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-primary/10">
                      <Activity className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Services Up</p>
                      <p className="text-3xl font-bold text-green-500">{stats?.servicesUp || 0}</p>
                    </div>
                    <div className="p-3 rounded-full bg-green-500/10">
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Services Down</p>
                      <p className="text-3xl font-bold text-red-500">{stats?.servicesDown || 0}</p>
                    </div>
                    <div className="p-3 rounded-full bg-red-500/10">
                      <XCircle className="h-6 w-6 text-red-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Avg Response</p>
                      <p className="text-3xl font-bold text-foreground">{stats?.avgResponseTime || 0}ms</p>
                    </div>
                    <div className="p-3 rounded-full bg-blue-500/10">
                      <TrendingUp className="h-6 w-6 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {filteredMonitors.map((monitor) => (
            <Card 
              key={monitor.id}
              className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] border-2 ${
                selectedMonitor && String(selectedMonitor.id) === String(monitor.id)
                  ? "ring-2 ring-primary border-primary" 
                  : getStatusBgColor(monitor.status)
              }`}
              onClick={() => setSelectedMonitor(monitor)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {monitor.icon ? (
                      <span className="text-2xl">{monitor.icon}</span>
                    ) : (
                      <div className="p-2 rounded-lg bg-muted">
                        <Server className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-lg text-foreground">{monitor.name}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">{monitor.url}</p>
                    </div>
                  </div>
                  <div className={`p-1.5 rounded-full ${getStatusBgColor(monitor.status)}`}>
                    {monitor.status === "up" ? (
                      <CheckCircle2 className={`h-4 w-4 ${getStatusColor(monitor.status)}`} />
                    ) : (
                      <XCircle className={`h-4 w-4 ${getStatusColor(monitor.status)}`} />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Uptime</span>
                    <span className="font-semibold text-foreground">{monitor.uptime}%</span>
                  </div>
                  {monitor.status === "up" && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Response</span>
                      <span className="font-semibold text-foreground">{monitor.responseTime}ms</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last Check</span>
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {monitor.lastCheck}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        monitor.uptime === 100 ? "bg-green-500" : 
                        monitor.uptime === 0 ? "bg-red-500" : "bg-yellow-500"
                      }`}
                      style={{ width: `${monitor.uptime}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

            {/* Selected Service Details */}
            {selectedMonitor && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-2">{selectedMonitor.name}</h2>
                <p className="text-muted-foreground">{selectedMonitor.url}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-foreground">
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
                <Button variant="outline" size="sm" className="text-foreground">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => selectedMonitor && deleteService(selectedMonitor.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>

            {/* Detailed Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Current Response
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">
                    {selectedMonitor.status === "up" ? `${selectedMonitor.responseTime}ms` : "N/A"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Avg Response (24h)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">138ms</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Uptime (24h)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-foreground">100%</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge
                    className={`${
                      selectedMonitor.status === "up"
                        ? "bg-green-500 hover:bg-green-600"
                        : "bg-red-500 hover:bg-red-600"
                    } text-white px-4 py-2 text-lg`}
                  >
                    {selectedMonitor.status === "up" ? (
                      <CheckCircle2 className="h-5 w-5 mr-2" />
                    ) : (
                      <XCircle className="h-5 w-5 mr-2" />
                    )}
                    {selectedMonitor.status === "up" ? "Operational" : "Down"}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* Response Time Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Response Time History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={responseTimeData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fill: "#ffffff", fontSize: 13, fontWeight: 600 }}
                      stroke="#ffffff"
                      strokeWidth={2}
                      strokeOpacity={0.8}
                    />
                    <YAxis 
                      tick={{ fill: "#ffffff", fontSize: 13, fontWeight: 600 }}
                      stroke="#ffffff"
                      strokeWidth={2}
                      strokeOpacity={0.8}
                      domain={[0, 1200]}
                      label={{ value: 'ms', angle: -90, position: 'insideLeft', fill: "#ffffff", style: { fontWeight: 600, fontSize: 13 } }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "calc(var(--radius) - 2px)",
                        color: "hsl(var(--foreground))"
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      formatter={(value: number | undefined) => [
                        value !== undefined ? `${value.toFixed(2)} ms` : "N/A",
                        "Response Time"
                      ]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="responseTime" 
                      stroke="#22c55e"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, fill: "#22c55e" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            </div>
            )}
          </>
        )}
      </div>

      {/* Add Service Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Service</DialogTitle>
            <DialogDescription>
              Add a new service to monitor. Enter the service name and URL.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Service Name</Label>
              <Input
                id="name"
                placeholder="My Service"
                value={newService.name}
                onChange={(e) => setNewService({ ...newService, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                placeholder="https://example.com"
                value={newService.url}
                onChange={(e) => setNewService({ ...newService, url: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="icon">Icon (optional)</Label>
              <Input
                id="icon"
                placeholder="📧"
                value={newService.icon}
                onChange={(e) => setNewService({ ...newService, icon: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="checkInterval">Check Interval (seconds)</Label>
              <Input
                id="checkInterval"
                type="number"
                min="10"
                max="3600"
                placeholder="60"
                value={newService.checkInterval}
                onChange={(e) => setNewService({ ...newService, checkInterval: parseInt(e.target.value) || 60 })}
              />
              <p className="text-xs text-muted-foreground">
                How often to check this service (10-3600 seconds, default: 60)
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="thirdParty"
                checked={newService.isThirdParty}
                onChange={(e) => setNewService({ ...newService, isThirdParty: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="thirdParty" className="text-sm font-normal">
                Third-party service
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={createService}
              disabled={!newService.name || !newService.url}
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
