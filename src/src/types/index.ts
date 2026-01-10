export interface Monitor {
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
  paused?: boolean;
  updatedAt?: string;
}

export interface Stats {
  overallUptime: number;
  servicesUp: number;
  servicesDown: number;
  avgResponseTime: number;
}

export interface ResponseTimeData {
  time: string;
  timestamp?: string; // ISO 8601 timestamp for client-side formatting
  responseTime: number;
}

export interface NewService {
  name: string;
  url: string;
  isThirdParty: boolean;
  icon: string;
  checkInterval: number;
}

