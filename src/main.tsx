import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { initAppUpdater } from './utils/appUpdater';
import './index.css';

initAppUpdater();

createRoot(document.getElementById('root')!).render(<App />);
