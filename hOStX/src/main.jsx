
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from '@/App';
import '@/index.css';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { DeskProvider } from '@/contexts/DeskContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <DeskProvider>
            <App />
          </DeskProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  </>
);
