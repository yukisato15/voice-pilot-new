import { configureStore } from '@reduxjs/toolkit';

import { sessionReducer } from './slices/sessionSlice';
import { uiReducer } from './slices/uiSlice';
import { configReducer } from './slices/configSlice';

export const store = configureStore({
  reducer: {
    session: sessionReducer,
    ui: uiReducer,
    config: configReducer,
  },
  devTools: import.meta.env?.DEV ?? false,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export * from './types';
