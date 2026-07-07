import React from 'react';
import SwapCard from '../components/SwapCard';
import { SwapProvider } from '../context/SwapContext';

const TradePage: React.FC = () => {
  return (
    <SwapProvider>
      <div className="flex justify-center items-start pt-16 px-4">
        <SwapCard />
      </div>
    </SwapProvider>
  );
};

export default TradePage;
