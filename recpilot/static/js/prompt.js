(() => {
  const socket = io({
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 20000,
  });
  const params = new URLSearchParams(window.location.search);
  const roomFromQuery = (params.get("room") || "").trim();
  const storedRoom = (localStorage.getItem("recpilot-room-id") || "").trim();
  let currentRoomId = roomFromQuery || storedRoom;
  let connectionState = "disconnected"; // disconnected | reconnecting | connected
  if (roomFromQuery) {
    try {
      localStorage.setItem("recpilot-room-id", roomFromQuery);
    } catch (err) {
      console.warn("roomId の保存に失敗しました", err);
    }
  }

  const promptText = document.getElementById("prompt-text");
  const promptMeta = document.getElementById("prompt-meta");
  const themeTitle = document.getElementById("theme-title");
  const themeCategory = document.getElementById("theme-category");
  const themeHints = document.getElementById("theme-hints");
  const timeElapsed = document.getElementById("time-elapsed");
  const timeRemaining = document.getElementById("time-remaining");
  const promptAdvisory = document.getElementById("prompt-advisory");
  const overlay = document.getElementById("prompt-overlay");
  const overlayValue = document.getElementById("prompt-overlay-value");
  const overlayNote = document.getElementById("prompt-overlay-note");
  const notice = document.getElementById("prompt-notice");
  const noticeText = document.getElementById("prompt-notice-text");
  const reactionDisplay = document.getElementById("reaction-display");
  const reactionEmoji = document.getElementById("reaction-emoji");
  const reactionLabel = document.getElementById("reaction-label");
  const joinForm = document.getElementById("room-join-form");
  const joinGroup = document.getElementById("room-join-group");
  const joinDate = document.getElementById("room-join-date");
  const joinDirector = document.getElementById("room-join-director");
  const joinStatus = document.getElementById("room-join-status");
  const joinContainer = document.getElementById("room-join-container");
  const joinReopenBtn = document.getElementById("room-join-reopen");
  const statusState = document.getElementById("room-status-state");
  const statusRoom = document.getElementById("room-status-room");
  const statusNote = document.getElementById("room-status-note");

  const overlayValueBaseClass = overlayValue.className;
  const noticeBaseClass = "rounded-full bg-white/10 px-5 py-2 text-base font-semibold text-white shadow-lg backdrop-blur";
  const MARK_MESSAGES = {
    "underage": "※未成年の方は体験談ではなく「想像」や「見聞きした話」でOKです",
    "personal-info": "※実名・学校名・地名など、個人を特定できる内容は避けましょう",
  };

  function sanitizeDirectorForRoom(name) {
    const raw = (name || "").trim();
    if (!raw) return "";
    const compact = raw.replace(/\s+/g, "");
    return compact.replace(/[^\p{L}\p{N}]/gu, "") || compact;
  }

  function buildRoomId(groupId, sessionDate, director) {
    const groupRaw = (groupId || "").trim();
    const dateRaw = (sessionDate || "").trim();
    const directorRaw = (director || "").trim();
    if (!groupRaw || !dateRaw || !directorRaw) {
      return "";
    }
    const groupDigits = groupRaw.replace(/\D/g, "");
    const group = groupDigits ? groupDigits.padStart(3, "0") : groupRaw;
    const date = dateRaw.replace(/\D/g, "").slice(0, 8) || dateRaw;
    const directorSlug = sanitizeDirectorForRoom(directorRaw);
    return `${group}_${date}_${directorSlug}`;
  }

  function updateJoinStatus(text, ok = false) {
    if (!joinStatus) return;
    joinStatus.textContent = text;
    joinStatus.className = ok ? "text-emerald-300 text-xs font-semibold" : "text-amber-300 text-xs font-semibold";
  }

  function setConnectionStatus(state, roomId, note = "") {
    connectionState = state;
    if (statusState) {
      const label = state === "connected" ? "接続中" : state === "reconnecting" ? "再接続中" : "未接続";
      statusState.textContent = label;
      statusState.className =
        state === "connected"
          ? "font-semibold text-emerald-300"
          : state === "reconnecting"
          ? "font-semibold text-amber-300"
          : "font-semibold text-red-300";
    }
    if (statusRoom) {
      statusRoom.textContent = `room: ${roomId || "-"}`;
    }
    if (statusNote) {
      statusNote.textContent = note;
    }
  }

  function ensureRoomJoin() {
    if (!currentRoomId) {
      updateJoinStatus("room未設定: 組番号・セッション日・進行者名を入力してください");
      setConnectionStatus("disconnected", "");
      return;
    }
    if (!socket.connected) {
      setConnectionStatus("reconnecting", currentRoomId, "接続中...");
      socket.connect();
    }
    socket.emit("join_room", { roomId: currentRoomId });
    updateJoinStatus(`参加中: ${currentRoomId}`, true);
  }

  socket.on("connect", ensureRoomJoin);
  ensureRoomJoin();
  socket.on("room_joined", (payload) => {
    if (payload?.roomId) {
      currentRoomId = payload.roomId;
      updateJoinStatus(`参加中: ${payload.roomId}`, true);
      setConnectionStatus("connected", payload.roomId, "");
      hideJoinPanel();
    }
  });
  socket.on("connect_error", (err) => {
    updateJoinStatus(`接続エラー: ${err?.message || "unknown"}`, false);
    setConnectionStatus(currentRoomId ? "reconnecting" : "disconnected", currentRoomId, `接続エラー: ${err?.message || "unknown"}`);
  });
  socket.on("disconnect", (reason) => {
    updateJoinStatus(`切断: 再接続待ち (${reason || "unknown"})`, false);
    setConnectionStatus(currentRoomId ? "reconnecting" : "disconnected", currentRoomId, `切断: ${reason || "unknown"}`);
    showJoinPanel();
    if (currentRoomId) {
      setTimeout(() => {
        ensureRoomJoin();
      }, 1000);
    }
  });

  function hideJoinPanel() {
    joinContainer?.classList.add("hidden");
    joinReopenBtn?.classList.remove("hidden");
  }

  function showJoinPanel() {
    joinContainer?.classList.remove("hidden");
    joinReopenBtn?.classList.add("hidden");
  }

  joinForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const groupId = joinGroup?.value || "";
    const date = joinDate?.value || "";
    const director = joinDirector?.value || "";
    const roomId = buildRoomId(groupId, date, director);
    if (!roomId) {
      updateJoinStatus("必須項目を入力してください", false);
      setConnectionStatus("disconnected", "", "入力が必要です");
      return;
    }
    currentRoomId = roomId;
    updateJoinStatus(`接続中... (${roomId})`, false);
    setConnectionStatus("reconnecting", roomId, "接続中...");
    try {
      localStorage.setItem("recpilot-room-id", roomId);
    } catch (err) {
      console.warn("roomId の保存に失敗しました", err);
    }
    ensureRoomJoin();
  });

  joinReopenBtn?.addEventListener("click", () => {
    showJoinPanel();
  });

  let overlayTimeoutId = null;
  let noticeTimeoutId = null;
  let reactionTimeoutId = null;

  function updatePrompt(message, timestamp) {
    const text = (message || "").trim();
    promptText.textContent = text || "カンペがここに表示されます";
  }

  function updateTheme(payload) {
    const title = (payload?.title || "").trim();
    const category = (payload?.category || "").trim();
    const hints = Array.isArray(payload?.hints) ? payload.hints : [];
    const marks = Array.isArray(payload?.marks) ? payload.marks : [];

    // テーマ枠のエフェクトを追加
    const themeTitleWrapper = themeTitle.closest('.relative');
    if (themeTitleWrapper) {
      // 既存のアニメーションクラスをクリア
      themeTitleWrapper.classList.remove('theme-border-effect', 'theme-change-glow');
      themeTitle.classList.remove('theme-title-animate');
      themeCategory.classList.remove('theme-category-animate');
      themeHints.classList.remove('theme-hints-animate');

      // リフローを強制してアニメーションをリセット
      void themeTitleWrapper.offsetWidth;

      // エフェクトを適用
      themeTitleWrapper.classList.add('theme-border-effect', 'theme-change-glow');

      // アニメーション終了後にクラスを削除
      setTimeout(() => {
        themeTitleWrapper.classList.remove('theme-border-effect', 'theme-change-glow');
      }, 1500);
    }

    // テキスト更新とアニメーション
    setTimeout(() => {
      themeTitle.textContent = title || "テーマ未選択";
      themeTitle.classList.add('theme-title-animate');

      themeCategory.textContent = category || "テーマ";
      themeCategory.classList.add('theme-category-animate');

      themeHints.innerHTML = "";
      themeHints.classList.add('theme-hints-animate');

      hints.forEach((hint, index) => {
        const li = document.createElement("li");
        li.textContent = hint;
        li.className = "hint-item rounded-full border-2 border-white/20 bg-white/5 px-5 py-2.5 text-base font-bold text-white shadow-lg backdrop-blur-sm";
        li.style.animationDelay = `${index * 0.05}s`;
        themeHints.appendChild(li);
      });

      // アニメーション終了後にクラスを削除
      setTimeout(() => {
        themeTitle.classList.remove('theme-title-animate');
        themeCategory.classList.remove('theme-category-animate');
        themeHints.classList.remove('theme-hints-animate');
      }, 1000);
    }, 300);

    if (promptAdvisory) {
      const messages = [];
      marks.forEach((mark) => {
        const message = MARK_MESSAGES[mark];
        if (message && !messages.includes(message)) {
          messages.push(message);
        }
      });
      if (messages.length) {
        promptAdvisory.innerHTML = messages.join("<br>");
        promptAdvisory.classList.remove("hidden");
      } else {
        promptAdvisory.classList.add("hidden");
        promptAdvisory.innerHTML = "";
      }
    }
  }

  function formatTime(seconds) {
    if (typeof seconds !== "number" || Number.isNaN(seconds)) {
      return "--:--:--";
    }
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, "0");
    const secs = String(safeSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${secs}`;
  }

  function updateTime(payload) {
    if (!payload) {
      return;
    }
    if (timeElapsed) {
      timeElapsed.textContent = `経過 ${formatTime(payload.elapsed)}`;
    }
    if (timeRemaining) {
      timeRemaining.textContent = `残り ${formatTime(payload.remaining)}`;
      if (payload.critical) {
        timeRemaining.classList.add("text-red-500");
        timeRemaining.classList.remove("text-amber-400");
      } else {
        timeRemaining.classList.add("text-amber-400");
        timeRemaining.classList.remove("text-red-500");
      }
    }
  }

  function clearOverlay() {
    if (overlayTimeoutId) {
      clearTimeout(overlayTimeoutId);
      overlayTimeoutId = null;
    }
    overlay.classList.add("hidden");
  }

  function showCountdownOverlay(value, note, level = "info", ttlMs) {
    overlayValue.textContent = value ?? "";
    overlayNote.textContent = note ?? "";
    if (note) {
      overlayNote.classList.remove("hidden");
    } else {
      overlayNote.classList.add("hidden");
    }

    overlayValue.className = overlayValueBaseClass;
    if (level === "critical") {
      overlayValue.classList.add("text-red-200");
    } else if (level === "success") {
      overlayValue.classList.add("text-emerald-200");
    }

    overlay.classList.remove("hidden");

    if (overlayTimeoutId) {
      clearTimeout(overlayTimeoutId);
      overlayTimeoutId = null;
    }
    if (ttlMs && ttlMs > 0) {
      overlayTimeoutId = setTimeout(() => {
        overlay.classList.add("hidden");
        overlayTimeoutId = null;
      }, ttlMs);
    }
  }

  function showBreakOverlay(message, remainingSeconds) {
    if (overlayTimeoutId) {
      clearTimeout(overlayTimeoutId);
      overlayTimeoutId = null;
    }
    const remaining = typeof remainingSeconds === "number" ? remainingSeconds : 0;
    overlayValue.textContent = message || "休憩タイム";
    overlayValue.className = `${overlayValueBaseClass} text-emerald-200`;
    overlayNote.textContent = `残り ${formatTime(remaining)}`;
    overlayNote.classList.remove("hidden");
    overlay.classList.remove("hidden");
  }

  function clearNotice() {
    if (noticeTimeoutId) {
      clearTimeout(noticeTimeoutId);
      noticeTimeoutId = null;
    }
    notice.classList.add("hidden");
  }

  function showNotice(message, level = "info", ttlMs = 4000) {
    const levelClassMap = {
      info: "bg-blue-500/80 text-white",
      warning: "bg-amber-500/90 text-slate-900",
      critical: "bg-red-500/85 text-white",
      success: "bg-emerald-500/80 text-slate-900",
    };
    noticeText.textContent = message ?? "";
    noticeText.className = `${noticeBaseClass} ${levelClassMap[level] || levelClassMap.info}`;
    notice.classList.remove("hidden");

    if (noticeTimeoutId) {
      clearTimeout(noticeTimeoutId);
      noticeTimeoutId = null;
    }
    if (ttlMs && ttlMs > 0) {
      noticeTimeoutId = setTimeout(() => {
        notice.classList.add("hidden");
        noticeTimeoutId = null;
      }, ttlMs);
    }
  }

  socket.on("prompt_update", (payload) => {
    updatePrompt(payload?.message, payload?.sentAt);
  });

  socket.on("theme_update", (payload) => {
    updateTheme(payload);
  });

  socket.on("time_update", (payload) => {
    updateTime(payload);
  });

  socket.on("prompt_overlay", (payload) => {
    const mode = payload?.mode || "clear";
    if (mode === "countdown") {
      clearNotice();
      showCountdownOverlay(payload.value ?? "", payload.note ?? "", payload.level ?? "info", payload.ttlMs);
    } else if (mode === "break") {
      clearNotice();
      showBreakOverlay(payload?.message, payload?.remaining);
    } else if (mode === "notice") {
      clearOverlay();
      showNotice(payload.message ?? "", payload.level ?? "info", payload.ttlMs ?? 4000);
    } else if (mode === "clear") {
      clearOverlay();
      clearNotice();
    }
  });

  // リアクション表示機能
  function showReaction(emoji, label) {
    if (!reactionDisplay || !reactionEmoji || !reactionLabel) {
      return;
    }

    // 既存のタイムアウトをクリア
    if (reactionTimeoutId) {
      clearTimeout(reactionTimeoutId);
      reactionTimeoutId = null;
    }

    // fade-outクラスを削除してリセット
    reactionDisplay.classList.remove("show", "fade-out");

    // 絵文字とラベルを設定
    reactionEmoji.textContent = emoji;
    reactionLabel.textContent = label;

    // アニメーションをトリガーするために少し遅延
    setTimeout(() => {
      reactionDisplay.classList.add("show");
    }, 10);

    // 3秒後にフェードアウト開始
    reactionTimeoutId = setTimeout(() => {
      reactionDisplay.classList.add("fade-out");
      // フェードアウトアニメーション完了後に非表示
      setTimeout(() => {
        reactionDisplay.classList.remove("show", "fade-out");
        reactionTimeoutId = null;
      }, 500);
    }, 3000);
  }

  socket.on("show_reaction", (payload) => {
    if (payload && payload.emoji && payload.label) {
      showReaction(payload.emoji, payload.label);
    }
  });

  // 画面注目設定を取得
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

  // 画面注目アラート
  socket.on("screen_attention", (payload) => {
    const attentionOverlay = document.getElementById("screen-attention-overlay");
    if (!attentionOverlay) {
      return;
    }

    // カスタム設定を取得
    const settings = getAttentionSettings();
    const duration = payload?.duration || settings.duration;
    const message = payload?.message || settings.message;

    // メッセージを更新
    const messageElement = attentionOverlay.querySelector("p");
    if (messageElement) {
      messageElement.textContent = message;
    }

    // 表示してアニメーションを開始
    attentionOverlay.classList.remove("hidden");

    // カスタム時間後に非表示
    setTimeout(() => {
      attentionOverlay.classList.add("hidden");
    }, duration * 1000);
  });
})();
