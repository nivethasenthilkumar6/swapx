import React from 'react';
import { ArrowUpRight, Activity, DollarSign, Layers } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, isPositive, icon }) => (
  <div className="bg-card border border-border p-6 flex flex-col relative overflow-hidden">
    <div className="absolute top-0 right-0 p-4 text-muted-foreground/10">
      {icon}
    </div>
    
    <div className="flex items-center gap-2 mb-4 text-muted-foreground z-10">
      <span className="text-sm font-medium uppercase tracking-wider">{title}</span>
    </div>
    
    <div className="text-3xl font-bold mb-2 z-10">{value}</div>
    
    <div className={`flex items-center text-sm font-medium z-10 ${isPositive ? 'text-green-500' : 'text-destructive'}`}>
      <ArrowUpRight className="w-4 h-4 mr-1" />
      {change}
    </div>
  </div>
);

interface AnalyticsCardsProps {
  totalTvl: string;
  poolsCount: number;
}

const AnalyticsCards: React.FC<AnalyticsCardsProps> = ({ totalTvl, poolsCount }) => {
  const formattedTvl = parseFloat(totalTvl) > 0
    ? `$${(parseFloat(totalTvl)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-8">
      <StatCard 
        title="Total Value Locked" 
        value={formattedTvl} 
        change="Live Sepolia TVL" 
        isPositive={true}
        icon={<Layers className="w-24 h-24" />}
      />
      <StatCard 
        title="Active Pools" 
        value={poolsCount.toString()} 
        change="On-chain pairs" 
        isPositive={true}
        icon={<Activity className="w-24 h-24" />}
      />
      <StatCard 
        title="Protocol Fees" 
        value="0.30%" 
        change="Standard Swap Fee" 
        isPositive={true}
        icon={<DollarSign className="w-24 h-24" />}
      />
    </div>
  );
};

export default AnalyticsCards;
