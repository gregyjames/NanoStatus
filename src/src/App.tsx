import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  id: string;
  name: string;
  url: string;
  uptime: number;
  status: "up" | "down";
  responseTime: number;
  lastCheck: string;
  isThirdParty?: boolean;
  icon?: string;
}

const mockMonitors: Monitor[] = [
  { id: "1", name: "Check Port", url: "https://checkport.example.com", uptime: 100, status: "up", responseTime: 145, lastCheck: "2s ago" },
  { id: "2", name: "Example.com", url: "https://example.com", uptime: 100, status: "up", responseTime: 89, lastCheck: "5s ago" },
  { id: "4", name: "Google", url: "https://google.com", uptime: 100, status: "up", responseTime: 67, lastCheck: "1s ago", isThirdParty: true },
  { id: "5", name: "MySQL", url: "mysql://localhost:3306", uptime: 100, status: "up", responseTime: 12, lastCheck: "3s ago" },
  { id: "6", name: "Ping", url: "ping://8.8.8.8", uptime: 100, status: "up", responseTime: 23, lastCheck: "1s ago" },
];

// Mock response time data
const mockResponseData = Array.from({ length: 50 }, (_, i) => ({
  time: new Date(Date.now() - (50 - i) * 60000).toLocaleTimeString("en-US", { 
    hour: "2-digit", 
    minute: "2-digit" 
  }),
  responseTime: Math.random() * 200 + 50 + (i === 30 ? 1000 : 0),
}));

export function App() {
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMonitors = mockMonitors.filter(monitor =>
    monitor.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const upCount = mockMonitors.filter(m => m.status === "up").length;
  const downCount = mockMonitors.filter(m => m.status === "down").length;
  const avgResponseTime = Math.round(
    mockMonitors.filter(m => m.status === "up").reduce((sum, m) => sum + m.responseTime, 0) / upCount
  );
  const overallUptime = Math.round((upCount / mockMonitors.length) * 100);

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
              <p className="text-xs text-muted-foreground">Real-time monitoring dashboard</p>
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
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-2">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Overall Status</p>
                  <p className="text-3xl font-bold text-foreground">{overallUptime}%</p>
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
                  <p className="text-3xl font-bold text-green-500">{upCount}</p>
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
                  <p className="text-3xl font-bold text-red-500">{downCount}</p>
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
                  <p className="text-3xl font-bold text-foreground">{avgResponseTime}ms</p>
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
                selectedMonitor?.id === monitor.id 
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
                <Button variant="destructive" size="sm">
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
                  <LineChart data={mockResponseData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
      </div>
    </div>
  );
}

export default App;
