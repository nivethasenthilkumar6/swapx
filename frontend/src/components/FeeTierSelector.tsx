import React from 'react';
import { FEE_TIERS } from '../../../shared/constants';

interface FeeTierSelectorProps {
  selectedFee: number;
  onSelect: (fee: number) => void;
}

const FeeTierSelector: React.FC<FeeTierSelectorProps> = ({ selectedFee, onSelect }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {FEE_TIERS.map((tier) => (
        <button
          key={tier.value}
          onClick={() => onSelect(tier.value)}
          className={`p-3 border text-left transition-colors ${
            selectedFee === tier.value
              ? 'border-primary bg-primary/10'
              : 'border-border bg-background hover:border-primary/50'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold">{tier.label}</span>
            {selectedFee === tier.value && (
              <div className="w-2 h-2 rounded-full bg-primary" />
            )}
          </div>
          <div className="text-xs text-muted-foreground line-clamp-2">
            {tier.description}
          </div>
        </button>
      ))}
    </div>
  );
};

export default FeeTierSelector;
