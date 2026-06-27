import React from 'react';
import ReactDOM from 'react-dom/client';
import Home from './App.tsx';
import './index.css';
import 'uplot/dist/uPlot.min.css';
import 'react-toastify/dist/ReactToastify.css';
import ConvexClientProvider from './components/ConvexClientProvider.tsx';
import SandBookSplash from './components/SandBookSplash.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConvexClientProvider>
      <Home />
    </ConvexClientProvider>
    {/* 《沙之书》开屏 —— 仅首次访问，覆盖在应用之上自管理 */}
    <SandBookSplash />
  </React.StrictMode>,
);
