import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export function RecordTypeChart() {
  // This would be a real API query in a production app
  // For this MVP, we'll generate sample data
  
  // In a real app, this would fetch data from the API
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["/api/metrics/record-type-distribution"],
    queryFn: async () => generateSampleData(),
    // Keep data fresh for 5 minutes
    staleTime: 5 * 60 * 1000,
  });
  
  // Generate sample data
  // In a real application, this would come from the API
  const generateSampleData = () => {
    return [
      { name: "A", count: 70 },
      { name: "AAAA", count: 20 },
      { name: "CNAME", count: 45 },
      { name: "MX", count: 25 },
      { name: "TXT", count: 15 },
      { name: "SRV", count: 10 },
      { name: "Other", count: 5 },
    ];
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
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold mb-4">Record Type Distribution</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis 
                dataKey="name" 
                type="category" 
                tick={{ fontSize: 12 }} 
                width={40} 
              />
              <Tooltip 
                formatter={(value) => [`${value} records`, "Count"]}
                labelFormatter={(label) => `${label} Records`}
              />
              <Bar 
                dataKey="count" 
                name="Record Count" 
                fill="hsl(var(--primary))" 
                radius={[0, 4, 4, 0]} 
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
