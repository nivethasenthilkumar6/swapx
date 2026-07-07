import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import TradePage from './pages/TradePage';
import PoolPage from './pages/PoolPage';
import AnalyticsPage from './pages/AnalyticsPage';
import NotFoundPage from './pages/NotFoundPage';
import Navbar from './components/Navbar';
import NetworkWarning from './components/NetworkWarning';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <NetworkWarning />
        <Navbar />
        <main className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/trade" element={<TradePage />} />
            <Route path="/pool" element={<PoolPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
