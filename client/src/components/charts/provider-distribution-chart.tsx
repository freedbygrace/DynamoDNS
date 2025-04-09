import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Cloud, Home, CircleHelp } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

export function ProviderDistributionChart() {
  // This would be a real API query in a production app
  // For this MVP, we'll generate sample data
  
  // In a real app, this would fetch data from the API
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["/api/metrics/provider-distribution"],
    queryFn: async () => generateSampleData(),
    // Keep data fresh for 5 minutes
    staleTime: 5 * 60 * 1000,
  });
  
  // Generate sample data
  // In a real application, this would come from the API
  const generateSampleData = () => {
    return [
      { name: "Cloudflare", value: 45, color: "hsl(var(--primary))" },
      { name: "Route53", value: 30, color: "hsl(var(--success))" },
      { name: "GoDaddy", value: 15, color: "hsl(var(--warning))" },
      { name: "Others", value: 10, color: "hsl(var(--destructive))" },
    ];
  };

  // Simple icon renderer for the legend
  const renderCustomizedLegend = (props: any) => {
    const { payload } = props;
    
    return (
      <ul className="flex flex-col space-y-2 mt-2">
        {payload.map((entry: any, index: number) => (
          <li key={`item-${index}`} className="flex items-center">
            <div
              className="w-3 h-3 rounded-sm mr-2"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm">{entry.value} ({entry.payload.value}%)</span>
          </li>
        ))}
      </ul>
    );
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
        <h3 className="text-lg font-semibold mb-4">DNS Provider Distribution</h3>
        <div className="h-64 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                innerRadius={40}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => [`${value}%`, "Percentage"]}
              />
              <Legend content={renderCustomizedLegend} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
