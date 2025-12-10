import { useCallback, useEffect, useRef } from 'react';

import { useAppDispatch, useAppSelector } from '@store/hooks';
import { mergeConfig } from '@store/slices/configSlice';
import { setRecordingDetail, setRecordingStatus, setZoomRecordingDir } from '@store/slices/uiSlice';

type ZoomWatcherStatus = {
  state: 'idle' | 'recording' | 'converting' | 'ready' | 'error';
  path?: string;
  file?: string;
  bytes?: number;
  error?: string;
};

type SelectDirectoryResult = {
  directory: string;
  status: ZoomWatcherStatus | null;
};

export const useZoomWatcher = (): {
  selectDirectory: () => Promise<void>;
  restartWatcher: (directory: string | null) => Promise<void>;
} => {
  const dispatch = useAppDispatch();
  const zoomDir = useAppSelector((state) => state.ui.zoomRecordingDir);
  const config = useAppSelector((state) => state.config);
  const session = useAppSelector((state) => state.session);
  const statusRef = useRef<ZoomWatcherStatus | null>(null);
  const processedFilesRef = useRef(new Set<string>());
  const channelCounterRef = useRef(0);

  const requestRename = useCallback(
    async (status: ZoomWatcherStatus) => {
      if (!status.file || !status.path || !window?.directorAPI?.invoke) {
        return;
      }

      const key = status.file;
      if (processedFilesRef.current.has(key)) {
        return;
      }
      processedFilesRef.current.add(key);

      const channelIndex = channelCounterRef.current;
      const channel = String.fromCharCode('A'.charCodeAt(0) + channelIndex);
      channelCounterRef.current += 1;

      const payload = {
        file: status.file,
        path: status.path,
        metadata: {
          projectCode: config.projectCode,
          pairId: config.pairId,
          segmentCounter: config.segmentCounter,
          themeId: session.currentTheme?.id ?? null,
          themeTitle: session.currentTheme?.title ?? null,
          channel,
        },
      };

      try {
        const result = (await window.directorAPI.invoke('zoom/rename', payload)) as
          | null
          | {
              newPath?: string;
              config?: typeof config;
              error?: string;
            };
        if (result?.error) {
          console.error('rename failed:', result.error);
          processedFilesRef.current.delete(key);
          return;
        }
        if (result?.config) {
          dispatch(mergeConfig(result.config));
        }
        if (result?.newPath) {
          dispatch(
            setRecordingDetail({
              state: 'stopped',
              file: result.newPath,
              path: status.path,
              bytes: status.bytes,
              updatedAt: new Date().toISOString(),
            }),
          );
        }
      } catch (error) {
        console.error('rename failed', error);
        processedFilesRef.current.delete(key);
      }
    },
    [config, dispatch, session.currentTheme?.id, session.currentTheme?.title],
  );

  const updateStatus = useCallback(
    (status: ZoomWatcherStatus | null) => {
      statusRef.current = status;
      if (!status) {
        dispatch(setRecordingDetail(null));
        return;
      }

      const nextState = mapState(status.state);
      dispatch(
        setRecordingDetail({
          state: nextState,
          file: status.file,
          path: status.path,
          bytes: status.bytes,
          updatedAt: new Date().toISOString(),
        }),
      );

      if (status.state === 'error' && status.error) {
        console.error('Zoom watcher error:', status.error);
        dispatch(setRecordingStatus('unknown'));
      }

      if (status.state === 'ready') {
        void requestRename(status);
      }
    },
    [dispatch, requestRename],
  );

  const restartWatcher = useCallback(
    async (directory: string | null) => {
      if (!window?.directorAPI?.invoke) {
        return;
      }
      if (!directory) {
        dispatch(setZoomRecordingDir(null));
        dispatch(setRecordingDetail(null));
        await window.directorAPI.invoke('zoom/watch-stop');
        void window.directorAPI.invoke('config/update', { zoomRecordingDir: null });
        processedFilesRef.current.clear();
        channelCounterRef.current = 0;
        return;
      }
      dispatch(setZoomRecordingDir(directory));
      void window.directorAPI.invoke('config/update', { zoomRecordingDir: directory });
      processedFilesRef.current.clear();
      channelCounterRef.current = 0;
      const result = (await window.directorAPI.invoke('zoom/watch-start', directory)) as
        | ZoomWatcherStatus
        | null
        | undefined;
      updateStatus(result ?? null);
    },
    [dispatch, updateStatus],
  );

  const selectDirectory = useCallback(async () => {
    if (!window?.directorAPI?.invoke) {
      return;
    }
    const result = (await window.directorAPI.invoke(
      'zoom/select-recording-dir',
    )) as SelectDirectoryResult | null;
    if (result?.directory) {
      await restartWatcher(result.directory);
      if (result.status) {
        updateStatus(result.status);
      }
      void window.directorAPI.invoke('config/update', { zoomRecordingDir: result.directory });
    }
  }, [restartWatcher, updateStatus]);

  useEffect(() => {
    if (!window?.directorAPI?.on) {
      return;
    }

    const offStatus = window.directorAPI.on('zoom/status', (_event, payload) => {
      updateStatus(payload as ZoomWatcherStatus);
    });

    if (window.directorAPI.invoke) {
      void window.directorAPI.invoke('zoom/status-current').then((status) => {
        updateStatus(status as ZoomWatcherStatus | null);
      });
    }

    return () => {
      offStatus?.();
    };
  }, [updateStatus]);

  useEffect(() => {
    if (zoomDir) {
      void restartWatcher(zoomDir);
    }
  }, [restartWatcher, zoomDir]);

  return { selectDirectory, restartWatcher };
};

const mapState = (value: ZoomWatcherStatus['state']): 'idle' | 'recording' | 'converting' | 'stopped' | 'unknown' => {
  switch (value) {
    case 'idle':
      return 'idle';
    case 'recording':
      return 'recording';
    case 'converting':
      return 'converting';
    case 'ready':
      return 'stopped';
    default:
      return 'unknown';
  }
};
