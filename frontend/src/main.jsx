import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import FiletErreur from './components/ui/FiletErreur';
import { installerSignalement } from './lib/signalement';
import './styles/index.css';

installerSignalement();

const client = new QueryClient({
  defaultOptions: {
    queries: { retry: (n, e) => n < 2 && !(e?.status >= 400 && e?.status < 500), refetchOnWindowFocus: false },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <FiletErreur>
          <App />
        </FiletErreur>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
