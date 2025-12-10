(() => {
  const config = window.APP_CONFIG || {};
  const defaultDurationSeconds = Number(config.durationSeconds) || 3600;
  const DEFAULT_SETTINGS = {
    durationMinutes: Math.max(1, Math.round(defaultDurationSeconds / 60)),
    startCountdown: 3,
    finishCountdown: 5,
    finishHold: 5,
    breakDurationMinutes: 5,
  };
  const SETTINGS_STORAGE_KEY = "recpilot-control-settings-v1";
  let settings = loadSettings();
  let durationSeconds = Math.max(1, settings.durationMinutes) * 60;
  let remainingSeconds = durationSeconds;
  let timerInterval = null;
  let isRunning = false;

  const timerDisplay = document.getElementById("timer-display");
  const timerStatus = document.getElementById("timer-status");
  const currentTimecode = document.getElementById("current-timecode");

  const startBtn = document.getElementById("start-btn");
  const stopBtn = document.getElementById("stop-btn");
  const resetBtn = document.getElementById("reset-btn");

  const themeTotalLabel = document.getElementById("theme-total");
  const themeRemainingLabel = document.getElementById("theme-remaining");
  const themeTotalHeaderLabel = document.getElementById("theme-total-header");
  const categoryGrid = document.getElementById("theme-category-grid");
  const themePreviewCategory = document.getElementById("theme-preview-category");
  const themePreviewTitle = document.getElementById("theme-preview-title");
  const themePreviewHints = document.getElementById("theme-preview-hints");
  const themePreviewAlerts = document.getElementById("theme-preview-alerts");
  const themeSelectionMeta = document.getElementById("theme-selection-meta");
  const toggleThemePanelBtn = document.getElementById("toggle-theme-panel");
  const themePanelIndicator = document.getElementById("theme-panel-indicator");
  const themeClearButton = document.getElementById("theme-clear-button");
  const themeHistoryButton = document.getElementById("theme-history-button");
  const themePopover = document.getElementById("theme-popover");
  const themePanelIndicatorIcon = document.getElementById("theme-panel-indicator-icon");
  const hintBaseBtn = document.getElementById("hint-base-btn");
  const hintExtra1Btn = document.getElementById("hint-extra1-btn");
  const hintExtra2Btn = document.getElementById("hint-extra2-btn");

  const toggleTemplatePanelBtn = document.getElementById("toggle-template-panel");
  const templatePanelIndicator = document.getElementById("template-panel-indicator");
  const templatePanelIndicatorIcon = document.getElementById("template-panel-indicator-icon");
  const templateCategoryGrid = document.getElementById("template-category-grid");
  const templatePopover = document.getElementById("template-popover");

  const promptButtonsWrapper = document.getElementById("prompt-buttons");
  const lastPromptLabel = document.getElementById("last-prompt");
  const customPromptInput = document.getElementById("custom-prompt");
  const sendCustomPromptBtn = document.getElementById("send-custom-prompt");
  const clearPromptBtn = document.getElementById("clear-prompt");
  const screenAttentionBtn = document.getElementById("screen-attention-btn");

  const cannedMessageModal = document.getElementById("canned-message-modal");
  const cannedMessagePreview = document.getElementById("canned-message-preview");
  const cannedMessageSend = document.getElementById("canned-message-send");
  const cannedMessageClose = document.getElementById("canned-message-close");
  const cannedCheckA = document.getElementById("canned-check-a");
  const cannedCheckB = document.getElementById("canned-check-b");
  const cannedLabelA = document.getElementById("canned-label-a");
  const cannedLabelB = document.getElementById("canned-label-b");

  const noteForm = document.getElementById("note-form");
  const notesTableBody = document.getElementById("notes-table");
  const categorySelect = document.getElementById("select-category");
  const categoryOtherWrapper = document.getElementById("category-other-wrapper");
  const inputCategoryOther = document.getElementById("input-category-other");
  const captureNoteBtn = document.getElementById("capture-note");
  const inputContent = document.getElementById("input-content");
  const noteActionBtn = document.getElementById("note-action-btn");
  const cancelNoteBtn = document.getElementById("cancel-note");
  const contentWrapper = document.getElementById("content-wrapper");
  const toggleContentBtn = document.getElementById("toggle-content");

  const finishBtn = document.getElementById("finish-btn");
  const exportSummaryBtn = document.getElementById("export-summary-btn");
  const finishModal = document.getElementById("finish-modal");
  const finishForm = document.getElementById("finish-form");
  const finishGroup = document.getElementById("finish-group");
  const finishSession = document.getElementById("finish-session");
  const finishSummary = document.getElementById("finish-summary");
  const finishCancel = document.getElementById("finish-cancel");
  const syncModal = document.getElementById("sync-modal");
  const syncConfirmBtn = document.getElementById("sync-confirm-btn");
  const syncCancelBtn = document.getElementById("sync-cancel-btn");
  const stopRecordingModal = document.getElementById("stop-recording-modal");
  const stopRecordingConfirmBtn = document.getElementById("stop-recording-confirm");
  const postSessionModal = document.getElementById("post-session-modal");
  const postSessionForm = document.getElementById("post-session-form");
  const postSessionNoteInput = document.getElementById("post-session-note");
  const postSessionSkipBtn = document.getElementById("post-session-skip");
  const finalExportModal = document.getElementById("final-export-modal");
  const finalExportForm = document.getElementById("final-export-form");
  const finalExportFilesInput = document.getElementById("final-export-files");
  const finalExportFileList = document.getElementById("final-export-filelist");
  const finalExportCancelBtn = document.getElementById("final-export-cancel");
  const finalExportSubmitBtn = document.getElementById("final-export-submit");
  const breakBtn = document.getElementById("break-btn");
  const breakCancelBtn = document.getElementById("break-cancel-btn");
  const offsetStatusLabel = document.getElementById("offset-status-label");
  const offsetSourceBadge = document.getElementById("offset-source-badge");
  const offsetAutoValue = document.getElementById("offset-auto-value");
  const offsetManualValue = document.getElementById("offset-manual-value");
  const offsetEffectiveValue = document.getElementById("offset-effective-value");
  const offsetMonitoringPath = document.getElementById("offset-monitoring-path");
  const offsetLastRecording = document.getElementById("offset-last-recording");
  const offsetManualForm = document.getElementById("offset-manual-form");
  const offsetManualInput = document.getElementById("offset-manual-input");
  const offsetManualClearBtn = document.getElementById("offset-manual-clear");
  const offsetRefreshBtn = document.getElementById("offset-refresh-btn");
  const hasOffsetUi =
    Boolean(offsetStatusLabel) ||
    Boolean(offsetSourceBadge) ||
    Boolean(offsetAutoValue) ||
    Boolean(offsetManualValue) ||
    Boolean(offsetEffectiveValue) ||
    Boolean(offsetManualForm);

  const zoomShareModal = document.getElementById("zoom-share-modal");
  const zoomShareConfirm = document.getElementById("zoom-share-confirm");

  const setupModal = document.getElementById("setup-modal");
  const setupForm = document.getElementById("setup-form");
  const setupGroup = document.getElementById("setup-group");
  const setupSession = document.getElementById("setup-session");
  const setupDirector = document.getElementById("setup-director");
  const setupParticipantA = document.getElementById("setup-participant-a");
  const setupParticipantB = document.getElementById("setup-participant-b");
  const openSetupBtn = document.getElementById("open-setup");
  const summaryGroup = document.getElementById("summary-group");
  const summarySession = document.getElementById("summary-session");
  const summaryDirector = document.getElementById("summary-director");
  const summaryParticipants = document.getElementById("summary-participants");
  const sessionLengthLabel = document.getElementById("session-length-label");

  const settingsModal = document.getElementById("settings-modal");
  const settingsForm = document.getElementById("settings-form");
  const openSettingsBtn = document.getElementById("open-settings");
  const settingsCancel = document.getElementById("settings-cancel");
  const settingsReset = document.getElementById("settings-reset");
  const settingsDurationInput = document.getElementById("settings-duration");
  const settingsStartCountdownInput = document.getElementById("settings-start-countdown");
  const settingsFinishCountdownInput = document.getElementById("settings-finish-countdown");
  const settingsFinishHoldInput = document.getElementById("settings-finish-hold");
  const settingsBreakDurationInput = document.getElementById("settings-break-duration");
  const settingsTabs = document.querySelectorAll(".settings-tab");
  const reloadThemesBtn = document.getElementById("reload-themes-btn");
  const adminPasswordInput = document.getElementById("admin-password");
  const resetThemeHistoryCheckbox = document.getElementById("reset-theme-history");

  // 固定メッセージ関連
  const cannedMessagesList = document.getElementById("canned-messages-list");
  const cannedMessageCount = document.getElementById("canned-message-count");
  const newCannedMessageInput = document.getElementById("new-canned-message-input");
  const addCannedMessageBtn = document.getElementById("add-canned-message-btn");
  const saveCannedMessagesBtn = document.getElementById("save-canned-messages-btn");
  const resetCannedMessagesBtn = document.getElementById("reset-canned-messages-btn");

  // 記録カテゴリ関連
  const reportCategoriesList = document.getElementById("report-categories-list");
  const reportCategoryCount = document.getElementById("report-category-count");
  const newReportCategoryInput = document.getElementById("new-report-category-input");
  const addReportCategoryBtn = document.getElementById("add-report-category-btn");
  const saveReportCategoriesBtn = document.getElementById("save-report-categories-btn");
  const resetReportCategoriesBtn = document.getElementById("reset-report-categories-btn");

  // 画面注目設定関連
  const attentionDurationInput = document.getElementById("attention-duration");
  const attentionMessageInput = document.getElementById("attention-message");
  const saveAttentionSettingsBtn = document.getElementById("save-attention-settings-btn");
  const resetAttentionSettingsBtn = document.getElementById("reset-attention-settings-btn");

  const socket = io();

  const CATEGORY_GRADIENTS = [
    "from-blue-500 to-cyan-500",
    "from-indigo-500 to-purple-500",
    "from-rose-500 to-pink-500",
    "from-emerald-500 to-teal-500",
    "from-amber-500 to-orange-500",
    "from-sky-500 to-blue-700",
    "from-fuchsia-500 to-violet-500",
    "from-lime-500 to-emerald-500",
    "from-slate-600 to-slate-800",
    "from-red-500 to-amber-500",
  ];
  const CATEGORY_LABEL_OVERRIDES = {
    "食事": "食べ物全般",
    "食べ物": "食べ物全般",
    "飲料・酒": "飲み物・お酒",
    "飲料": "飲み物・お酒",
    "グルメ": "グルメ・外食",
    "自炊": "クッキング",
    "ライフス": "ライフスタイル",
    "ライフスタイル": "ライフスタイル",
    "映画": "映画・ドラマ・アニメ",
    "映画・ドラマ・アニメ": "映画・ドラマ・アニメ",
    "ゲーム": "ゲーム",
    "ゲーム・デジタル娯楽": "ゲーム・デジタル娯楽",
    "記憶と体験": "記憶・体験",
    "記憶と体": "記憶・体験",
    "休みの日": "休日の過ごし方",
    "休みの日の過ごし方": "休日の過ごし方",
    "雑談": "フリーテーマ",
    "日常の小さな楽しみ": "日常",
    "日常の小": "日常",
    "本": "本・マンガ",
    "お金": "ショッピング",
    "お金・買い物": "ショッピング",
  };
  const MARK_BADGES = {
    "underage": { text: "未成年NG", className: "bg-red-100 text-red-600 border border-red-200" },
    "personal-info": { text: "個人情報注意", className: "bg-orange-100 text-orange-600 border border-orange-200" },
  };
  const HINT_GROUP_LABELS = {
    base: "基本ヒント",
    extra1: "ヒント1",
    extra2: "ヒント2",
  };
  const THEME_CHANGE_CATEGORY = "テーマ変更";
  const hintButtonConfig = [
    { element: hintBaseBtn, group: "base" },
    { element: hintExtra1Btn, group: "extra1" },
    { element: hintExtra2Btn, group: "extra2" },
  ];

  // 励ましメッセージ (37パターン)
  const ENCOURAGEMENT_MESSAGES = [
    "会話を楽しんでください😊",
    "雰囲気を楽しんでください〜",
    "ゆっくり話してOKです☺️",
    "自然な感じで大丈夫ですよ◎",
    "無理せずマイペースでどうぞ🍀",
    "相手の話にうなずいてみましょう〜",
    "笑顔でいきましょう😀",
    "話したいことからで大丈夫です♪",
    "一息ついてからでもOKです☕️",
    "共感できるところを探してみましょう〜",
    "少しずつ会話を広げてみましょう🌈",
    "その場の空気を大切にしてみましょう◎",
    "何気ない話題からでもOKですよ🍃",
    "相手の話にリアクションしてみましょう〜",
    "落ち着いてゆったり話してみましょう☘️",
    "素直な気持ちで話してみてください♪",
    "たのしく交流してみましょう✨",
    "その瞬間の会話を楽しんでください〜",
    "ふんわりした雰囲気でいきましょう🌤",
    "お互いの話をゆっくり聞いてみましょう◎",
    "聞き上手になってみましょう👂",
    "思いついたことから話してみてください♪",
    "少し笑ってみましょう😀",
    "楽しい空気でいきましょう✨",
    "穏やかなテンポでどうぞ◎",
    "もし言葉に詰まっても大丈夫ですよ☺️",
    "会話をゆっくり育てていきましょう🌱",
    "ちょっと相槌を意識してみましょう〜",
    "相手の話に「なるほど」と返してみましょう💬",
    "すこし笑顔を意識してみましょう😀",
    "やさしいトーンで話してみましょう🌸",
    "明るい声を意識してみましょう🎵",
    "会話のリズムを感じてみましょう〜",
    "一言添えるように話してみましょう🌿",
    "自然なリアクションを意識してみましょう✨",
    "表情で気持ちを伝えてみましょう☺️",
    "その瞬間をいっしょに楽しみましょう🌸",
  ];

  // パターン別メッセージ (11カテゴリ)
  const TEMPLATE_PROMPTS = {
    "会話が盛り上がっていない時": [
      "気になったことを質問してみましょう",
      "共通点を探してみましょう",
      "最近の出来事を聞いてみましょう",
      "軽いリアクションからつないでみましょう",
      "相手の話に少しうなずいてみましょう",
      "「へぇ」「なるほど」など短い反応を入れてみましょう",
      "何か印象に残ったことを伝えてみましょう",
      "話題を少し広げてみましょう",
      "「それってどういうこと？」と聞いてみましょう",
      "少し笑顔でリアクションしてみましょう",
    ],
    "声が大きすぎて音量が割れている時": [
      "少し声を落として話してみましょう",
      "マイクから少し離れてみましょう",
      "声のトーンを落ち着けてみましょう",
      "声量を控えめにしても大丈夫です",
      "ゆっくり話すと聞きやすくなります",
      "リラックスして落ち着いた声でどうぞ",
      "もう少し優しい声で話してみましょう",
      "そのままでも伝わります、落ち着いてどうぞ",
      "少しテンポをゆるめてみましょう",
      "一度息を整えてから話してみましょう",
    ],
    "会話に詰まってしまった時": [
      "焦らなくて大丈夫です",
      "ゆっくり考えてからでOKですよ",
      "少し間をおいても大丈夫です",
      "言葉を選ぶ時間があっても自然です",
      "無理に続けなくても大丈夫ですよ",
      "一度、思い浮かんだことから話してみましょう",
      "相手の話にのってみるのもOKです",
      "思い出しながら話しても構いません",
      "少し笑ってリセットしてみましょう",
      "落ち着いて呼吸を整えてみましょう",
    ],
    "トラブル発生時（通信・機材・音声）": [
      "一度確認してから再開しましょう",
      "聞こえづらい場合は伝えてOKです",
      "少し待ってから再接続してみましょう",
      "接続が戻ったら教えてください",
      "音声が復旧するまで少し待ちましょう",
      "焦らず落ち着いて対応しましょう",
      "いったんストップして確認してみましょう",
      "機材チェックの時間を取っても大丈夫です",
      "状況を共有して再スタートしましょう",
      "無理せず、ゆっくり再開してOKです",
    ],
    "相手の声が聞き取りづらい時": [
      "もう一度お願いできますか？",
      "少しゆっくり話してもらえると助かります",
      "雑音が入っているかもしれません",
      "マイクの位置を少し調整してみましょう",
      "声が遠いようです、少し近づけてみましょう",
      "聞き取りづらい時は遠慮なく伝えましょう",
      "相手の音声が小さいかもしれません",
      "確認のためにもう一度聞かせてください",
      "通信が不安定なようです",
      "少し静かな環境で話すと聞きやすいです",
    ],
    "話題を切り替えたい時": [
      "次のテーマに移ってみましょう",
      "少し違う話題にしてみましょう",
      "新しい視点から話してみましょう",
      "最近のことを話題にしてもOKです",
      "一度リセットして次の話に行きましょう",
      "流れを変えてみるのも良いですね",
      "相手の興味に合わせてみましょう",
      "軽い雑談に戻してもOKです",
      "共通点がありそうな話題にしてみましょう",
      "会話を次の方向に向けてみましょう",
    ],
    "盛り上がりを引き出したい時": [
      "共感や驚きを少し大きめに表現してみましょう",
      "「わかる！」と反応してみましょう",
      "少しテンションを上げてみましょう",
      "声に抑揚をつけてみましょう",
      "感情をこめて話してみましょう",
      "表情豊かにリアクションしてみましょう",
      "質問を返してみましょう",
      "「それいいですね！」とリアクションしてみましょう",
      "相手の話を褒めてみましょう",
      "テンポを少し上げてみましょう",
    ],
    "協調を促したい時": [
      "相手の意見にうなずいてみましょう",
      "「なるほど」と言葉で返してみましょう",
      "共通の話題を見つけてみましょう",
      "相手の言葉を繰り返してみましょう",
      "賛同できる部分を言葉にしてみましょう",
      "「たしかに」と反応してみましょう",
      "相手を立てる表現を使ってみましょう",
      "少し笑顔を見せてみましょう",
      "自分の意見をやわらかく伝えてみましょう",
      "一緒に考える姿勢を意識してみましょう",
    ],
    "緊張をほぐしたい時": [
      "リラックスしてどうぞ",
      "無理に話さなくても大丈夫ですよ",
      "軽い話題からでOKです",
      "少し笑って気分をゆるめましょう",
      "ゆったり構えて大丈夫です",
      "落ち着いたトーンで話してみましょう",
      "ゆっくり呼吸してから話しましょう",
      "「大丈夫です」と一言伝えてみましょう",
      "会話を楽しむ気持ちを思い出してみましょう",
      "そのままの自分で大丈夫です",
    ],
    "時間が押している時": [
      "少しテンポを上げてみましょう",
      "まとめながら話してみましょう",
      "要点を意識して伝えてみましょう",
      "次の話題に移りましょう",
      "簡潔にまとめてみましょう",
      "あと少しで締めましょう",
      "核心だけを伝えてみましょう",
      "短くリアクションを入れてみましょう",
      "会話をスムーズに終えましょう",
      "残り時間を意識して話してみましょう",
    ],
    "落ち着かせたい時": [
      "少しゆっくり話してみましょう",
      "一度呼吸を整えてみましょう",
      "落ち着いたトーンに戻してみましょう",
      "焦らず丁寧に話してOKです",
      "穏やかなペースでどうぞ",
      "リズムを落ち着けてみましょう",
      "一息入れてみましょう",
      "ゆったり聞き合ってみましょう",
      "慌てずゆっくり再開してみましょう",
      "穏やかな声で話してみましょう",
    ],
  };

  let allThemes = [];
  let themeById = new Map();
  let themesByCategory = new Map();
  let categoryOrder = [];
  let currentThemeId = null;
  const usedThemeIds = new Set();
  const themeHistory = [];
  let currentPopoverCategory = "";
  let activeHintGroup = "base";
  let themePanelExpanded = false;
  let sessionCount = 0; // 何回目のセッションか (1, 2, 3...)
  let encouragementIntervalId = null; // 15秒ごとの励ましメッセージ用
  let postNotificationTimeoutId = null; // 時間通知後の6秒遅延用
  let templatePromptPanelExpanded = false; // パターン別メッセージパネルの開閉状態
  let currentTemplateCategory = null; // 現在開いているパターン別メッセージカテゴリ
  const appState = {
    groupId: "",
    session: "",
    director: "",
    participantA: "",
    participantB: "",
  };
  const finishedTakes = [];
  const sessionSegments = {};
  const segmentByTake = {};
  let currentSegmentId = null;
  let pendingNote = null;
  let pendingRow = null;
  let contentManuallyShown = false;
  let lastPromptMessage = "";
  let preRollActive = false;
  let hasStarted = false;
  let completionSequenceStarted = false;
  const milestoneFlags = new Set();
  let scheduledTimeouts = [];
  let currentCannedMessage = ""; // 現在選択されている固定メッセージ
  let finalMinuteActive = false;
  let finalThirtySecondActive = false;
  let finalCountdownStarted = false;
  let lastCountdownSecondShown = null;
  let finalZeroShown = false;
  let awaitingSyncConfirmation = false;
  let pendingStartShouldReset = false;
  let latestOffsetStatus = null;
  let offsetPollingTimerId = null;
  let breakTimerId = null;
  let breakRemainingSeconds = 0;
  let breakPreviousPrompt = "";
  const OFFSET_POLLING_INTERVAL_MS = 15000;

  function getBreakDurationSeconds() {
    return Math.max(1, settings.breakDurationMinutes || 5) * 60;
  }

  function updateSummary() {
    summaryGroup.textContent = appState.groupId || "--";
    summarySession.textContent = appState.session || "--";
    summaryDirector.textContent = appState.director || "--";
    const participants = [appState.participantA, appState.participantB].filter(Boolean).join(" / ");
    summaryParticipants.textContent = participants || "--";
  }

  function scheduleTimeout(callback, delay) {
    const id = window.setTimeout(() => {
      scheduledTimeouts = scheduledTimeouts.filter((timeoutId) => timeoutId !== id);
      callback();
    }, delay);
    scheduledTimeouts.push(id);
    return id;
  }

  function clearAllTimeouts() {
    scheduledTimeouts.forEach((id) => window.clearTimeout(id));
    scheduledTimeouts = [];
  }

  function anyModalVisible() {
    const modals = [syncModal, stopRecordingModal, postSessionModal, finalExportModal, setupModal, finishModal, settingsModal];
    return modals.some((modal) => modal && !modal.classList.contains("hidden"));
  }

  function ensureSegment(segmentId) {
    if (!segmentId) {
      return null;
    }
    if (!sessionSegments[segmentId]) {
      sessionSegments[segmentId] = {
        id: segmentId,
        order: Number(segmentId),
        startTimestamp: null,
        note: "",
        summary: "",
        take: null,
      };
    }
    return sessionSegments[segmentId];
  }

  function openModal(element) {
    if (!element) {
      return;
    }
    element.classList.remove("hidden");
    element.classList.add("flex");
    document.body.classList.add("overflow-hidden");
  }

  function closeModal(element) {
    if (!element) {
      return;
    }
    element.classList.add("hidden");
    element.classList.remove("flex");
    if (!anyModalVisible()) {
      document.body.classList.remove("overflow-hidden");
    }
  }

  function showStopRecordingModal() {
    openModal(stopRecordingModal);
  }

  function hideStopRecordingModal() {
    closeModal(stopRecordingModal);
  }

  function showPostSessionModal() {
    const activeSegmentId = currentSegmentId || String(sessionCount);
    const segment = ensureSegment(activeSegmentId) || {};
    if (postSessionNoteInput) {
      postSessionNoteInput.value = segment.note || "";
    }
    if (postSessionModal) {
      postSessionModal.dataset.segmentId = activeSegmentId;
    }
    openModal(postSessionModal);
    postSessionNoteInput?.focus();
  }

  function hidePostSessionModal() {
    if (postSessionModal && postSessionModal.dataset) {
      delete postSessionModal.dataset.segmentId;
    }
    closeModal(postSessionModal);
  }

  function clearBreakTimer(clearOverlay = false) {
    if (breakTimerId) {
      clearInterval(breakTimerId);
      breakTimerId = null;
    }
    breakRemainingSeconds = 0;
    breakPreviousPrompt = "";
    if (clearOverlay) {
      emitOverlay({ mode: "clear" });
    }
  }

  function showOverlayNotice(message, durationMs, level = "info") {
    emitOverlay({ mode: "notice", message, level, ttlMs: durationMs });
  }

  function updateBreakOverlay() {
    emitOverlay({
      mode: "break",
      message: "休憩タイム🌱",
      remaining: breakRemainingSeconds,
    });
  }

  function startBreakCountdown() {
    if (isRunning || preRollActive) {
      alert("収録中は休憩を開始できません。先にセッションを停止してください。");
      return;
    }
    if (breakTimerId) {
      alert("すでに休憩カウント中です。");
      return;
    }
    breakRemainingSeconds = getBreakDurationSeconds();
    breakPreviousPrompt = lastPromptMessage;
    sendPrompt("休憩タイム🌱");
    setTimerStatus("休憩カウント中", "text-emerald-500");
    updateBreakOverlay();

    // Show cancel button, hide break button
    if (breakBtn) breakBtn.classList.add("hidden");
    if (breakCancelBtn) breakCancelBtn.classList.remove("hidden");

    breakTimerId = window.setInterval(() => {
      breakRemainingSeconds = Math.max(0, breakRemainingSeconds - 1);
      if (breakRemainingSeconds > 0) {
        updateBreakOverlay();
      } else {
        const previousMessage = breakPreviousPrompt;
        clearBreakTimer();
        emitOverlay({ mode: "clear" });
        if (previousMessage) {
          lastPromptMessage = previousMessage;
          restorePromptMessage();
        } else {
          lastPromptMessage = "";
          socket.emit("prompt_update", { message: "" });
        }
        setTimerStatus("待機中", "text-slate-500");

        // Restore button visibility
        if (breakBtn) breakBtn.classList.remove("hidden");
        if (breakCancelBtn) breakCancelBtn.classList.add("hidden");
      }
    }, 1000);
  }

  function cancelBreak() {
    if (!breakTimerId) {
      return;
    }
    const previousMessage = breakPreviousPrompt;
    clearBreakTimer();
    emitOverlay({ mode: "clear" });
    if (previousMessage) {
      lastPromptMessage = previousMessage;
      restorePromptMessage();
    } else {
      lastPromptMessage = "";
      socket.emit("prompt_update", { message: "" });
    }
    setTimerStatus("待機中", "text-slate-500");

    // Restore button visibility
    if (breakBtn) breakBtn.classList.remove("hidden");
    if (breakCancelBtn) breakCancelBtn.classList.add("hidden");
  }

  function getSegmentSnapshot() {
    const takesMap = new Map(finishedTakes.map((item) => [String(item.take), item]));
    return Object.values(sessionSegments)
      .map((segment) => {
        const takeValue = segment.take || segment.order || null;
        const takeKey = takeValue != null ? String(takeValue) : null;
        let summary = segment.summary || "";
        if (takeKey && !summary && takesMap.has(takeKey)) {
          const takeInfo = takesMap.get(takeKey);
          if (takeInfo?.summary) {
            summary = takeInfo.summary;
          }
        }
        return {
          id: segment.id,
          order: segment.order,
          startTimestamp: segment.startTimestamp,
          note: segment.note || "",
          summary,
          take: takeKey,
        };
      })
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  function updateFinalExportFileList() {
    if (!finalExportFileList) {
      return;
    }
    finalExportFileList.innerHTML = "";
    if (!finalExportFilesInput || !finalExportFilesInput.files) {
      return;
    }
    const files = Array.from(finalExportFilesInput.files);
    if (!files.length) {
      finalExportFileList.innerHTML = '<li class="text-gh-textMuted">ファイルが選択されていません。</li>';
      return;
    }
    files.slice(0, 10).forEach((file) => {
      const item = document.createElement("li");
      item.className = "rounded bg-gh-bg/40 px-3 py-1";
      item.textContent = file.webkitRelativePath || file.name;
      finalExportFileList.appendChild(item);
    });
    if (files.length > 10) {
      const more = document.createElement("li");
      more.className = "text-xs text-gh-textMuted";
      more.textContent = `…ほか ${files.length - 10} 件`;
      finalExportFileList.appendChild(more);
    }
  }

  function resetFinalExportForm() {
    if (finalExportFilesInput) {
      finalExportFilesInput.value = "";
    }
    if (finalExportFileList) {
      finalExportFileList.innerHTML = "";
    }
  }

  function openFinalExportModal() {
    const segments = getSegmentSnapshot();
    if (!segments.length) {
      alert("まだ開始したセッションがありません。最低1回の収録を完了してください。");
      return;
    }
    resetFinalExportForm();
    openModal(finalExportModal);
  }

  function closeFinalExportModal() {
    resetFinalExportForm();
    closeModal(finalExportModal);
  }

  async function handleFinalExportSubmit(event) {
    event.preventDefault();
    if (!finalExportFilesInput || !finalExportFilesInput.files || finalExportFilesInput.files.length === 0) {
      alert("Zoom の録画フォルダを選択してください。");
      return;
    }
    if (!appState.groupId || !appState.session) {
      alert("セッション情報が登録されていません。先にセッション情報を入力してください。");
      showSetupModal();
      return;
    }

    const files = Array.from(finalExportFilesInput.files);
    const segments = getSegmentSnapshot();
    const metadata = {
      groupId: appState.groupId,
      session: appState.session,
      director: appState.director,
      participants: [appState.participantA, appState.participantB],
      takes: finishedTakes,
      segments,
    };

    const formData = new FormData();
    formData.append("metadata", JSON.stringify(metadata));
    files.forEach((file) => {
      const relativePath = file.webkitRelativePath || file.name;
      formData.append("files", file, relativePath);
    });

    if (finalExportSubmitBtn) {
      finalExportSubmitBtn.disabled = true;
      finalExportSubmitBtn.textContent = "生成中...";
    }

    try {
      const response = await fetch("/api/final-export", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "収録データの生成に失敗しました");
      }
      if (result.archiveContent && result.archiveName) {
        triggerDownload(result.archiveName, result.archiveContent, "application/zip");
      }
      alert("収録データを生成しました。ダウンロードをご確認ください。");
      closeFinalExportModal();
    } catch (error) {
      console.error(error);
      alert(error.message || "収録データの生成に失敗しました。");
    } finally {
      if (finalExportSubmitBtn) {
        finalExportSubmitBtn.disabled = false;
        finalExportSubmitBtn.textContent = "生成する";
      }
    }
  }

  function showSyncModal(shouldReset) {
    awaitingSyncConfirmation = true;
    pendingStartShouldReset = Boolean(shouldReset);
    openModal(syncModal);
    if (startBtn) {
      startBtn.disabled = true;
    }
    emitOverlay({
      mode: "countdown",
      value: "待機中",
      note: "Zoom の録画ボタンを押したら OK を押してください",
    });
    setTimerStatus("同期待機中", "text-amber-500");
  }

  function hideSyncModal() {
    closeModal(syncModal);
    if (startBtn) {
      startBtn.disabled = false;
    }
  }

  function handleSyncConfirm(event) {
    if (event) {
      event.preventDefault();
    }
    if (!awaitingSyncConfirmation) {
      return;
    }
    awaitingSyncConfirmation = false;
    hideSyncModal();
    runStartSequence(pendingStartShouldReset);
    pendingStartShouldReset = false;
  }

  function handleSyncCancel(event) {
    if (event) {
      event.preventDefault();
    }
    if (!awaitingSyncConfirmation) {
      return;
    }
    awaitingSyncConfirmation = false;
    pendingStartShouldReset = false;
    hideSyncModal();
    restorePromptMessage();
    setTimerStatus("待機中", "text-slate-500");
  }

  function clamp(value, min, max) {
    if (Number.isNaN(value) || typeof value !== "number") {
      return min;
    }
    return Math.min(Math.max(value, min), max);
  }

  function getCategoryDisplayName(category) {
    if (!category) {
      return "";
    }
    const trimmed = category.trim();
    if (!trimmed) {
      return "";
    }
    if (CATEGORY_LABEL_OVERRIDES[trimmed]) {
      return CATEGORY_LABEL_OVERRIDES[trimmed];
    }
    const primary = trimmed.split(/[・／･\s]/)[0] || trimmed;
    if (primary.length <= 5) {
      return primary;
    }
    return primary.slice(0, 5);
  }

  function toFullWidthDigits(value) {
    const fullWidth = "０１２３４５６７８９";
    return String(value).replace(/[0-9]/g, (digit) => fullWidth[Number(digit)] ?? digit);
  }

  function normalizeSettings(raw) {
    const durationMinutes = clamp(Math.round(Number(raw?.durationMinutes ?? DEFAULT_SETTINGS.durationMinutes)), 1, 240);
    const startCountdown = clamp(Math.round(Number(raw?.startCountdown ?? DEFAULT_SETTINGS.startCountdown)), 1, 10);
    const finishCountdown = clamp(Math.round(Number(raw?.finishCountdown ?? DEFAULT_SETTINGS.finishCountdown)), 1, 10);
    const finishHold = clamp(Math.round(Number(raw?.finishHold ?? DEFAULT_SETTINGS.finishHold)), 1, 30);
    const breakDurationMinutes = clamp(Math.round(Number(raw?.breakDurationMinutes ?? DEFAULT_SETTINGS.breakDurationMinutes)), 1, 30);
    return {
      durationMinutes,
      startCountdown,
      finishCountdown,
      finishHold,
      breakDurationMinutes,
    };
  }

  function loadSettings() {
    if (typeof window === "undefined" || !window.localStorage) {
      return { ...DEFAULT_SETTINGS };
    }
    try {
      const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!stored) {
        return { ...DEFAULT_SETTINGS };
      }
      const parsed = JSON.parse(stored);
      return normalizeSettings({ ...DEFAULT_SETTINGS, ...(parsed || {}) });
    } catch (error) {
      console.warn("設定の読み込みに失敗しました。デフォルトを使用します。", error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(value) {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(value));
    } catch (error) {
      console.warn("設定の保存に失敗しました。", error);
    }
  }

  function getTheme(themeId) {
    if (!themeId) {
      return null;
    }
    return themeById.get(themeId) || null;
  }

  function resolveHints(theme, group) {
    if (!theme) {
      return [];
    }
    if (group === "extra1" && Array.isArray(theme.extraHint1) && theme.extraHint1.length) {
      return theme.extraHint1;
    }
    if (group === "extra2" && Array.isArray(theme.extraHint2) && theme.extraHint2.length) {
      return theme.extraHint2;
    }
    if (Array.isArray(theme.baseHints) && theme.baseHints.length) {
      return theme.baseHints;
    }
    return [];
  }

  function renderMarks(container, marks) {
    if (!container) {
      return;
    }
    container.innerHTML = "";
    const entries = Array.isArray(marks) ? marks.filter(Boolean) : [];
    if (!entries.length) {
      container.classList.add("hidden");
      return;
    }
    container.classList.remove("hidden");
    entries.forEach((mark) => {
      const spec = MARK_BADGES[mark] || { text: mark, className: "bg-slate-200 text-slate-600 border border-slate-300" };
      const badge = document.createElement("span");
      badge.className = `rounded-full px-3 py-1 text-xs font-semibold ${spec.className}`;
      badge.textContent = spec.text;
      container.appendChild(badge);
    });
  }

  function formatOffsetSecondsValue(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return "--";
    }
    const numeric = Number(value);
    return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(3)}s`;
  }

  function formatLocalTimestamp(value) {
    if (!value) {
      return "--";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${yyyy}/${mm}/${dd} ${hh}:${min}:${ss}`;
  }

  function renderOffsetStatus(status) {
    latestOffsetStatus = status || null;
    const monitorPath = status?.monitoringPath || "";
    const matchesCurrentSession =
      status &&
      (!appState.groupId || status.groupId === appState.groupId) &&
      (!appState.session || status.session === appState.session);
    const display = matchesCurrentSession ? status : null;
    const source = display?.offsetSource || "none";
    const autoSeconds = display?.autoOffsetSeconds;
    const manualSeconds = display?.manualOffsetSeconds;
    const effectiveSeconds = display?.effectiveOffsetSeconds;
    const startTime = display?.startTime;
    const recordingTimestamp = status?.lastRecordingTimestamp;
    const recordingFile = status?.lastRecordingFile;
    const isDifferentSession = Boolean(status) && !matchesCurrentSession;

    if (offsetStatusLabel) {
      let label = "セッション未開始";
      if (startTime) {
        if (source === "manual") {
          label = `手動補正済み ${formatOffsetSecondsValue(effectiveSeconds)}`;
        } else if (source === "auto") {
          label = `自動補正済み ${formatOffsetSecondsValue(effectiveSeconds)}`;
        } else if (recordingTimestamp) {
          label = "録画検知済み・補正待ち";
        } else {
          label = "録画検知待ち";
        }
      }
      offsetStatusLabel.textContent = label;
    }

    if (offsetSourceBadge) {
      const baseClass =
        "rounded-full border px-3 py-1 text-xs font-semibold tracking-wide transition-colors";
      let className = `${baseClass} border-slate-600 bg-slate-700/60 text-slate-200`;
      let text = "NONE";
      if (source === "manual") {
        className = `${baseClass} border-amber-400/60 bg-amber-500/10 text-amber-300`;
        text = "MANUAL";
      } else if (source === "auto") {
        className = `${baseClass} border-emerald-400/60 bg-emerald-500/10 text-emerald-300`;
        text = "AUTO";
      }
      offsetSourceBadge.className = className;
      offsetSourceBadge.textContent = text;
    }

    if (offsetAutoValue) {
      offsetAutoValue.textContent = formatOffsetSecondsValue(autoSeconds);
    }
    if (offsetManualValue) {
      offsetManualValue.textContent = formatOffsetSecondsValue(manualSeconds);
    }
    if (offsetEffectiveValue) {
      offsetEffectiveValue.textContent = formatOffsetSecondsValue(effectiveSeconds);
    }
    if (offsetMonitoringPath) {
      offsetMonitoringPath.textContent = monitorPath || "未設定";
    }
    if (offsetLastRecording) {
      if (recordingTimestamp) {
        const fileLabel = recordingFile ? ` / ${recordingFile}` : "";
        const suffix = isDifferentSession ? "（別セッション）" : "";
        offsetLastRecording.textContent = `${formatLocalTimestamp(recordingTimestamp)}${fileLabel}${suffix}`;
      } else if (monitorPath) {
        offsetLastRecording.textContent = "検知待ち";
      } else {
        offsetLastRecording.textContent = "--";
      }
    }
    if (offsetManualInput) {
      if (display && typeof manualSeconds === "number" && !Number.isNaN(manualSeconds)) {
        offsetManualInput.value = manualSeconds.toFixed(3);
      } else {
        offsetManualInput.value = "";
      }
    }
  }

  async function fetchSessionStatus(options = {}) {
    if (!hasOffsetUi) {
      return null;
    }
    const { showAlertOnError = false } = options || {};
    try {
      const response = await fetch("/api/session/status");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `status ${response.status}`);
      }
      renderOffsetStatus(data);
      return data;
    } catch (error) {
      console.error("Failed to fetch session status", error);
      if (showAlertOnError) {
        alert("録画同期ステータスの取得に失敗しました。");
      }
      return null;
    }
  }

  async function notifySessionStart(startTimestamp) {
    if (!appState.groupId || !appState.session) {
      return;
    }
    try {
      const response = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: appState.groupId,
          session: appState.session,
          startTimestamp: Math.floor(Number(startTimestamp) || Date.now()),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "session/start failed");
      }
      if (hasOffsetUi) {
        renderOffsetStatus(data.status);
      }
    } catch (error) {
      console.error("Failed to register session start", error);
    }
  }

  async function submitManualOffset(value) {
    if (!hasOffsetUi) {
      return;
    }
    try {
      const response = await fetch("/api/session/offset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualOffsetSeconds: value }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "session/offset failed");
      }
      renderOffsetStatus(data.status);
      alert(`手動補正を適用しました（${formatOffsetSecondsValue(value)}）`);
    } catch (error) {
      console.error("Failed to apply manual offset", error);
      alert("手動補正の適用に失敗しました。");
    }
  }

  async function clearManualOffset() {
    if (!hasOffsetUi) {
      return;
    }
    try {
      const response = await fetch("/api/session/offset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "session/offset clear failed");
      }
      renderOffsetStatus(data.status);
      alert("手動補正を解除しました。");
    } catch (error) {
      console.error("Failed to clear manual offset", error);
      alert("手動補正の解除に失敗しました。");
    }
  }

  function startOffsetPolling() {
    if (!hasOffsetUi) {
      return;
    }
    stopOffsetPolling();
    offsetPollingTimerId = window.setInterval(() => {
      fetchSessionStatus();
    }, OFFSET_POLLING_INTERVAL_MS);
  }

  function stopOffsetPolling() {
    if (offsetPollingTimerId) {
      window.clearInterval(offsetPollingTimerId);
      offsetPollingTimerId = null;
    }
  }

  function updateHintButtons() {
    const theme = getTheme(currentThemeId);
    const availability = {
      base: Boolean(theme),
      extra1: Boolean(theme && Array.isArray(theme.extraHint1) && theme.extraHint1.length),
      extra2: Boolean(theme && Array.isArray(theme.extraHint2) && theme.extraHint2.length),
    };
    if (!theme) {
      activeHintGroup = "base";
    } else if (!availability[activeHintGroup]) {
      if (availability.base) {
        activeHintGroup = "base";
      } else if (availability.extra1) {
        activeHintGroup = "extra1";
      } else if (availability.extra2) {
        activeHintGroup = "extra2";
      } else {
        activeHintGroup = "base";
      }
    }
    hintButtonConfig.forEach(({ element, group }) => {
      if (!element) {
        return;
      }
      element.dataset.group = group;
      const isActive = group === activeHintGroup;
      const isEnabled = availability[group];
      const baseClass =
        "rounded-full border px-3 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary/40";
      let className = `${baseClass} text-slate-600 border-slate-300 hover:bg-slate-100`;
      if (!isEnabled) {
        className = `${baseClass} text-slate-400 border-slate-200 opacity-30 cursor-not-allowed`;
      } else if (isActive) {
        className = `${baseClass} border-primary bg-primary text-white shadow focus:ring-primary/60`;
      }
      element.className = className;
      element.disabled = !isEnabled;
    });
  }

  function getCategoryGradient(index) {
    return CATEGORY_GRADIENTS[index % CATEGORY_GRADIENTS.length];
  }

  function chunkArray(items, chunkSize) {
    const result = [];
    for (let index = 0; index < items.length; index += chunkSize) {
      result.push(items.slice(index, index + chunkSize));
    }
    return result;
  }

  function updateThemeCounters() {
    if (themeTotalLabel) {
      themeTotalLabel.textContent = String(allThemes.length);
    }
    if (themeTotalHeaderLabel) {
      themeTotalHeaderLabel.textContent = String(allThemes.length);
    }
    if (themeRemainingLabel) {
      const remaining = Math.max(0, allThemes.length - usedThemeIds.size);
      themeRemainingLabel.textContent = String(remaining);
    }
  }

  function updateThemePreview() {
    if (!themePreviewTitle || !themePreviewHints || !themePreviewCategory || !themeSelectionMeta) {
      return;
    }
    updateHintButtons();
    const theme = getTheme(currentThemeId);
    if (!theme) {
      themePreviewCategory.textContent = "カテゴリ未選択";
      themePreviewTitle.textContent = "テーマが選択されていません";
      themePreviewHints.innerHTML = "";
      if (themePreviewAlerts) {
        themePreviewAlerts.innerHTML = "";
        themePreviewAlerts.classList.add("hidden");
      }
      themeSelectionMeta.textContent = "現在のテーマ: --";
      return;
    }

    themePreviewCategory.textContent = theme.category || "カテゴリ未設定";
    themePreviewTitle.textContent = theme.title || "タイトル未設定";
    themePreviewHints.innerHTML = "";
    const hints = resolveHints(theme, activeHintGroup);
    if (hints.length) {
      hints.forEach((hint) => {
        const li = document.createElement("li");
        li.className = "flex items-start gap-2";
        const bullet = document.createElement("span");
        bullet.className = "mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/60";
        const text = document.createElement("span");
        text.textContent = hint;
        li.append(bullet, text);
        themePreviewHints.appendChild(li);
      });
    } else {
      const li = document.createElement("li");
      li.className = "text-xs text-slate-400";
      li.textContent = "ヒントは登録されていません。";
      themePreviewHints.appendChild(li);
    }
    if (themePreviewAlerts) {
      renderMarks(themePreviewAlerts, theme.marks || []);
    }
    const label = HINT_GROUP_LABELS[activeHintGroup] || HINT_GROUP_LABELS.base;
    if (theme.no) {
      themeSelectionMeta.textContent = `現在のテーマ: No.${theme.no} / 表示: ${label}`;
    } else {
      themeSelectionMeta.textContent = `現在のテーマ: ${theme.title || "--"} / 表示: ${label}`;
    }
  }

  function closeThemePopover() {
    if (!themePopover) {
      return;
    }
    themePopover.classList.add("hidden");
    themePopover.classList.remove("pointer-events-auto");
    themePopover.classList.add("pointer-events-none");
    themePopover.innerHTML = "";
    themePopover.style.top = "-9999px";
    themePopover.style.left = "-9999px";
    currentPopoverCategory = "";
  }

  function buildThemeButton(theme) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.themeId = theme.id;
    const isUsed = usedThemeIds.has(theme.id);
    const baseClass =
      "w-full rounded-xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-primary/40";
    const disabledClass = "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed";
    const activeClass =
      "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md";
    button.className = `${baseClass} ${isUsed ? disabledClass : activeClass}`;
    button.disabled = isUsed;

    const header = document.createElement("div");
    header.className = "flex items-center justify-between text-[11px] text-slate-400";
    const noLabel = document.createElement("span");
    noLabel.textContent = theme.no ? `No.${theme.no}` : "No.-";
    const availability = document.createElement("span");
    const baseHintCount = Array.isArray(theme.baseHints) ? theme.baseHints.length : 0;
    const extraHintCount = [
      Array.isArray(theme.extraHint1) ? theme.extraHint1.length : 0,
      Array.isArray(theme.extraHint2) ? theme.extraHint2.length : 0,
    ].reduce((acc, value) => acc + (value > 0 ? 1 : 0), 0);
    if (isUsed) {
      availability.textContent = "使用済み";
    } else if (extraHintCount > 0) {
      availability.textContent = `${baseHintCount}件 + 追加${extraHintCount}`;
    } else {
      availability.textContent = `${baseHintCount}件 ヒント`;
    }
    header.append(noLabel, availability);

    const title = document.createElement("p");
    title.className = "mt-1 text-sm font-semibold text-slate-800";
    title.textContent = theme.title || "タイトル未設定";

    const hintsWrapper = document.createElement("ul");
    hintsWrapper.className = "mt-2 space-y-1 text-xs text-slate-500";
    resolveHints(theme, "base").slice(0, 4).forEach((hint) => {
      const li = document.createElement("li");
      li.textContent = `・${hint}`;
      hintsWrapper.appendChild(li);
    });

    button.append(header, title, hintsWrapper);

    if (Array.isArray(theme.marks) && theme.marks.length) {
      const alertRow = document.createElement("div");
      alertRow.className = "mt-2 flex flex-wrap gap-1";
      theme.marks.forEach((mark) => {
        const spec = MARK_BADGES[mark] || { text: mark, className: "bg-slate-200 text-slate-600 border border-slate-300" };
        const badge = document.createElement("span");
        badge.className = `rounded-full px-2 py-0.5 text-[10px] font-semibold ${spec.className}`;
        badge.textContent = spec.text;
        alertRow.appendChild(badge);
      });
      button.appendChild(alertRow);
    }

    if (!isUsed) {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleThemeSelection(theme.id);
      });
    }

    return button;
  }

  function openCategoryPopover(category, anchor) {
    if (!themePopover) {
      return;
    }
    if (currentPopoverCategory === category && !themePopover.classList.contains("hidden")) {
      closeThemePopover();
      return;
    }
    const themes = (themesByCategory.get(category) || []).slice();
    if (!themes.length) {
      closeThemePopover();
      return;
    }

    closeThemePopover();
    currentPopoverCategory = category;
    themePopover.innerHTML = "";

    const header = document.createElement("div");
    header.className = "flex items-center justify-between gap-3";
    const title = document.createElement("h3");
    title.className = "text-sm font-semibold text-slate-800";
    title.textContent = category;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className =
      "rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300/70";
    closeBtn.textContent = "閉じる";
    closeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      closeThemePopover();
    });
    header.append(title, closeBtn);
    themePopover.appendChild(header);

    const chunks = chunkArray(themes, 10);
    const columns = document.createElement("div");
    columns.className = "mt-3 grid gap-3 sm:grid-cols-2";
    chunks.forEach((chunk) => {
      const column = document.createElement("div");
      column.className = "space-y-2";
      chunk.forEach((theme) => {
        column.appendChild(buildThemeButton(theme));
      });
      columns.appendChild(column);
    });
    themePopover.appendChild(columns);

    const note = document.createElement("p");
    note.className = "mt-3 text-[11px] text-slate-400";
    note.textContent = "※ 一度選択したテーマは灰色表示となり、同じ組では再利用できません。";
    themePopover.appendChild(note);

    themePopover.classList.remove("hidden");
    themePopover.classList.remove("pointer-events-none");
    themePopover.classList.add("pointer-events-auto");

    window.requestAnimationFrame(() => {
      const popWidth = themePopover.offsetWidth;
      const popHeight = themePopover.offsetHeight;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const left = Math.max((viewportWidth - popWidth) / 2, 16);
      let top = viewportHeight * 0.35 - popHeight / 2;
      const minTop = 32;
      const maxTop = viewportHeight - popHeight - 32;
      if (popHeight + 64 > viewportHeight) {
        top = minTop;
      } else {
        top = Math.min(Math.max(top, minTop), Math.max(maxTop, minTop));
      }
      themePopover.style.left = `${left}px`;
      themePopover.style.top = `${top}px`;
    });
  }

  function openThemeHistory(anchor) {
    if (!themePopover) {
      return;
    }
    const historyThemes = themeHistory
      .map((id) => themeById.get(id))
      .filter((theme) => Boolean(theme));
    if (!historyThemes.length) {
      closeThemePopover();
      alert("まだ使用済みのテーマはありません。");
      return;
    }
    currentPopoverCategory = "__history__";
    closeThemePopover();
    themePopover.innerHTML = "";

    const header = document.createElement("div");
    header.className = "flex items-center justify-between gap-3";
    const title = document.createElement("h3");
    title.className = "text-sm font-semibold text-slate-800";
    title.textContent = "使用済みテーマ一覧";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className =
      "rounded-full border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300/70";
    closeBtn.textContent = "閉じる";
    closeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      closeThemePopover();
    });
    header.append(title, closeBtn);
    themePopover.appendChild(header);

    const list = document.createElement("div");
    list.className = "mt-3 max-h-72 space-y-2 overflow-y-auto pr-1";

    historyThemes.forEach((theme, index) => {
      const card = document.createElement("div");
      card.className = "rounded-xl border border-slate-200 bg-white/70 px-3 py-2";
      const line1 = document.createElement("div");
      line1.className = "flex items-center justify-between text-[11px] text-slate-400";
      line1.innerHTML = `<span>No.${theme.no || "-"} / ${theme.category || "カテゴリ未設定"}</span><span>${index + 1} 件目</span>`;
      const titleEl = document.createElement("p");
      titleEl.className = "mt-1 text-sm font-semibold text-slate-700";
      titleEl.textContent = theme.title || "";
      card.append(line1, titleEl);
      list.appendChild(card);
    });

    themePopover.appendChild(list);
    themePopover.classList.remove("hidden");
    themePopover.classList.remove("pointer-events-none");
    themePopover.classList.add("pointer-events-auto");

    window.requestAnimationFrame(() => {
      const popWidth = themePopover.offsetWidth;
      const popHeight = themePopover.offsetHeight;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const left = Math.max((viewportWidth - popWidth) / 2, 16);
      let top = viewportHeight * 0.35 - popHeight / 2;
      const minTop = 32;
      const maxTop = viewportHeight - popHeight - 32;
      if (popHeight + 64 > viewportHeight) {
        top = minTop;
      } else {
        top = Math.min(Math.max(top, minTop), Math.max(maxTop, minTop));
      }
      themePopover.style.left = `${left}px`;
      themePopover.style.top = `${top}px`;
    });
  }

  function renderCategoryButtons() {
    if (!categoryGrid) {
      return;
    }
    categoryGrid.innerHTML = "";
    if (categoryOrder.length === 0) {
      const empty = document.createElement("div");
      empty.className = "col-span-full text-center text-xs text-slate-400";
      empty.textContent = allThemes.length ? "利用可能なカテゴリがありません。" : "テーマが読み込まれていません。";
      categoryGrid.appendChild(empty);
      updateThemeCounters();
      return;
    }
    categoryOrder.forEach((category, index) => {
      const themes = themesByCategory.get(category) || [];
      const usedCount = themes.filter((theme) => usedThemeIds.has(theme.id)).length;
      const remaining = Math.max(0, themes.length - usedCount);
      const allUsed = themes.length > 0 && remaining === 0;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.role = "category-button";
      button.dataset.category = category;

      const gradient = getCategoryGradient(index);
  const baseClass =
    "flex min-h-[130px] flex-col justify-center gap-2 rounded-2xl px-4 py-4 text-left text-base transition focus:outline-none focus:ring-2 focus:ring-white/60";
      if (allUsed) {
        button.className = `${baseClass} border border-slate-200 bg-slate-100 text-slate-400 shadow-inner`;
        button.disabled = true;
      } else {
        button.className = `${baseClass} bg-gradient-to-br ${gradient} text-white shadow hover:-translate-y-1 hover:shadow-lg`;
      }

      const displayName = getCategoryDisplayName(category) || category;
      const name = document.createElement("span");
      name.className = allUsed ? "text-base font-semibold" : "text-base font-semibold tracking-wide";
      name.textContent = displayName;

      const stats = document.createElement("span");
      stats.className = allUsed ? "text-xs text-slate-400" : "text-sm text-white/85";
      stats.textContent = `残り ${remaining}/${themes.length}`;

      button.append(name, stats);
      if (!allUsed) {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openCategoryPopover(category, event.currentTarget);
        });
      }
      categoryGrid.appendChild(button);
    });
    updateThemeCounters();
  }

  function handleThemeSelection(themeId) {
    const theme = themeById.get(themeId);
    if (!theme) {
      return;
    }
    if (!themePanelExpanded) {
      toggleThemePanel(false);
    }
    usedThemeIds.add(themeId);
    if (!themeHistory.includes(themeId)) {
      themeHistory.push(themeId);
    }
    currentThemeId = themeId;
    activeHintGroup = "base";
    updateThemePreview();
    renderCategoryButtons();
    updateThemeCounters();
    closeThemePopover();
    broadcastTheme();
    void logThemeChange(theme);

    // タイマーの状態に応じてメッセージを変更
    if (isRunning) {
      sendPrompt("テーマを変更しました");
    } else {
      const themeTitle = theme.title || "テーマ";
      sendPrompt(`次は「${themeTitle}」のテーマからスタートします`);
    }
  }

  function clearCurrentTheme() {
    currentThemeId = null;
    activeHintGroup = "base";
    closeThemePopover();
    updateThemePreview();
    renderCategoryButtons();
    updateThemeCounters();
    broadcastTheme();
  }

  function setActiveHintGroup(group) {
    if (!["base", "extra1", "extra2"].includes(group)) {
      return;
    }
    const theme = getTheme(currentThemeId);
    if (!theme) {
      return;
    }
    if (group === "extra1" && (!Array.isArray(theme.extraHint1) || !theme.extraHint1.length)) {
      return;
    }
    if (group === "extra2" && (!Array.isArray(theme.extraHint2) || !theme.extraHint2.length)) {
      return;
    }
    if (group === activeHintGroup) {
      return;
    }
    const previousGroup = activeHintGroup;
    activeHintGroup = group;
    updateThemePreview();
    broadcastTheme();

    // ヒント切り替え時にカンペを自動更新
    if (previousGroup !== group) {
      sendPrompt("次のヒントを参考にしてください");
    }
  }

  function toggleThemePanel(forceExpand) {
    if (!categoryGrid || !themePanelIndicator) {
      return;
    }
    if (typeof forceExpand === "boolean") {
      themePanelExpanded = forceExpand;
    } else {
      themePanelExpanded = !themePanelExpanded;
    }
  if (themePanelExpanded) {
    categoryGrid.classList.remove("hidden");
    themePanelIndicator.textContent = "閉じる";
    if (themePanelIndicatorIcon) {
      themePanelIndicatorIcon.textContent = "▲";
      themePanelIndicatorIcon.style.transform = "rotate(180deg)";
    }
  } else {
    categoryGrid.classList.add("hidden");
    themePanelIndicator.textContent = "開く";
    if (themePanelIndicatorIcon) {
      themePanelIndicatorIcon.textContent = "▼";
      themePanelIndicatorIcon.style.transform = "rotate(0deg)";
    }
  }
}

  function applyAppState() {
    updateSummary();
    if (finishGroup) {
      finishGroup.value = appState.groupId;
    }
    if (finishSession) {
      finishSession.value = appState.session;
    }
  }

  function updateSessionLengthLabel() {
    if (sessionLengthLabel) {
      sessionLengthLabel.textContent = `セッション長: ${settings.durationMinutes}分`;
    }
  }

  function syncSettingsForm(source = settings) {
    const target = normalizeSettings(source);
    if (settingsDurationInput) {
      settingsDurationInput.value = String(target.durationMinutes);
    }
    if (settingsStartCountdownInput) {
      settingsStartCountdownInput.value = String(target.startCountdown);
    }
    if (settingsFinishCountdownInput) {
      settingsFinishCountdownInput.value = String(target.finishCountdown);
    }
    if (settingsFinishHoldInput) {
      settingsFinishHoldInput.value = String(target.finishHold);
    }
    if (settingsBreakDurationInput) {
      settingsBreakDurationInput.value = String(target.breakDurationMinutes);
    }
  }

  function showSettingsModal() {
    if (isRunning || preRollActive) {
      alert("タイマーが動作中は設定を変更できません。タイマーを停止してから開いてください。");
      return;
    }
    if (completionSequenceStarted) {
      alert("終了カウントダウン中は設定を変更できません。カウントが完了してから再度お試しください。");
      return;
    }
    syncSettingsForm();
    if (settingsModal) {
      settingsModal.classList.remove("hidden");
    }
    if (settingsDurationInput) {
      settingsDurationInput.focus();
      settingsDurationInput.select();
    }
  }

  function hideSettingsModal() {
    if (settingsModal) {
      settingsModal.classList.add("hidden");
    }
  }

  function hideZoomShareModal() {
    if (zoomShareModal) {
      zoomShareModal.classList.add("hidden");
    }
  }

  function showZoomShareModal() {
    if (zoomShareModal) {
      zoomShareModal.classList.remove("hidden");
    }
  }

  function hideSetupModal() {
    if (setupModal) {
      setupModal.classList.add("hidden");
    }
  }

  function showSetupModal() {
    if (setupModal) {
      setupModal.classList.remove("hidden");
    }
    if (setupGroup) {
      setupGroup.focus();
      setupGroup.select();
    }
  }

  function fillSetupForm() {
    if (setupGroup) setupGroup.value = appState.groupId;
    if (setupSession) setupSession.value = appState.session;
    if (setupDirector) setupDirector.value = appState.director;
    if (setupParticipantA) setupParticipantA.value = appState.participantA;
    if (setupParticipantB) setupParticipantB.value = appState.participantB;
  }

  function showFinishModal() {
    if (!appState.groupId || !appState.session) {
      alert("まずセッション情報を登録してください。");
      showSetupModal();
      return;
    }
    applyAppState();
    if (finishSummary) {
      finishSummary.value = "";
    }
    if (finishModal) {
      finishModal.classList.remove("hidden");
    }
  }

  function hideFinishModal() {
    if (finishModal) {
      finishModal.classList.add("hidden");
    }
  }


  function handleSetupSubmit(event) {
    event.preventDefault();
    const previousGroup = appState.groupId;
    const previousSession = appState.session;
    const groupId = (setupGroup?.value || "").trim();
    const session = (setupSession?.value || "").trim();
    const director = (setupDirector?.value || "").trim();
    const participantA = (setupParticipantA?.value || "").trim();
    const participantB = (setupParticipantB?.value || "").trim();

    if (!groupId || !session || !director || !participantA || !participantB) {
      alert("全ての項目を入力してください。");
      return;
    }

    appState.groupId = groupId;
    appState.session = session;
    appState.director = director;
    appState.participantA = participantA;
    appState.participantB = participantB;
    const isNewSession = previousGroup !== groupId || previousSession !== session;
    if (isNewSession) {
      finishedTakes.length = 0;
    }

    applyAppState();
    closeThemePopover();
    if (isNewSession) {
      usedThemeIds.clear();
      themeHistory.length = 0;
      currentThemeId = null;
      renderCategoryButtons();
      updateThemeCounters();
      updateThemePreview();
      broadcastTheme();
    } else {
      renderCategoryButtons();
      updateThemeCounters();
      updateThemePreview();
    }
    if (isNewSession) {
      renderOffsetStatus(null);
    }
    hideSetupModal();
    categorySelect?.focus();
  }

  function handleSettingsSubmit(event) {
    event.preventDefault();
    if (isRunning || preRollActive) {
      alert("タイマーが動作中は設定を保存できません。停止してから保存してください。");
      return;
    }
    if (completionSequenceStarted) {
      alert("終了カウントダウンが完了するまで待ってから再度お試しください。");
      return;
    }
    const nextValues = {
      durationMinutes: Number(settingsDurationInput?.value ?? settings.durationMinutes),
      startCountdown: Number(settingsStartCountdownInput?.value ?? settings.startCountdown),
      finishCountdown: Number(settingsFinishCountdownInput?.value ?? settings.finishCountdown),
      finishHold: Number(settingsFinishHoldInput?.value ?? settings.finishHold),
      breakDurationMinutes: Number(settingsBreakDurationInput?.value ?? settings.breakDurationMinutes),
    };
    applySettings(nextValues, { persist: true, resetTimerState: true });
    hideSettingsModal();
    alert("設定を保存し、タイマーをリセットしました。");
  }

  function broadcastTheme() {
    if (!socket) {
      return;
    }
    const theme = getTheme(currentThemeId);
    socket.emit("theme_update", {
      title: theme?.title || "",
      category: theme?.category || "",
      hints: resolveHints(theme, activeHintGroup),
      marks: Array.isArray(theme?.marks) ? theme.marks : [],
    });
  }

  function emitOverlay(payload) {
    socket.emit("prompt_overlay", payload);
  }

  function emitNotice(message, level = "info", ttlMs = 4000) {
    emitOverlay({ mode: "notice", message, level, ttlMs });
  }

  function restorePromptMessage() {
    emitOverlay({ mode: "clear" });
    if (lastPromptMessage) {
      socket.emit("send_prompt", { message: lastPromptMessage });
    } else {
      socket.emit("prompt_update", { message: "" });
    }
  }

  function broadcastTime() {
    if (!socket) {
      return;
    }
    const elapsed = durationSeconds - remainingSeconds;
    socket.emit("time_update", {
      elapsed,
      remaining: remainingSeconds,
      running: isRunning,
      critical: remainingSeconds <= 60,
    });
  }

  // ランダムな励ましメッセージを送信
  function sendRandomEncouragement() {
    if (finalMinuteActive) {
      return;
    }
    const randomIndex = Math.floor(Math.random() * ENCOURAGEMENT_MESSAGES.length);
    sendPrompt(ENCOURAGEMENT_MESSAGES[randomIndex]);
  }

  // 60秒ごとの励ましメッセージを開始
  function startEncouragementInterval() {
    stopEncouragementInterval(); // 既存のインターバルをクリア
    encouragementIntervalId = setInterval(() => {
      if (isRunning) {
        sendRandomEncouragement();
      }
    }, 60000); // 60秒ごと
  }

  // 励ましメッセージのインターバルを停止
  function stopEncouragementInterval() {
    if (encouragementIntervalId) {
      clearInterval(encouragementIntervalId);
      encouragementIntervalId = null;
    }
  }

  // 時間通知後の遅延タイムアウトをクリア
  function clearPostNotificationTimeout() {
    if (postNotificationTimeoutId) {
      clearTimeout(postNotificationTimeoutId);
      postNotificationTimeoutId = null;
    }
  }

  // 時間通知を送信し、6秒後にランダムメッセージに戻す
  function sendTimeNotificationWithDelay(message) {
    clearPostNotificationTimeout();
    sendPrompt(message);

    if (finalMinuteActive) {
      return;
    }

    // 6秒後にランダムメッセージに切り替え
    postNotificationTimeoutId = setTimeout(() => {
      if (isRunning && !finalMinuteActive) {
        sendRandomEncouragement();
      }
      postNotificationTimeoutId = null;
    }, 6000);
  }

  function applySettings(values, { persist = true, resetTimerState = true } = {}) {
    const next = normalizeSettings({ ...settings, ...(values || {}) });
    settings = next;
    durationSeconds = Math.max(1, next.durationMinutes) * 60;
    if (!resetTimerState) {
      remainingSeconds = Math.min(remainingSeconds, durationSeconds);
    }
    updateSessionLengthLabel();
    if (persist) {
      saveSettings(settings);
    }
    if (resetTimerState) {
      resetTimer();
    } else {
      updateTimerDisplay();
    }
  }

  function formatTime(totalSeconds) {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(safeSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  function updateTimerDisplay() {
    timerDisplay.textContent = formatTime(remainingSeconds);
    currentTimecode.textContent = formatTime(durationSeconds - remainingSeconds);
    broadcastTime();
    checkTimeMilestones();
  }

  function checkTimeMilestones() {
    if (!hasStarted) {
      return;
    }

    const elapsed = durationSeconds - remainingSeconds;

    const definitions = [];

    if (durationSeconds >= 3600) {
      definitions.push({
        id: "elapsed-30",
        condition: () => elapsed >= 1800,
        action: () => sendPrompt("30分経過しました"),
      });
      // 残り30分の通知を追加
      definitions.push({
        id: "remaining-1800",
        condition: () => remainingSeconds <= 1800,
        action: () => sendTimeNotificationWithDelay("残り時間30分です　残り半分です〜💪"),
      });
    }

    if (durationSeconds >= 900) {
      definitions.push({
        id: "remaining-900",
        condition: () => remainingSeconds <= 900,
        action: () => sendPrompt("残り15分です"),
      });
    }

    if (durationSeconds >= 600) {
      definitions.push({
        id: "remaining-600",
        condition: () => remainingSeconds <= 600,
        action: () => sendPrompt("残り10分です"),
      });
    }

    if (durationSeconds >= 300) {
      definitions.push({
        id: "remaining-300",
        condition: () => remainingSeconds <= 300,
        action: () => sendPrompt("残り5分です"),
      });
    }

    if (durationSeconds >= 180) {
      definitions.push({
        id: "remaining-180",
        condition: () => remainingSeconds <= 180,
        action: () => sendTimeNotificationWithDelay("残り時間、あと3分です"),
      });
    }

    definitions.forEach((def) => {
      if (!milestoneFlags.has(def.id) && def.condition()) {
        milestoneFlags.add(def.id);
        def.action();
      }
    });

    if (!finalMinuteActive && remainingSeconds <= 60) {
      finalMinuteActive = true;
      stopEncouragementInterval();
      clearPostNotificationTimeout();
      sendPrompt("あと1分です");
    }

    if (!finalThirtySecondActive && remainingSeconds <= 30) {
      finalThirtySecondActive = true;
      sendPrompt("あと30秒です");
    }

    if (!finalCountdownStarted && remainingSeconds <= 10) {
      finalCountdownStarted = true;
      lastCountdownSecondShown = null;
    }

    if (finalCountdownStarted) {
      if (remainingSeconds > 0 && lastCountdownSecondShown !== remainingSeconds) {
        lastCountdownSecondShown = remainingSeconds;
        sendPrompt(String(remainingSeconds));
      }
      if (!finalZeroShown && remainingSeconds === 0) {
        finalZeroShown = true;
        sendPrompt("終了");
      }
    }
  }

  function setTimerStatus(text, color = "text-slate-500") {
    timerStatus.textContent = text;
    timerStatus.className = `text-sm font-medium ${color}`;
  }

  function tick() {
    if (!isRunning) {
      return;
    }
    remainingSeconds = Math.max(0, remainingSeconds - 1);
    updateTimerDisplay();
    if (remainingSeconds <= 0) {
      stopTimer();
      setTimerStatus("セッション終了", "text-red-600");
      runCompletionSequence();
    }
  }

  function startTimer() {
    if (isRunning || preRollActive || awaitingSyncConfirmation) {
      return;
    }

    // テーマが選択されているかチェック
    if (!currentThemeId) {
      alert("先にテーマを選んでください");
      return;
    }

    const shouldReset = !hasStarted || remainingSeconds <= 0 || remainingSeconds > durationSeconds;
    showSyncModal(shouldReset);
  }

  function startTimerCore(resetRemaining) {
    clearInterval(timerInterval);
    if (resetRemaining || remainingSeconds <= 0 || remainingSeconds > durationSeconds) {
      remainingSeconds = durationSeconds;
      milestoneFlags.clear();
      finalMinuteActive = false;
      finalThirtySecondActive = false;
      finalCountdownStarted = false;
      finalZeroShown = false;
      lastCountdownSecondShown = null;
      clearBreakTimer(true);

      // セッションカウントを増やす
      sessionCount++;
    }
    isRunning = true;
    hasStarted = true;
    completionSequenceStarted = false;
    setTimerStatus("カウントダウン中", "text-emerald-600");
    updateTimerDisplay();
    timerInterval = setInterval(tick, 1000);

    // 開始メッセージと励ましメッセージのシーケンスを開始
    startEncouragementSequence();
  }

  // 開始時の励ましメッセージシーケンス
  function startEncouragementSequence() {
    // まず「会話を始めてください◎ どちらから話しても結構です🤝」を送信
    sendPrompt("会話を始めてください◎ どちらから話しても結構です🤝");

    // 15秒後にセッション別の定型文を送信
    setTimeout(() => {
      if (!isRunning) return;

      if (sessionCount === 1) {
        sendPrompt("長時間の会話になりますので、リラックスしていきましょう〜");
      } else if (sessionCount === 2) {
        sendPrompt("笑顔を意識して、1時間よろしくお願いします♪");
      } else if (sessionCount === 3) {
        sendPrompt("ラスト1時間！元気よくいきましょう✨");
      }

      // 30秒後にランダムメッセージのインターバルを開始
      setTimeout(() => {
        if (isRunning) {
          sendRandomEncouragement(); // 最初のランダムメッセージを即座に送信
          startEncouragementInterval(); // その後60秒ごとのインターバルを開始
        }
      }, 30000);
    }, 15000);
  }

  function stopTimer() {
    if (preRollActive) {
      clearAllTimeouts();
      preRollActive = false;
      emitOverlay({ mode: "clear" });
      setTimerStatus("待機中", "text-slate-500");
      return;
    }
    if (!isRunning) {
      return;
    }
    isRunning = false;
    clearInterval(timerInterval);
    stopEncouragementInterval();
    clearPostNotificationTimeout();
    setTimerStatus("一時停止", "text-amber-600");
    clearAllTimeouts();
    emitOverlay({ mode: "clear" });
    broadcastTime();
  }

  function resetTimer() {
    clearAllTimeouts();
    emitOverlay({ mode: "clear" });
    preRollActive = false;
    isRunning = false;
    hasStarted = false;
    completionSequenceStarted = false;
    milestoneFlags.clear();
    clearInterval(timerInterval);
    stopEncouragementInterval();
    clearPostNotificationTimeout();
    if (stopRecordingModal && !stopRecordingModal.classList.contains("hidden")) {
      hideStopRecordingModal();
    }
    if (postSessionModal && !postSessionModal.classList.contains("hidden")) {
      hidePostSessionModal();
    }
    remainingSeconds = durationSeconds;
    updateSessionLengthLabel();
    updateTimerDisplay();
    setTimerStatus("待機中", "text-slate-500");
    broadcastTime();
    finalMinuteActive = false;
    finalThirtySecondActive = false;
    finalCountdownStarted = false;
    finalZeroShown = false;
    lastCountdownSecondShown = null;
    awaitingSyncConfirmation = false;
    currentSegmentId = null;
    clearBreakTimer(true);
  }

  function sendPrompt(message) {
    const text = (message || "").trim();
    if (!text) {
      return;
    }
    socket.emit("send_prompt", { message: text });
    lastPromptLabel.textContent = text;
    lastPromptMessage = text;
  }

  function getCannedMessages() {
    const stored = localStorage.getItem("canned_messages");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse canned messages:", e);
      }
    }
    return config.cannedPrompts || [];
  }

  function buildPromptButtons() {
    const prompts = getCannedMessages();
    promptButtonsWrapper.innerHTML = "";
    prompts.forEach((prompt) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = prompt;
      button.className =
        "w-full rounded-lg border border-gh-border bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:border-gh-blue";
      button.addEventListener("click", () => showCannedMessageModal(prompt));
      promptButtonsWrapper.appendChild(button);
    });
  }

  function showCannedMessageModal(message) {
    if (!cannedMessageModal || !cannedMessagePreview) {
      return;
    }
    currentCannedMessage = message;
    cannedMessagePreview.textContent = message;

    // 参加者名を更新
    if (cannedLabelA) {
      cannedLabelA.textContent = appState.participantA || "参加者A";
    }
    if (cannedLabelB) {
      cannedLabelB.textContent = appState.participantB || "参加者B";
    }

    // チェックボックスをリセット
    if (cannedCheckA) cannedCheckA.checked = false;
    if (cannedCheckB) cannedCheckB.checked = false;

    cannedMessageModal.classList.remove("hidden");
  }

  function hideCannedMessageModal() {
    if (!cannedMessageModal) {
      return;
    }
    cannedMessageModal.classList.add("hidden");
    currentCannedMessage = "";
  }

  function sendCannedMessage() {
    const names = [];
    if (cannedCheckA && cannedCheckA.checked) {
      names.push(appState.participantA || "参加者A");
    }
    if (cannedCheckB && cannedCheckB.checked) {
      names.push(appState.participantB || "参加者B");
    }

    let message = currentCannedMessage;
    if (names.length > 0) {
      message = `${names.join("さん、")}さん、${currentCannedMessage}`;
    }

    sendPrompt(message);
    hideCannedMessageModal();
  }

  async function fetchThemes() {
    try {
      const response = await fetch("/api/themes");
      if (!response.ok) {
        throw new Error(`Failed to load themes: ${response.status}`);
      }
      const data = await response.json();
      const payload = Array.isArray(data.themes) ? data.themes : [];
      allThemes = payload.map((item, index) => {
        const noValue = String(item?.no || item?.id || index + 1);
        const baseHints = Array.isArray(item?.baseHints)
          ? item.baseHints.filter(Boolean)
          : Array.isArray(item?.hints)
            ? item.hints.filter(Boolean)
            : [];
        const extraHint1 = Array.isArray(item?.extraHint1) ? item.extraHint1.filter(Boolean) : [];
        const extraHint2 = Array.isArray(item?.extraHint2) ? item.extraHint2.filter(Boolean) : [];
        const marks = Array.isArray(item?.marks) ? item.marks.filter(Boolean) : [];
        return {
          id: noValue,
          no: noValue,
          category: (item?.category || "カテゴリ未設定").trim() || "カテゴリ未設定",
          title: (item?.title || "").trim(),
          baseHints,
          extraHint1,
          extraHint2,
          marks,
        };
      });

      themeById = new Map();
      themesByCategory = new Map();
      categoryOrder = [];
      allThemes.forEach((theme) => {
        themeById.set(theme.id, theme);
        if (!themesByCategory.has(theme.category)) {
          themesByCategory.set(theme.category, []);
        }
        themesByCategory.get(theme.category).push(theme);
      });
      categoryOrder = Array.from(themesByCategory.keys()).sort((a, b) => a.localeCompare(b, "ja"));
      categoryOrder.forEach((category) => {
        const list = themesByCategory.get(category);
        list.sort((a, b) => {
          const aNo = Number(a.no);
          const bNo = Number(b.no);
          if (!Number.isNaN(aNo) && !Number.isNaN(bNo)) {
            return aNo - bNo;
          }
          return (a.title || "").localeCompare(b.title || "", "ja");
        });
      });

      const validUsed = new Set();
      usedThemeIds.forEach((id) => {
        if (themeById.has(id)) {
          validUsed.add(id);
        }
      });
      usedThemeIds.clear();
      validUsed.forEach((id) => usedThemeIds.add(id));
      if (currentThemeId && !themeById.has(currentThemeId)) {
        currentThemeId = null;
      }

      renderCategoryButtons();
      closeThemePopover();
      updateThemeCounters();
      updateThemePreview();
      broadcastTheme();
    } catch (error) {
      console.error(error);
      allThemes = [];
      themeById = new Map();
      themesByCategory = new Map();
      categoryOrder = [];
      usedThemeIds.clear();
      themeHistory.length = 0;
      currentThemeId = null;
      closeThemePopover();
      renderCategoryButtons();
      updateThemeCounters();
      updateThemePreview();
      broadcastTheme();
    }
  }

  function renderNoteRow(row, targetRow) {
    if (!notesTableBody) {
      return;
    }
    const html = `
      <td class="px-3 py-2 font-mono text-xs text-slate-700">${row.timecode || "--:--:--"}</td>
      <td class="px-3 py-2 text-slate-600">${row.groupId || "-"}</td>
      <td class="px-3 py-2 text-slate-600">${row.session || "-"}</td>
      <td class="px-3 py-2 text-slate-700">${row.content || "(内容なし)"}</td>
      <td class="px-3 py-2 text-slate-500">${row.category || ""}</td>
    `;
    if (targetRow) {
      targetRow.className = "bg-white last:rounded-b-lg";
      targetRow.innerHTML = html;
    } else {
      const tr = document.createElement("tr");
      tr.className = "bg-white last:rounded-b-lg";
      tr.innerHTML = html;
      notesTableBody.prepend(tr);
    }
  }

  function createPendingRow(note) {
    if (!notesTableBody) {
      return null;
    }
    const tr = document.createElement("tr");
    tr.className = "bg-blue-50 last:rounded-b-lg";
    tr.innerHTML = `
      <td class="px-3 py-2 font-mono text-xs text-blue-700">${note.timecode}</td>
      <td class="px-3 py-2 text-slate-600">${note.groupId}</td>
      <td class="px-3 py-2 text-slate-600">${note.session}</td>
      <td class="px-3 py-2 italic text-slate-500">内容入力待ち...</td>
      <td class="px-3 py-2 text-slate-500">${note.categoryDisplay}</td>
    `;
    notesTableBody.prepend(tr);
    return tr;
  }

  function resetPendingState(keepCategory = false, lastCategory = "", customLabel = "") {
    pendingNote = null;
    pendingRow = null;
    noteActionBtn.textContent = "保存";
    if (noteActionBtn) {
      noteActionBtn.disabled = true;
    }
    cancelNoteBtn?.classList.add("hidden");
    inputContent.value = "";
    if (categorySelect) {
      if (!keepCategory) {
        categorySelect.value = "";
        categoryOtherWrapper?.classList.add("hidden");
        if (inputCategoryOther) {
          inputCategoryOther.value = "";
        }
      } else if (lastCategory) {
        categorySelect.value = lastCategory;
        if (categorySelect.value === "その他") {
          categoryOtherWrapper?.classList.remove("hidden");
          if (inputCategoryOther) {
            inputCategoryOther.value = customLabel;
          }
        } else {
          categoryOtherWrapper?.classList.add("hidden");
        }
      }
    }
    if (contentWrapper) {
      if (contentManuallyShown) {
        contentWrapper.classList.remove("hidden");
        if (toggleContentBtn) {
          toggleContentBtn.textContent = "詳細メモ欄を隠す";
        }
      } else {
        contentWrapper.classList.add("hidden");
        if (toggleContentBtn) {
          toggleContentBtn.textContent = "詳細メモ欄を開く";
        }
      }
    }
  }

  async function logThemeChange(theme) {
    if (!appState.groupId || !appState.session) {
      return;
    }
    const labelParts = [];
    if (theme?.no) {
      labelParts.push(`No.${theme.no}`);
    }
    if (theme?.title) {
      labelParts.push(theme.title);
    }
    const themeLabel = labelParts.join(" ") || "テーマ変更";
    const content = theme?.category ? `${themeLabel} (${theme.category})` : themeLabel;
    const payload = {
      groupId: appState.groupId,
      session: appState.session,
      category: THEME_CHANGE_CATEGORY,
      content: `テーマ変更: ${content}`,
      timecode: formatTime(durationSeconds - remainingSeconds),
    };

    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Failed to log theme change");
      }
      if (data.row) {
        renderNoteRow(data.row);
      }
    } catch (error) {
      console.error("Failed to log theme change", error);
    }
  }

  function cancelPendingNote() {
    if (pendingRow && pendingRow.parentElement) {
      pendingRow.parentElement.removeChild(pendingRow);
    }
    resetPendingState();
  }

  function handleCaptureNote() {
    if (!appState.groupId || !appState.session) {
      alert("まずセッション情報を登録してください。");
      showSetupModal();
      return;
    }

    if (pendingNote) {
      const shouldContinue = window.confirm("保存されていないメモがあります。内容を入力せずに新しいタイムコードを記録しますか？");
      if (!shouldContinue) {
        return;
      }
      cancelPendingNote();
    }

    let categoryValue = categorySelect ? categorySelect.value : "";
    if (!categoryValue) {
      alert("カテゴリを選択してください。");
      categorySelect?.focus();
      return;
    }

    let categoryLabel = categoryValue;
    if (categoryValue === "その他") {
      const custom = inputCategoryOther?.value.trim() || "";
      if (!custom) {
        alert("その他カテゴリの内容を入力してください。");
        inputCategoryOther?.focus();
        return;
      }
      categoryLabel = custom;
    }

    const note = {
      groupId: appState.groupId,
      session: appState.session,
      categoryDisplay: categoryLabel,
      rawCategory: categoryValue,
      timecode: formatTime(durationSeconds - remainingSeconds),
    };

    pendingNote = note;
    pendingRow = createPendingRow(note);
    if (noteActionBtn) {
      noteActionBtn.disabled = false;
    }
    cancelNoteBtn?.classList.remove("hidden");
    if (contentManuallyShown) {
      contentWrapper?.classList.remove("hidden");
      if (toggleContentBtn) {
        toggleContentBtn.textContent = "詳細メモ欄を隠す";
      }
      inputContent.focus();
    } else if (toggleContentBtn) {
      toggleContentBtn.textContent = "詳細メモ欄を開く";
    }
  }

  async function submitNote(event) {
    event.preventDefault();

    if (!pendingNote) {
      alert("先に「タイムコードを記録」を押してください。");
      return;
    }

    const content = inputContent.value.trim();
    const payload = {
      groupId: pendingNote.groupId,
      session: pendingNote.session,
      category: pendingNote.categoryDisplay,
      content,
      timecode: pendingNote.timecode,
    };

    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "保存に失敗しました");
      }
      const lastCategory = pendingNote.rawCategory;
      const lastCustom = pendingNote.rawCategory === "その他" ? pendingNote.categoryDisplay : "";
      renderNoteRow(data.row, pendingRow);
      resetPendingState(true, lastCategory, lastCustom);
    } catch (error) {
      console.error(error);
      alert("メモの保存に失敗しました。コンソールを確認してください。");
    }
  }

  function toggleContentArea() {
    if (!contentWrapper) {
      return;
    }
    const isHidden = contentWrapper.classList.contains("hidden");
    if (isHidden) {
      contentWrapper.classList.remove("hidden");
      contentManuallyShown = true;
      if (toggleContentBtn) {
        toggleContentBtn.textContent = "詳細メモ欄を隠す";
      }
    } else {
      contentWrapper.classList.add("hidden");
      contentManuallyShown = false;
      if (toggleContentBtn) {
        toggleContentBtn.textContent = "詳細メモ欄を開く";
      }
    }
  }

  function runStartSequence(resetRemaining) {
    clearAllTimeouts();
    preRollActive = true;
    emitOverlay({ mode: "clear" });
    const steps = [];
    for (let count = settings.startCountdown; count >= 1; count -= 1) {
      steps.push({
        value: toFullWidthDigits(count),
        note: "まだ声は出さないでください",
        hold: 1000,
      });
    }
    steps.push({ value: "スタート", note: "", hold: 3000, triggerStart: true });

    let elapsed = 0;
    steps.forEach((step) => {
      scheduleTimeout(() => {
        emitOverlay({ mode: "countdown", value: step.value, note: step.note });
        if (step.triggerStart) {
          const startTimestamp = Date.now();
          startTimerCore(resetRemaining);
          const segmentId = String(sessionCount);
          currentSegmentId = segmentId;
          const segment = ensureSegment(segmentId);
          if (segment) {
            segment.startTimestamp = startTimestamp;
            segment.order = Number(segmentId);
            segment.groupId = appState.groupId;
            segment.session = appState.session;
            segment.participants = [appState.participantA, appState.participantB];
            segment.director = appState.director;
          }
          void notifySessionStart(startTimestamp);
        }
      }, elapsed);
      elapsed += step.hold;
    });

    scheduleTimeout(() => {
      emitOverlay({ mode: "clear" });
      restorePromptMessage();
      preRollActive = false;
    }, elapsed);
  }

  function runCompletionSequence() {
    if (completionSequenceStarted) {
      return;
    }
    completionSequenceStarted = true;
    clearAllTimeouts();

    const steps = [];
    const finishNote = "全員、声を出さないようお気をつけください";
    for (let count = settings.finishCountdown; count >= 1; count -= 1) {
      steps.push({
        value: toFullWidthDigits(count),
        note: finishNote,
        hold: 1000,
      });
    }
    steps.push({
      value: "終了",
      note: "",
      hold: settings.finishHold * 1000,
      final: true,
    });

    let elapsed = 0;
    steps.forEach((step) => {
      scheduleTimeout(() => {
        emitOverlay({ mode: "countdown", value: step.value, note: step.note });
      }, elapsed);
      elapsed += step.hold;
      if (step.final) {
        scheduleTimeout(() => {
          emitOverlay({ mode: "clear" });
          sendPrompt("お疲れ様でした。声を出して結構です。");
          showStopRecordingModal();
        }, elapsed);
      }
    });
  }

  function triggerDownload(filename, base64Content, mimeType = "text/csv;charset=utf-8") {
    if (!base64Content) {
      console.warn("triggerDownload called without content");
      return;
    }
    const binary = atob(base64Content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  async function handleFinishSubmit(event) {
    event.preventDefault();
    if (!appState.groupId || !appState.session) {
      alert("セッション情報が登録されていません。");
      hideFinishModal();
      showSetupModal();
      return;
    }
    const formData = new FormData(finishForm);
    const take = formData.get("finish-take") || "1";
    const summary = finishSummary ? finishSummary.value.trim() : "";

    try {
      const response = await fetch("/api/export-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: appState.groupId,
          session: appState.session,
          take,
          summary,
          director: appState.director,
          participants: [appState.participantA, appState.participantB],
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "CSV の生成に失敗しました");
      }
      const takeKey = String(take);
      const mappedSegmentId = segmentByTake[takeKey] || currentSegmentId;
      const targetSegment = ensureSegment(mappedSegmentId);
      if (targetSegment) {
        targetSegment.summary = summary;
        targetSegment.take = takeKey;
        segmentByTake[takeKey] = targetSegment.id;
      }
      const existingIndex = finishedTakes.findIndex((item) => item.take === take);
      const record = { take, summary, exportedAt: new Date().toISOString() };
      if (existingIndex >= 0) {
        finishedTakes.splice(existingIndex, 1, record);
      } else {
        finishedTakes.push(record);
      }
      triggerDownload(data.filename || `export_${Date.now()}.csv`, data.content || "");
      hideFinishModal();
      alert(`CSV をダウンロードしました (記録数: ${data.rows ?? 0}件)`);
      void fetchSessionStatus();
    } catch (error) {
      console.error(error);
      alert("CSV のエクスポートに失敗しました。コンソールを確認してください。");
    }
  }

  function handlePostSessionSubmit(event) {
    event.preventDefault();
    const segmentId = postSessionModal?.dataset.segmentId || currentSegmentId || String(sessionCount);
    const segment = ensureSegment(segmentId);
    if (segment && postSessionNoteInput) {
      segment.note = postSessionNoteInput.value.trim();
    }
    hidePostSessionModal();
    breakBtn?.focus();
  }

  function handlePostSessionSkip(event) {
    event?.preventDefault();
    const segmentId = postSessionModal?.dataset.segmentId || currentSegmentId || String(sessionCount);
    const segment = ensureSegment(segmentId);
    if (segment) {
      segment.note = "";
    }
    hidePostSessionModal();
    breakBtn?.focus();
  }

  function handleSocketPrompt(payload) {
    const message = (payload && payload.message) || "";
    if (!message) {
      lastPromptLabel.textContent = "未送信";
      lastPromptMessage = "";
      return;
    }
    lastPromptLabel.textContent = message;
    lastPromptMessage = message;
  }

  // パターン別メッセージパネルのトグル
  function toggleTemplatePanel(forceExpand) {
    if (!templateCategoryGrid || !templatePanelIndicator) {
      return;
    }
    if (typeof forceExpand === "boolean") {
      templatePromptPanelExpanded = forceExpand;
    } else {
      templatePromptPanelExpanded = !templatePromptPanelExpanded;
    }

    if (templatePromptPanelExpanded) {
      templateCategoryGrid.classList.remove("hidden");
      templatePanelIndicator.textContent = "閉じる";
      if (templatePanelIndicatorIcon) {
        templatePanelIndicatorIcon.style.transform = "rotate(180deg)";
      }
      renderTemplateCategoryButtons();
    } else {
      templateCategoryGrid.classList.add("hidden");
      templatePanelIndicator.textContent = "開く";
      if (templatePanelIndicatorIcon) {
        templatePanelIndicatorIcon.style.transform = "";
      }
    }
  }

  // パターン別メッセージカテゴリボタンのレンダリング
  function renderTemplateCategoryButtons() {
    if (!templateCategoryGrid) {
      return;
    }
    templateCategoryGrid.innerHTML = "";

    Object.keys(TEMPLATE_PROMPTS).forEach((category) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rounded-xl border-2 border-gh-border bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-md transition-all hover:scale-105 hover:border-gh-blue hover:bg-slate-50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gh-blue/50";
      btn.textContent = category;
      btn.addEventListener("click", () => {
        showTemplatePopover(category);
      });
      templateCategoryGrid.appendChild(btn);
    });
  }

  // パターン別メッセージポップオーバー表示
  function showTemplatePopover(category) {
    if (!templatePopover) {
      return;
    }
    currentTemplateCategory = category;
    const prompts = TEMPLATE_PROMPTS[category] || [];

    templatePopover.innerHTML = "";
    templatePopover.classList.remove("pointer-events-none");
    templatePopover.classList.remove("hidden");

    // ヘッダー
    const header = document.createElement("div");
    header.className = "mb-4 flex items-start justify-between gap-4 border-b border-purple-100 pb-4";

    const headerLeft = document.createElement("div");
    headerLeft.className = "flex-1";

    const categoryBadge = document.createElement("span");
    categoryBadge.className = "rounded-md bg-purple-200/50 px-2 py-1 text-xs font-black uppercase tracking-widest text-purple-700";
    categoryBadge.textContent = "パターン別メッセージ";

    const categoryTitle = document.createElement("h3");
    categoryTitle.className = "mt-2 text-2xl font-black text-purple-900";
    categoryTitle.textContent = category;

    headerLeft.appendChild(categoryBadge);
    headerLeft.appendChild(categoryTitle);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "rounded-full border border-gh-border px-3 py-1 text-xs font-semibold text-gh-textMuted hover:bg-gh-bg focus:outline-none focus:ring-2 focus:ring-gh-border";
    closeBtn.textContent = "閉じる";
    closeBtn.addEventListener("click", closeTemplatePopover);

    header.appendChild(headerLeft);
    header.appendChild(closeBtn);
    templatePopover.appendChild(header);

    // 参加者チェックボックス
    const participantSection = document.createElement("div");
    participantSection.className = "mb-4 rounded-xl border border-gh-border bg-gh-bg p-4";

    const participantLabel = document.createElement("div");
    participantLabel.className = "mb-2 text-xs font-bold text-gh-text";
    participantLabel.textContent = "宛先を指定（任意）";

    const checkboxGroup = document.createElement("div");
    checkboxGroup.className = "flex gap-4";

    const checkA = document.createElement("label");
    checkA.className = "flex items-center gap-2 cursor-pointer";
    const inputA = document.createElement("input");
    inputA.type = "checkbox";
    inputA.id = "template-check-a";
    inputA.className = "h-4 w-4 rounded border-gh-border text-gh-blue focus:ring-gh-blue";
    const labelA = document.createElement("span");
    labelA.className = "text-sm font-semibold text-gh-text";
    labelA.textContent = appState.participantA || "参加者A";
    checkA.appendChild(inputA);
    checkA.appendChild(labelA);

    const checkB = document.createElement("label");
    checkB.className = "flex items-center gap-2 cursor-pointer";
    const inputB = document.createElement("input");
    inputB.type = "checkbox";
    inputB.id = "template-check-b";
    inputB.className = "h-4 w-4 rounded border-gh-border text-gh-blue focus:ring-gh-blue";
    const labelB = document.createElement("span");
    labelB.className = "text-sm font-semibold text-gh-text";
    labelB.textContent = appState.participantB || "参加者B";
    checkB.appendChild(inputB);
    checkB.appendChild(labelB);

    checkboxGroup.appendChild(checkA);
    checkboxGroup.appendChild(checkB);
    participantSection.appendChild(participantLabel);
    participantSection.appendChild(checkboxGroup);
    templatePopover.appendChild(participantSection);

    // プロンプトリスト
    const promptList = document.createElement("div");
    promptList.className = "flex flex-col gap-2";

    prompts.forEach((prompt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rounded-lg border border-gh-border bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 shadow-sm transition-all hover:scale-[1.02] hover:border-gh-blue hover:bg-slate-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gh-blue/50";
      btn.textContent = prompt;
      btn.addEventListener("click", () => {
        sendTemplatePrompt(prompt);
      });
      promptList.appendChild(btn);
    });

    templatePopover.appendChild(promptList);
  }

  // パターン別メッセージを送信
  function sendTemplatePrompt(prompt) {
    const checkA = document.getElementById("template-check-a");
    const checkB = document.getElementById("template-check-b");
    const names = [];

    if (checkA && checkA.checked) {
      names.push(appState.participantA || "参加者A");
    }
    if (checkB && checkB.checked) {
      names.push(appState.participantB || "参加者B");
    }

    let message = prompt;
    if (names.length > 0) {
      message = `${names.join("さん、")}さん、${prompt}`;
    }

    sendPrompt(message);
    // Show colored notice to indicate pattern message
    emitOverlay({ mode: "notice", message: `💬 ${message}`, level: "info", ttlMs: 4000 });
    closeTemplatePopover();
  }

  // パターン別メッセージポップオーバーを閉じる
  function closeTemplatePopover() {
    if (!templatePopover) {
      return;
    }
    templatePopover.classList.add("hidden");
    templatePopover.classList.add("pointer-events-none");
    currentTemplateCategory = null;
  }

  // ===== 固定メッセージ管理 =====
  let editingMessages = [];

  function loadCannedMessagesEditor() {
    editingMessages = [...getCannedMessages()];
    renderCannedMessagesList();
  }

  function renderCannedMessagesList() {
    if (!cannedMessagesList || !cannedMessageCount) {
      return;
    }

    const maxMessages = 10;
    cannedMessageCount.textContent = `${editingMessages.length} / ${maxMessages} 件`;

    cannedMessagesList.innerHTML = "";

    if (editingMessages.length === 0) {
      const emptyMsg = document.createElement("p");
      emptyMsg.className = "text-center text-sm text-gh-textMuted py-8";
      emptyMsg.textContent = "メッセージが登録されていません";
      cannedMessagesList.appendChild(emptyMsg);
      return;
    }

    editingMessages.forEach((message, index) => {
      const row = document.createElement("div");
      row.className = "flex items-center gap-2 rounded-lg border border-gh-border bg-gh-bg p-3 group hover:border-gh-blue transition";

      const messageText = document.createElement("span");
      messageText.className = "flex-1 text-sm text-gh-text truncate";
      messageText.textContent = message;
      messageText.title = message;

      const buttonGroup = document.createElement("div");
      buttonGroup.className = "flex items-center gap-1";

      // 上へ移動
      if (index > 0) {
        const upBtn = document.createElement("button");
        upBtn.type = "button";
        upBtn.className = "rounded px-2 py-1 text-xs font-semibold text-gh-textMuted hover:bg-gh-canvas hover:text-gh-blue transition";
        upBtn.textContent = "↑";
        upBtn.title = "上へ";
        upBtn.addEventListener("click", () => {
          [editingMessages[index - 1], editingMessages[index]] = [editingMessages[index], editingMessages[index - 1]];
          renderCannedMessagesList();
        });
        buttonGroup.appendChild(upBtn);
      }

      // 下へ移動
      if (index < editingMessages.length - 1) {
        const downBtn = document.createElement("button");
        downBtn.type = "button";
        downBtn.className = "rounded px-2 py-1 text-xs font-semibold text-gh-textMuted hover:bg-gh-canvas hover:text-gh-blue transition";
        downBtn.textContent = "↓";
        downBtn.title = "下へ";
        downBtn.addEventListener("click", () => {
          [editingMessages[index], editingMessages[index + 1]] = [editingMessages[index + 1], editingMessages[index]];
          renderCannedMessagesList();
        });
        buttonGroup.appendChild(downBtn);
      }

      // 削除
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "rounded px-2 py-1 text-xs font-semibold text-gh-textMuted hover:bg-gh-red hover:text-white transition";
      deleteBtn.textContent = "削除";
      deleteBtn.addEventListener("click", () => {
        if (confirm(`「${message}」を削除しますか？`)) {
          editingMessages.splice(index, 1);
          renderCannedMessagesList();
        }
      });
      buttonGroup.appendChild(deleteBtn);

      row.appendChild(messageText);
      row.appendChild(buttonGroup);
      cannedMessagesList.appendChild(row);
    });
  }

  function addCannedMessage() {
    if (!newCannedMessageInput) {
      return;
    }

    const message = newCannedMessageInput.value.trim();
    if (!message) {
      alert("メッセージを入力してください");
      return;
    }

    if (editingMessages.length >= 10) {
      alert("メッセージは最大10件まで登録できます");
      return;
    }

    if (editingMessages.includes(message)) {
      alert("同じメッセージが既に登録されています");
      return;
    }

    editingMessages.push(message);
    newCannedMessageInput.value = "";
    renderCannedMessagesList();
  }

  function saveCannedMessages() {
    if (editingMessages.length === 0) {
      if (!confirm("メッセージが0件です。このまま保存しますか？")) {
        return;
      }
    }

    try {
      localStorage.setItem("canned_messages", JSON.stringify(editingMessages));
      buildPromptButtons();
      alert("固定メッセージを保存しました");
    } catch (e) {
      console.error("Failed to save canned messages:", e);
      alert("保存に失敗しました");
    }
  }

  function resetCannedMessages() {
    if (!confirm("固定メッセージをデフォルトに戻しますか？\nこの操作は元に戻せません。")) {
      return;
    }

    localStorage.removeItem("canned_messages");
    loadCannedMessagesEditor();
    buildPromptButtons();
    alert("デフォルトに戻しました");
  }

  // ===== 記録カテゴリ管理 =====
  let editingCategories = [];

  function getReportCategories() {
    const stored = localStorage.getItem("report_categories");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse report categories:", e);
      }
    }
    return config.categories || [];
  }

  function loadReportCategoriesEditor() {
    editingCategories = [...getReportCategories()];
    renderReportCategoriesList();
  }

  function renderReportCategoriesList() {
    if (!reportCategoriesList || !reportCategoryCount) {
      return;
    }

    const maxCategories = 10;
    reportCategoryCount.textContent = `${editingCategories.length} / ${maxCategories} 件`;

    reportCategoriesList.innerHTML = "";

    if (editingCategories.length === 0) {
      const emptyMsg = document.createElement("p");
      emptyMsg.className = "text-center text-sm text-gh-textMuted py-8";
      emptyMsg.textContent = "カテゴリが登録されていません";
      reportCategoriesList.appendChild(emptyMsg);
      return;
    }

    editingCategories.forEach((category, index) => {
      const row = document.createElement("div");
      row.className = "flex items-center gap-2 rounded-lg border border-gh-border bg-gh-bg p-3 group hover:border-gh-blue transition";

      const categoryText = document.createElement("span");
      categoryText.className = "flex-1 text-sm text-gh-text truncate";
      categoryText.textContent = category;
      categoryText.title = category;

      const buttonGroup = document.createElement("div");
      buttonGroup.className = "flex items-center gap-1";

      // 上へ移動
      if (index > 0) {
        const upBtn = document.createElement("button");
        upBtn.type = "button";
        upBtn.className = "rounded px-2 py-1 text-xs font-semibold text-gh-textMuted hover:bg-gh-canvas hover:text-gh-blue transition";
        upBtn.textContent = "↑";
        upBtn.title = "上へ";
        upBtn.addEventListener("click", () => {
          [editingCategories[index - 1], editingCategories[index]] = [editingCategories[index], editingCategories[index - 1]];
          renderReportCategoriesList();
        });
        buttonGroup.appendChild(upBtn);
      }

      // 下へ移動
      if (index < editingCategories.length - 1) {
        const downBtn = document.createElement("button");
        downBtn.type = "button";
        downBtn.className = "rounded px-2 py-1 text-xs font-semibold text-gh-textMuted hover:bg-gh-canvas hover:text-gh-blue transition";
        downBtn.textContent = "↓";
        downBtn.title = "下へ";
        downBtn.addEventListener("click", () => {
          [editingCategories[index], editingCategories[index + 1]] = [editingCategories[index + 1], editingCategories[index]];
          renderReportCategoriesList();
        });
        buttonGroup.appendChild(downBtn);
      }

      // 削除
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "rounded px-2 py-1 text-xs font-semibold text-gh-textMuted hover:bg-gh-red hover:text-white transition";
      deleteBtn.textContent = "削除";
      deleteBtn.addEventListener("click", () => {
        if (confirm(`「${category}」を削除しますか？`)) {
          editingCategories.splice(index, 1);
          renderReportCategoriesList();
        }
      });
      buttonGroup.appendChild(deleteBtn);

      row.appendChild(categoryText);
      row.appendChild(buttonGroup);
      reportCategoriesList.appendChild(row);
    });
  }

  function addReportCategory() {
    if (!newReportCategoryInput) {
      return;
    }

    const category = newReportCategoryInput.value.trim();
    if (!category) {
      alert("カテゴリ名を入力してください");
      return;
    }

    if (editingCategories.length >= 10) {
      alert("カテゴリは最大10件まで登録できます");
      return;
    }

    if (editingCategories.includes(category)) {
      alert("同じカテゴリが既に登録されています");
      return;
    }

    editingCategories.push(category);
    newReportCategoryInput.value = "";
    renderReportCategoriesList();
  }

  function saveReportCategories() {
    if (editingCategories.length === 0) {
      if (!confirm("カテゴリが0件です。このまま保存しますか？")) {
        return;
      }
    }

    try {
      localStorage.setItem("report_categories", JSON.stringify(editingCategories));
      updateCategorySelect();
      alert("記録カテゴリを保存しました");
    } catch (e) {
      console.error("Failed to save report categories:", e);
      alert("保存に失敗しました");
    }
  }

  function resetReportCategories() {
    if (!confirm("記録カテゴリをデフォルトに戻しますか？\nこの操作は元に戻せません。")) {
      return;
    }

    localStorage.removeItem("report_categories");
    loadReportCategoriesEditor();
    updateCategorySelect();
    alert("デフォルトに戻しました");
  }

  function updateCategorySelect() {
    if (!categorySelect) {
      return;
    }

    const categories = getReportCategories();
    const currentValue = categorySelect.value;

    // Clear existing options except the first one
    while (categorySelect.options.length > 1) {
      categorySelect.remove(1);
    }

    // Add category options
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      categorySelect.appendChild(option);
    });

    // Restore previous value if it still exists
    if (currentValue && categories.includes(currentValue)) {
      categorySelect.value = currentValue;
    }
  }

  // ============================================================
  // 画面注目設定管理
  // ============================================================

  function getAttentionSettings() {
    const stored = localStorage.getItem("attention_settings");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse attention settings:", e);
      }
    }
    // デフォルト値
    return { duration: 3, message: "画面に注目してください" };
  }

  function loadAttentionSettingsEditor() {
    if (!attentionDurationInput || !attentionMessageInput) {
      return;
    }

    const settings = getAttentionSettings();
    attentionDurationInput.value = settings.duration;
    attentionMessageInput.value = settings.message;
  }

  function saveAttentionSettings() {
    if (!attentionDurationInput || !attentionMessageInput) {
      return;
    }

    const duration = parseInt(attentionDurationInput.value, 10);
    const message = attentionMessageInput.value.trim();

    if (isNaN(duration) || duration < 1 || duration > 10) {
      alert("表示時間は1〜10秒の範囲で指定してください");
      return;
    }

    if (!message) {
      alert("表示メッセージを入力してください");
      return;
    }

    if (message.length > 50) {
      alert("表示メッセージは50文字以内で入力してください");
      return;
    }

    const settings = { duration, message };

    try {
      localStorage.setItem("attention_settings", JSON.stringify(settings));
      alert("画面注目設定を保存しました");
    } catch (e) {
      console.error("Failed to save attention settings:", e);
      alert("保存に失敗しました");
    }
  }

  function resetAttentionSettings() {
    if (!confirm("画面注目設定をデフォルトに戻しますか？\nこの操作は元に戻せません。")) {
      return;
    }

    localStorage.removeItem("attention_settings");
    loadAttentionSettingsEditor();
    alert("デフォルトに戻しました");
  }

  function init() {
    updateSessionLengthLabel();
    syncSettingsForm();
    updateTimerDisplay();
    buildPromptButtons();
    updateCategorySelect();
    if (typeof config.totalThemes === "number") {
      const initialCount = Math.max(0, Number(config.totalThemes) || 0);
      if (themeTotalLabel) {
        themeTotalLabel.textContent = String(initialCount);
      }
      if (themeTotalHeaderLabel) {
        themeTotalHeaderLabel.textContent = String(initialCount);
      }
      if (themeRemainingLabel) {
        themeRemainingLabel.textContent = String(initialCount);
      }
    }
    if (categoryGrid) {
      categoryGrid.innerHTML =
        '<div class="col-span-full text-center text-xs text-slate-400">テーマを読み込み中...</div>';
    }
    fetchThemes();
    applyAppState();
    fillSetupForm();
    showZoomShareModal(); // 最初にZoom共有確認を表示
    resetPendingState();
    updateThemePreview();
    toggleThemePanel(false);
    if (hasOffsetUi) {
      renderOffsetStatus(null);
      void fetchSessionStatus();
      startOffsetPolling();
    }

    startBtn.addEventListener("click", startTimer);
    stopBtn.addEventListener("click", stopTimer);
    resetBtn.addEventListener("click", resetTimer);

    sendCustomPromptBtn.addEventListener("click", () => {
      sendPrompt(customPromptInput.value);
      customPromptInput.value = "";
    });
    customPromptInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendPrompt(customPromptInput.value);
        customPromptInput.value = "";
      }
    });
    clearPromptBtn.addEventListener("click", () => {
      socket.emit("clear_prompt");
      lastPromptLabel.textContent = "未送信";
      lastPromptMessage = "";
    });

    screenAttentionBtn.addEventListener("click", () => {
      socket.emit("screen_attention");
    });

    noteForm.addEventListener("submit", submitNote);
    cancelNoteBtn?.addEventListener("click", cancelPendingNote);
    captureNoteBtn?.addEventListener("click", handleCaptureNote);
    toggleContentBtn?.addEventListener("click", toggleContentArea);

    if (categorySelect) {
      categorySelect.addEventListener("change", () => {
        if (categorySelect.value === "その他") {
          categoryOtherWrapper?.classList.remove("hidden");
        } else {
          categoryOtherWrapper?.classList.add("hidden");
          if (inputCategoryOther) {
            inputCategoryOther.value = "";
          }
        }
      });
    }

    zoomShareConfirm?.addEventListener("click", () => {
      hideZoomShareModal();
      showSetupModal();
    });

    setupForm?.addEventListener("submit", handleSetupSubmit);
    openSetupBtn?.addEventListener("click", () => {
      fillSetupForm();
      showSetupModal();
    });
    finishBtn?.addEventListener("click", showFinishModal);
    finishCancel?.addEventListener("click", hideFinishModal);
    finishForm?.addEventListener("submit", handleFinishSubmit);
    exportSummaryBtn?.addEventListener("click", openFinalExportModal);

    offsetManualForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!offsetManualInput) {
        return;
      }
      const rawText = offsetManualInput.value?.trim() ?? "";
      if (!rawText) {
        alert("手動補正を秒数で入力してください。（例: 0.85）");
        return;
      }
      const raw = Number(rawText);
      if (Number.isNaN(raw)) {
        alert("手動補正を秒数で入力してください。（例: 0.85）");
        return;
      }
      void submitManualOffset(raw);
    });
    offsetManualClearBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      void clearManualOffset();
    });
    offsetRefreshBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      void fetchSessionStatus({ showAlertOnError: true });
    });

    syncConfirmBtn?.addEventListener("click", handleSyncConfirm);
    syncCancelBtn?.addEventListener("click", handleSyncCancel);
    stopRecordingConfirmBtn?.addEventListener("click", () => {
      hideStopRecordingModal();
      showPostSessionModal();
    });
    postSessionForm?.addEventListener("submit", handlePostSessionSubmit);
    postSessionSkipBtn?.addEventListener("click", handlePostSessionSkip);
    breakBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      startBreakCountdown();
    });
    breakCancelBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      cancelBreak();
    });
    finalExportForm?.addEventListener("submit", handleFinalExportSubmit);
    finalExportCancelBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      closeFinalExportModal();
    });
    finalExportFilesInput?.addEventListener("change", updateFinalExportFileList);

    openSettingsBtn?.addEventListener("click", showSettingsModal);
    settingsCancel?.addEventListener("click", hideSettingsModal);
    settingsForm?.addEventListener("submit", handleSettingsSubmit);
    settingsReset?.addEventListener("click", () => {
      syncSettingsForm(DEFAULT_SETTINGS);
      settingsDurationInput?.focus();
      settingsDurationInput?.select();
    });

    // Settings tab switching
    settingsTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const tabName = tab.dataset.tab;
        settingsTabs.forEach((t) => {
          t.classList.remove("active", "bg-gh-blue", "text-white");
          t.classList.add("border", "border-gh-border", "bg-gh-bg", "text-gh-text");
        });
        tab.classList.add("active", "bg-gh-blue", "text-white");
        tab.classList.remove("border", "border-gh-border", "bg-gh-bg", "text-gh-text");

        document.querySelectorAll(".settings-tab-content").forEach((content) => {
          content.classList.add("hidden");
        });
        const targetContent = document.getElementById(`tab-${tabName}`);
        if (targetContent) {
          targetContent.classList.remove("hidden");
        }

        // Load editors when tabs are opened
        if (tabName === "messages") {
          loadCannedMessagesEditor();
        } else if (tabName === "categories") {
          loadReportCategoriesEditor();
        } else if (tabName === "attention") {
          loadAttentionSettingsEditor();
        }
      });
    });

    // CSV reload
    reloadThemesBtn?.addEventListener("click", async () => {
      const password = adminPasswordInput?.value || "";
      const resetHistory = resetThemeHistoryCheckbox?.checked || false;

      if (!password) {
        alert("管理者パスワードを入力してください");
        return;
      }

      if (!confirm("トークテーマCSVを再読み込みしますか？\nこの操作は元に戻せません。")) {
        return;
      }

      try {
        const response = await fetch("/api/reload-themes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password, resetHistory }),
        });

        const result = await response.json();
        if (response.ok && result.success) {
          alert(`CSVを再読み込みしました。\nテーマ数: ${result.count}`);
          if (resetHistory) {
            localStorage.removeItem("theme_history");
            updateThemeHistory();
          }
          location.reload();
        } else {
          alert(`エラー: ${result.error || "再読み込みに失敗しました"}`);
        }
      } catch (err) {
        console.error("CSV reload error:", err);
        alert("通信エラーが発生しました");
      }
    });

    // Canned message management
    addCannedMessageBtn?.addEventListener("click", addCannedMessage);
    newCannedMessageInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        addCannedMessage();
      }
    });
    saveCannedMessagesBtn?.addEventListener("click", saveCannedMessages);
    resetCannedMessagesBtn?.addEventListener("click", resetCannedMessages);

    // Report category management
    addReportCategoryBtn?.addEventListener("click", addReportCategory);
    newReportCategoryInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        addReportCategory();
      }
    });
    saveReportCategoriesBtn?.addEventListener("click", saveReportCategories);
    resetReportCategoriesBtn?.addEventListener("click", resetReportCategories);

    // Screen attention settings
    saveAttentionSettingsBtn?.addEventListener("click", saveAttentionSettings);
    resetAttentionSettingsBtn?.addEventListener("click", resetAttentionSettings);

    toggleTemplatePanelBtn?.addEventListener("click", () => toggleTemplatePanel());

    cannedMessageSend?.addEventListener("click", sendCannedMessage);
    cannedMessageClose?.addEventListener("click", hideCannedMessageModal);

    themeClearButton?.addEventListener("click", (event) => {
      event.preventDefault();
      clearCurrentTheme();
    });
    themeHistoryButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.currentTarget instanceof HTMLElement) {
        openThemeHistory(event.currentTarget);
      }
    });
    toggleThemePanelBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      toggleThemePanel();
    });
    hintBaseBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      setActiveHintGroup("base");
    });
    hintExtra1Btn?.addEventListener("click", (event) => {
      event.preventDefault();
      setActiveHintGroup("extra1");
    });
    hintExtra2Btn?.addEventListener("click", (event) => {
      event.preventDefault();
      setActiveHintGroup("extra2");
    });

    document.addEventListener("click", (event) => {
      if (!themePopover || themePopover.classList.contains("hidden")) {
        return;
      }
      const target = event.target;
      if (target instanceof Node) {
        if (themePopover.contains(target)) {
          return;
        }
        if (target instanceof HTMLElement && target.closest("[data-role='category-button']")) {
          return;
        }
        if (target === themeHistoryButton) {
          return;
        }
      }
      closeThemePopover();
    });

    document.addEventListener("keydown", (event) => {
      if (awaitingSyncConfirmation) {
        const isShiftS =
          (event.key === "S" || event.key === "s") && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;
        if (isShiftS && !event.repeat) {
          handleSyncConfirm(event);
          return;
        }
        if (event.key === "Escape") {
          handleSyncCancel(event);
          return;
        }
      }
      if (event.key === "Escape") {
        closeThemePopover();
      }
    });

    window.addEventListener("resize", closeThemePopover);

    socket.on("prompt_update", handleSocketPrompt);

    // リアクションボタンのイベントリスナー
    const reactionButtons = document.querySelectorAll(".reaction-btn");
    reactionButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const emoji = btn.dataset.reaction;
        const label = btn.dataset.label;
        if (emoji && label && socket) {
          socket.emit("send_reaction", { emoji, label });
          // 視覚的フィードバック
          btn.style.transform = "scale(0.9)";
          setTimeout(() => {
            btn.style.transform = "";
          }, 150);
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
