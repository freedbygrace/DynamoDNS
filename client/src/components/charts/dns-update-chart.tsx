import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { DnsMetric } from "@shared/schema";

interface DnsUpdateChartProps {
  timeframe?: string;
  domainId?: string;
}

interface ChartDataPoint {
  time: string;
  updates: number;
}

export function DnsUpdateChart({ 
  timeframe = "day",
  domainId 
}: DnsUpdateChartProps) {
  // Calculate the date range based on timeframe
  const getDateRange = () => {
    const endDate = new Date();
    let startDate = new Date();
    
    if (timeframe === "day") {
      startDate.setDate(startDate.getDate() - 1);
    } else if (timeframe === "week") {
      startDate.setDate(startDate.getDate() - 7);
    } else if (timeframe === "month") {
      startDate.setMonth(startDate.getMonth() - 1);
    }
    
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  };
  
  const { startDate, endDate } = getDateRange();
  
  // Create a query key that includes the timeframe and domainId
  const queryKey = domainId ? 
    ["/api/dns-metrics/domain", domainId, timeframe, startDate, endDate] : 
    ["/api/dns-metrics", timeframe, startDate, endDate];
  
  // Use the actual DNS metrics API endpoint
  const { data: metricsData, isLoading } = useQuery<DnsMetric[]>({
    queryKey,
    queryFn: async () => {
      const baseUrl = domainId ? 
        `/api/dns-metrics/domain/${domainId}` : 
        "/api/dns-metrics";
        
      const url = new URL(baseUrl, window.location.origin);
      url.searchParams.append("type", "update");
      url.searchParams.append("startDate", startDate);
      url.searchParams.append("endDate", endDate);
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error("Failed to fetch DNS metrics");
      }
      
      return response.json();
    },
    // Keep data fresh for 5 minutes
    staleTime: 5 * 60 * 1000,
  });
  
  // Transform the metrics data into chart format
  const transformMetricsToChartData = (metrics: DnsMetric[] | undefined): ChartDataPoint[] => {
    if (!metrics || metrics.length === 0) {
      return generateFallbackData(timeframe);
    }
    
    // Group metrics by time period (hour, day, or week)
    const groupedData = new Map<string, number>();
    
    metrics.forEach((metric) => {
      const date = new Date(metric.timestamp);
      let timeKey: string;
      
      if (timeframe === "day") {
        // Group by hour
        timeKey = `${date.getHours().toString().padStart(2, "0")}:00`;
      } else if (timeframe === "week") {
        // Group by day
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        timeKey = days[date.getDay()];
      } else {
        // Group by week for month view
        const weekOfMonth = Math.ceil((date.getDate() + (new Date(date.getFullYear(), date.getMonth(), 1).getDay())) / 7);
        timeKey = `Week ${weekOfMonth}`;
      }
      
      // Increment the count for this time period
      groupedData.set(timeKey, (groupedData.get(timeKey) || 0) + 1);
    });
    
    // Convert the map to an array of data points
    const result: ChartDataPoint[] = [];
    
    if (timeframe === "day") {
      // Ensure all 24 hours are represented
      for (let i = 0; i < 24; i++) {
        const hour = `${i.toString().padStart(2, "0")}:00`;
        result.push({
          time: hour,
          updates: groupedData.get(hour) || 0
        });
      }
    } else if (timeframe === "week") {
      // Ensure all 7 days are represented
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      days.forEach(day => {
        result.push({
          time: day,
          updates: groupedData.get(day) || 0
        });
      });
    } else {
      // For month, ensure all weeks are represented
      for (let i = 1; i <= 4; i++) {
        const week = `Week ${i}`;
        result.push({
          time: week,
          updates: groupedData.get(week) || 0
        });
      }
    }
    
    return result;
  };
  
  // Generate fallback data when no metrics are available
  const generateFallbackData = (timeframe: string): ChartDataPoint[] => {
    const data: ChartDataPoint[] = [];
    
    if (timeframe === "day") {
      // Generate hourly data for a day
      for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, "0") + ":00";
        data.push({
          time: hour,
          updates: 0,
        });
      }
    } else if (timeframe === "week") {
      // Generate daily data for a week
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      for (let i = 0; i < 7; i++) {
        data.push({
          time: days[i],
          updates: 0,
        });
      }
    } else if (timeframe === "month") {
      // Generate weekly data for a month
      for (let i = 1; i <= 4; i++) {
        data.push({
          time: `Week ${i}`,
          updates: 0,
        });
      }
    }
    
    return data;
  };
  
  // Process the metrics data for the chart
  const chartData = transformMetricsToChartData(metricsData);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={320}>
        {timeframe === "day" ? (
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 12 }} 
              tickFormatter={(value) => value.split(":")[0]}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip 
              formatter={(value) => [`${value} updates`, "Updates"]}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Bar 
              dataKey="updates" 
              name="DNS Updates" 
              fill="hsl(var(--primary))" 
              radius={[4, 4, 0, 0]} 
            />
          </BarChart>
        ) : (
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip 
              formatter={(value) => [`${value} updates`, "Updates"]}
              labelFormatter={(label) => `${label}`}
            />
            <Line 
              type="monotone" 
              dataKey="updates" 
              name="DNS Updates" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
