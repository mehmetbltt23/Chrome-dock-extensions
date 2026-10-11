import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '../../styles/global.css';
import { DockTabsError } from '../../domain/errors';

const root = document.getElementById('root');
if (root === null) throw new DockTabsError('BOOT_FAILED', 'DockTabs settings root element is missing.');
createRoot(root).render(<StrictMode><App /></StrictMode>);
