import React, { useMemo } from 'react';
import DirectorConsole from '@components/DirectorConsole';
import SharedStage from '@components/SharedStage';
import { useSessionTimerBridge } from '@renderer/hooks/useSessionTimerBridge';
import { useConfigBridge } from '@renderer/hooks/useConfigBridge';

const App: React.FC = () => {
  useSessionTimerBridge();
  useConfigBridge();

  const mode = useMemo(() => {
    const hash = window.location.hash?.replace(/^#/, '');
    if (hash === 'stage') {
      return 'stage';
    }
    return 'console';
  }, []);

  if (mode === 'stage') {
    return <SharedStage />;
  }

  return <DirectorConsole />;
};

export default App;
