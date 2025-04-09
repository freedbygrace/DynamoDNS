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

interface DnsUpdateChartProps {
  timeframe?: string;
  domainId?: number;
}

export function DnsUpdateChart({ 
  timeframe = "day",
  domainId 
}: DnsUpdateChartProps) {
  // This would be a real API query in a production app
  // For this MVP, we'll generate sample data
  
  // Create a query key that includes the timeframe and domainId
  const queryKey = ["/api/metrics/dns-updates", timeframe, domainId];
  
  // In a real app, this would fetch data from the API
  const { data: chartData, isLoading } = useQuery({
    queryKey,
    queryFn: async () => generateSampleData(timeframe),
    // Keep data fresh for 5 minutes
    staleTime: 5 * 60 * 1000,
  });
  
  // Generate sample data based on timeframe
  // In a real application, this would come from the API
  const generateSampleData = (timeframe: string) => {
    const data = [];
    
    if (timeframe === "day") {
      // Generate hourly data for a day
      for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, "0") + ":00";
        const updateCount = Math.floor(Math.random() * 10) + 1;
        data.push({
          time: hour,
          updates: updateCount,
        });
      }
    } else if (timeframe === "week") {
      // Generate daily data for a week
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      for (let i = 0; i < 7; i++) {
        const updateCount = Math.floor(Math.random() * 50) + 10;
        data.push({
          time: days[i],
          updates: updateCount,
        });
      }
    } else if (timeframe === "month") {
      // Generate weekly data for a month
      for (let i = 1; i <= 4; i++) {
        const updateCount = Math.floor(Math.random() * 200) + 50;
        data.push({
          time: `Week ${i}`,
          updates: updateCount,
        });
      }
    }
    
    return data;
  };

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
