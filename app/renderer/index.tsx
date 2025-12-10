import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';

import App from './app';
import { store } from '@store';

const container = document.getElementById('root');

if (!container) {
  throw new Error('root element not found');
}

ReactDOM.createRoot(container).render(
  <Provider store={store}>
    <App />
  </Provider>,
);
