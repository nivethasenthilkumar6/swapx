import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap, Shield, BarChart3 } from 'lucide-react';

const LandingPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center flex-1 bg-background px-4 py-16">
      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 border border-primary/30 bg-primary/10 text-primary text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Live on Sepolia Testnet
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
          Swap Tokens<br />
          <span className="text-primary">Instantly.</span>
        </h1>

        <p className="text-lg text-muted-foreground mb-10 max-w-lg mx-auto">
          SwapX is a decentralized exchange powered by Uniswap V2 on Sepolia.
          Fast, trustless, and non-custodial.
        </p>

        <Link
          to="/trade"
          id="landing-launch-btn"
          className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 transition-all active:scale-[0.98] group"
        >
          Launch App
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full mt-4">
        {[
          {
            icon: <Zap className="w-6 h-6 text-primary" />,
            title: 'Instant Swaps',
            desc: 'Swap ERC-20 tokens in seconds with on-chain Uniswap V2 liquidity.',
          },
          {
            icon: <Shield className="w-6 h-6 text-primary" />,
            title: 'Non-Custodial',
            desc: 'Your keys, your tokens. Smart contracts handle everything on-chain.',
          },
          {
            icon: <BarChart3 className="w-6 h-6 text-primary" />,
            title: 'Live Prices',
            desc: 'Real-time token prices powered by CoinGecko and on-chain reserves.',
          },
        ].map((f) => (
          <div
            key={f.title}
            className="bg-card border border-border p-6 hover:border-primary/40 transition-colors"
          >
            <div className="mb-3">{f.icon}</div>
            <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LandingPage;
