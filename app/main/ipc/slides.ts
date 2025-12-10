import { dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

type SampleSlideDefinition = {
  title: string;
  subtitle: string;
  accent: string;
};

type SlideDeckResponse = {
  id: string;
  title: string;
  images: string[];
  generatedAt: string;
  sourcePath?: string;
  notes?: string;
};

const createSvgSlide = ({ title, subtitle, accent }: SampleSlideDefinition): string => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.95"/>
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0.85"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="1280" height="720" fill="url(#bg)" />
      <g fill="#ffffff">
        <text x="80" y="220" font-size="72" font-family="sans-serif" font-weight="700">${title}</text>
        <text x="80" y="320" font-size="36" font-family="sans-serif" font-weight="400">${subtitle}</text>
      </g>
      <circle cx="1180" cy="620" r="60" fill="#ffffff" fill-opacity="0.12" />
      <circle cx="1120" cy="560" r="40" fill="#ffffff" fill-opacity="0.08" />
    </svg>
  `;
  return `data:image/svg+xml;base64,${Buffer.from(svg.trim()).toString('base64')}`;
};

const SAMPLE_DECK: SlideDeckResponse = {
  id: 'sample-guide',
  title: 'ガイダンススライド（サンプル）',
  generatedAt: new Date().toISOString(),
  notes: 'LibreOffice が未設定の環境向けの仮スライドです。',
  images: [
    createSvgSlide({
      title: 'Zoom 録画を開始してください',
      subtitle: '録音ランプの点灯を必ず確認しましょう。',
      accent: '#6366f1',
    }),
    createSvgSlide({
      title: '3 秒間の無音を保ちましょう',
      subtitle: '「スタート」の指示後に会話を開始します。',
      accent: '#22d3ee',
    }),
    createSvgSlide({
      title: '終了したら STOP を押してください',
      subtitle: '録音ファイルを確認し、チャットで共有します。',
      accent: '#f97316',
    }),
  ],
};

export const registerSlidesHandlers = (): void => {
  ipcMain.removeHandler('slides/load-sample');
  ipcMain.handle('slides/load-sample', async (): Promise<SlideDeckResponse> => {
    return {
      ...SAMPLE_DECK,
      generatedAt: new Date().toISOString(),
    };
  });

  ipcMain.removeHandler('slides/import-directory');
  ipcMain.handle('slides/import-directory', async (): Promise<SlideDeckResponse | null> => {
    const result = await dialog.showOpenDialog({
      title: 'スライド画像フォルダを選択',
      properties: ['openDirectory', 'createDirectory'],
      message: 'PowerPoint の「エクスポート > 画像」で生成したフォルダを指定してください。',
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const directory = result.filePaths[0];
    const deck = await loadDirectoryAsSlides(directory);
    return deck;
  });
};

const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const loadDirectoryAsSlides = async (directory: string): Promise<SlideDeckResponse> => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base',
      }),
    );

  if (files.length === 0) {
    throw new Error('選択したフォルダに PNG / JPG / WEBP 画像が見つかりませんでした。');
  }

  const images = await Promise.all(
    files.map(async (entry) => {
      const filePath = path.join(directory, entry.name);
      const data = await fs.readFile(filePath);
      const ext = path.extname(entry.name).toLowerCase();
      const mime = ext === '.jpg' ? 'jpeg' : ext.slice(1);
      return `data:image/${mime};base64,${data.toString('base64')}`;
    }),
  );

  return {
    id: `deck-${path.basename(directory)}-${Date.now()}`,
    title: path.basename(directory),
    images,
    generatedAt: new Date().toISOString(),
    sourcePath: directory,
    notes: `フォルダから ${files.length} 枚のスライドを読み込みました。`,
  };
};
