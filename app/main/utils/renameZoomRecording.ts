import { rename, stat } from 'node:fs/promises';
import path from 'node:path';

import slugify from 'slugify';

import { getConfig, type AppConfig, updateConfig } from '../config/store';

export type RenameMetadata = {
  projectCode: string;
  pairId: string;
  segmentCounter: number;
  themeId?: string | null;
  themeTitle?: string | null;
  channel?: string | null;
};

export const renameZoomRecording = async (
  filePath: string,
  metadata: RenameMetadata,
) => {
  const config = getConfig();
  const absolute = path.resolve(filePath);
  const dir = path.dirname(absolute);
  const ext = path.extname(absolute);

  const fileStats = await stat(absolute);
  const recordedAt = fileStats.mtime ?? new Date();
  const datePrefix = formatDate(recordedAt);

  const projectCode = (metadata.projectCode || config.projectCode || 'PROJECT').trim();
  const pairId = (metadata.pairId || config.pairId || '001').trim();
  const segmentNumber = Math.max(1, metadata.segmentCounter ?? config.segmentCounter ?? 1);
  const themeId = metadata.themeId ?? 'THEME';
  const themeTitle = metadata.themeTitle ?? 'untitled';
  const channel = resolveChannel(metadata.channel, config, filePath);

  const slug = slugify(themeTitle, {
    lower: true,
    strict: true,
    trim: true,
  })
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'untitled';

  const segFormatted = String(segmentNumber).padStart(2, '0');
  const newName = `${datePrefix}_${projectCode}_${pairId}_${segFormatted}_${themeId}_${slug}_${channel}${ext}`;
  let newPath = path.join(dir, newName);

  try {
    await rename(absolute, newPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') {
      const uniqueName = `${datePrefix}_${projectCode}_${pairId}_${segFormatted}_${themeId}_${slug}_${channel}_${Date.now()}${ext}`;
      newPath = path.join(dir, uniqueName);
      await rename(absolute, newPath);
    } else {
      throw error;
    }
  }

  const nextConfig = updateConfig({
    lastChannel: channel,
    lastRenameAt: new Date().toISOString(),
    projectCode,
    pairId,
  });

  return {
    newPath,
    config: nextConfig,
  };
};

const formatDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const resolveChannel = (
  requested: string | null | undefined,
  config: AppConfig,
  filePath: string,
): 'A' | 'B' => {
  const direct = normalizeChannel(requested);
  if (direct) {
    return direct;
  }

  const lower = filePath.toLowerCase();
  if (lower.includes('_mic_1') || lower.includes('_speaker_view') || lower.includes('_a')) {
    return 'A';
  }
  if (lower.includes('_mic_2') || lower.includes('_gallery_view') || lower.includes('_b')) {
    return 'B';
  }

  const last = config.lastChannel ?? 'B';
  return last === 'A' ? 'B' : 'A';
};

const normalizeChannel = (value: string | null | undefined): 'A' | 'B' | null => {
  if (!value) {
    return null;
  }
  const upper = value.trim().toUpperCase();
  return upper === 'A' || upper === 'B' ? upper : null;
};
