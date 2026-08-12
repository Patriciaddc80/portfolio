import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Replace with the actual event id (e.g. from route params or a picker screen).
const DEMO_EVENT_ID = 'REPLACE_WITH_EVENT_ID';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App eventId={DEMO_EVENT_ID} />
  </React.StrictMode>
);
