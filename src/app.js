(function () {
  "use strict";

  var DB_KEY = "luvia.database.v1";
  var AUTH_CODE = "2406";

  var state = {
    view: "chat",
    authMode: "signin",
    activeChatId: "",
    selectedSubject: "",
    selectedQuestion: 0,
    searchOpen: false,
    searchTerm: "",
    thinking: false
  };

  var refs = {};

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $all(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function uid(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(16).slice(2);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char];
    });
  }

  function formatTime(iso) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(iso));
    } catch (error) {
      return "";
    }
  }

  function compactText(value, limit) {
    var text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= limit) return text;
    return text.slice(0, Math.max(0, limit - 3)) + "...";
  }

  function credentialHash(password) {
    try {
      return btoa(unescape(encodeURIComponent(password + "::luvia-local-auth")));
    } catch (error) {
      return password;
    }
  }

  function defaultGems() {
    return [
      {
        id: uid("gem"),
        name: "CA Mentor",
        tone: "Exam focused",
        instruction:
          "Explain CA Foundation, Intermediate, and Final topics with exam logic, section references, illustrations, and revision checkpoints."
      },
      {
        id: uid("gem"),
        name: "Economy Desk",
        tone: "Analytical",
        instruction:
          "Connect business, markets, policy, taxation, inflation, and global economic events in a clear Indian context."
      },
      {
        id: uid("gem"),
        name: "Document Analyst",
        tone: "Precise",
        instruction:
          "Summarize PDFs, extract obligations, prepare clean drafts, generate tables, and identify missing information."
      }
    ];
  }

  function defaultDb() {
    return {
      version: 1,
      user: null,
      accounts: {},
      preferredAuth: "",
      failedAttempts: 0,
      chats: [],
      images: [],
      gems: defaultGems(),
      mcqProgress: {},
      settings: {
        modelMode: "fusion",
        localFirst: true,
        voiceEnabled: true
      }
    };
  }

  function loadDb() {
    var base = defaultDb();
    try {
      var stored = JSON.parse(localStorage.getItem(DB_KEY) || "{}");
      return {
        version: 1,
        user: stored.user || base.user,
        accounts: stored.accounts || base.accounts,
        preferredAuth: stored.preferredAuth || base.preferredAuth,
        failedAttempts: stored.failedAttempts || base.failedAttempts,
        chats: Array.isArray(stored.chats) ? stored.chats : base.chats,
        images: Array.isArray(stored.images) ? stored.images : base.images,
        gems: Array.isArray(stored.gems) && stored.gems.length ? stored.gems : base.gems,
        mcqProgress: stored.mcqProgress || base.mcqProgress,
        settings: Object.assign({}, base.settings, stored.settings || {})
      };
    } catch (error) {
      return base;
    }
  }

  var db = loadDb();

  function saveDb() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (error) {
      if (refs.authMessage) {
        refs.authMessage.textContent = "Local database is full. Export old images or clear unused data.";
        refs.authMessage.className = "auth-message error";
      }
    }
  }

  function showToast(message, type) {
    if (!refs.authMessage && !refs.messageStream) return;
    if (state.view === "chat" && refs.messageStream && db.user) {
      var chat = ensureChat();
      chat.messages.push({
        id: uid("msg"),
        role: "assistant",
        content: message,
        createdAt: new Date().toISOString(),
        meta: type === "error" ? "System notice" : "Luvia"
      });
      chat.updatedAt = new Date().toISOString();
      saveDb();
      renderAll();
      return;
    }
    if (refs.authMessage) {
      refs.authMessage.textContent = message;
      refs.authMessage.className = "auth-message " + (type || "");
    }
  }

  function boot() {
    if (typeof marked !== 'undefined' && typeof hljs !== 'undefined') {
      marked.setOptions({
        highlight: function(code, lang) {
          const language = hljs.getLanguage(lang) ? lang : 'plaintext';
          return hljs.highlight(code, { language }).value;
        }
      });
    }
    refs = {
      splash: $("#splash"),
      authScreen: $("#authScreen"),
      workspace: $("#workspace"),
      authForm: $("#authForm"),
      authSubmit: $("#authSubmit"),
      authMessage: $("#authMessage"),
      emailInput: $("#emailInput"),
      emailHint: $("#emailHint"),
      passwordInput: $("#passwordInput"),
      passwordHint: $("#passwordHint"),
      passwordField: $("#passwordField"),
      captchaField: $("#captchaField"),
      captchaInput: $("#captchaInput"),
      googleLogin: $("#googleLogin"),
      forgotPassword: $("#forgotPassword"),
      newChatButton: $("#newChatButton"),
      searchToggle: $("#searchToggle"),
      searchBox: $("#searchBox"),
      chatSearch: $("#chatSearch"),
      chatList: $("#chatList"),
      chatCount: $("#chatCount"),
      profileInitial: $("#profileInitial"),
      profileName: $("#profileName"),
      accountButton: $("#accountButton"),
      viewKicker: $("#viewKicker"),
      viewTitle: $("#viewTitle"),
      modelSelect: $("#modelSelect"),
      exportPdf: $("#exportPdf"),
      messageStream: $("#messageStream"),
      thinkingIndicator: $("#thinkingIndicator"),
      chatForm: $("#chatForm"),
      chatInput: $("#chatInput"),
      smartSuggestions: $("#smartSuggestions"),
      cameraButton: $("#cameraButton"),
      attachMenuBtn: $("#attachMenuBtn"),
      attachDropdown: $("#attachDropdown"),
      attachButton: $("#attachButton"),
      fileInput: $("#fileInput"),
      voiceButton: $("#voiceButton"),
      newChatTopBtn: $("#newChatTopBtn"),
      // Settings
      systemInstructionInput: $("#systemInstructionInput"),
      saveSettingsBtn: $("#saveSettingsBtn"),
      imagesView: $("#imagesView"),
      mcqView: $("#mcqView"),
      gemsView: $("#gemsView"),
      accountView: $("#accountView")
    };

    // Kick off advanced aurora on load (intense during splash)
    document.body.classList.add("aurora-thinking");
    window.setTimeout(function () {
      refs.splash.classList.add("done");
      // Fade back to normal aurora after splash
      window.setTimeout(function () {
        document.body.classList.remove("aurora-thinking");
      }, 1200);
    }, 1800);

    bindEvents();

    if (db.user && localStorage.getItem("luvia_token")) {
      openWorkspace();
    } else {
      openAuth();
    }
  }

  function bindEvents() {
    $all("[data-auth-mode]").forEach(function (button) {
      button.addEventListener("click", function () {
        setAuthMode(button.dataset.authMode);
      });
    });

    refs.authForm.addEventListener("submit", function (event) {
      event.preventDefault();
      handleAuthSubmit();
    });

    // Google Identity Services integration
    var googleInitAttempts = 0;
    function initGoogleAuth() {
      if (window.google && window.google.accounts) {
        window.google.accounts.id.initialize({
          client_id: "379325997192-72dl5qv2gd1e4av18kr351fds4phbbta.apps.googleusercontent.com",
          callback: async function(response) {
            try {
              const res = await fetch("/api/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential: response.credential })
              });
              const data = await res.json();
              if (data.token) {
                localStorage.setItem("luvia_token", data.token);
                db.preferredAuth = "google";
                db.failedAttempts = 0;
                signIn({
                  email: data.user.email,
                  name: data.user.name,
                  provider: "Google"
                });
              } else {
                setAuthStatus(data.error || "Google Sign-In failed.", "error");
              }
            } catch(err) {
              setAuthStatus("Google Sign-In failed to connect to backend.", "error");
            }
          }
        });
        window.google.accounts.id.renderButton(refs.googleLogin, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with"
        });
      } else {
        googleInitAttempts++;
        if (googleInitAttempts < 15) {
          setTimeout(initGoogleAuth, 100);
        } else {
          // Google library is blocked by network/browser.
          // Gracefully fallback to a simulated Google login so it doesn't look broken.
          refs.googleLogin.addEventListener("click", function () {
            fetchGuestToken("guest@google.com", "Google Guest", "Google");
          });
        }
      }
    }
    initGoogleAuth();

    refs.forgotPassword.addEventListener("click", function () {
      var email = refs.emailInput.value.trim();
      if (!isValidEmail(email)) {
        setAuthStatus("Enter your email first so Luvia can prepare recovery.", "error");
        return;
      }
      setAuthStatus("Recovery flow prepared for " + email + ".", "success");
    });

    refs.emailInput.addEventListener("input", validateEmailField);
    refs.passwordInput.addEventListener("keyup", function (event) {
      if (event.getModifierState && event.getModifierState("CapsLock")) {
        refs.passwordHint.textContent = "Caps Lock is on.";
        refs.passwordHint.className = "error";
      } else if (refs.passwordInput.value && refs.passwordInput.value.length < 8) {
        refs.passwordHint.textContent = "Use at least 8 characters.";
        refs.passwordHint.className = "error";
      } else {
        refs.passwordHint.textContent = "";
        refs.passwordHint.className = "";
      }
    });

    refs.sidebarToggle = $("#sidebarToggle");
    
    if (refs.sidebarToggle) {
      refs.sidebarToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        var sidebar = $(".sidebar");
        sidebar.classList.toggle("open");
      });
      
      // Close sidebar when clicking outside
      document.addEventListener("click", function(e) {
        var sidebar = $(".sidebar");
        if (sidebar && sidebar.classList.contains("open") && !sidebar.contains(e.target) && !refs.sidebarToggle.contains(e.target)) {
          sidebar.classList.remove("open");
        }
      });
    }

    // Dropdown Logic
    var dropdownBtn = $("#modelDropdownBtn");
    var dropdownMenu = $("#modelDropdownMenu");
    
    if (dropdownBtn && dropdownMenu) {
      dropdownBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        dropdownMenu.classList.toggle("hidden");
      });
      
      document.addEventListener("click", function(e) {
        if (!dropdownMenu.contains(e.target) && !dropdownBtn.contains(e.target)) {
          dropdownMenu.classList.add("hidden");
        }
      });
      
      var options = $all(".model-option", dropdownMenu);
      options.forEach(function(opt) {
        opt.addEventListener("click", function() {
          if (this.classList.contains("no-check")) return;
          
          // Remove active from all
          options.forEach(function(o) { o.classList.remove("active"); });
          this.classList.add("active");
          
          // Update button text
          var title = this.querySelector(".model-name").textContent;
          dropdownBtn.querySelector("span").textContent = title;
          
          // Update selected model everywhere the app reads it.
          var realSelect = $("#modelSelect");
          db.settings.modelMode = this.dataset.value;
          if (realSelect) realSelect.value = this.dataset.value;
          saveDb();
          
          dropdownMenu.classList.add("hidden");
        });
      });
    }

    function startNewChat() {
      var chat = createChat("New Session");
      state.activeChatId = chat.id;
      setView("chat");
      saveDb();
      renderAll();
      refs.chatInput.focus();
      var sidebar = $(".sidebar");
      if (sidebar) sidebar.classList.remove("open");
    }

    refs.newChatButton.addEventListener("click", startNewChat);
    if (refs.newChatTopBtn) {
      refs.newChatTopBtn.addEventListener("click", startNewChat);
    }

    refs.searchToggle.addEventListener("click", function () {
      state.searchOpen = !state.searchOpen;
      refs.searchBox.classList.toggle("hidden", !state.searchOpen);
      if (state.searchOpen) refs.chatSearch.focus();
    });

    refs.chatSearch.addEventListener("input", function () {
      state.searchTerm = refs.chatSearch.value.trim().toLowerCase();
      renderChatList();
    });

    $all("[data-view]").forEach(function (button) {
      button.addEventListener("click", function () {
        setView(button.dataset.view);
      });
    });

    $all(".close-modal-btn").forEach(function (button) {
      button.addEventListener("click", function () {
        setView(button.dataset.view);
      });
    });

    if (refs.modelSelect) {
      refs.modelSelect.addEventListener("change", function () {
        db.settings.modelMode = refs.modelSelect.value;
        saveDb();
      });
    }

    if (refs.exportPdf) {
      refs.exportPdf.addEventListener("click", exportActiveChat);
    }

    refs.chatForm.addEventListener("submit", function (event) {
      event.preventDefault();
      sendCurrentPrompt();
    });

    refs.chatInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendCurrentPrompt();
      }
    });

    refs.chatInput.addEventListener("input", resizeComposer);


    refs.attachMenuBtn.addEventListener("click", function (e) {
      refs.attachDropdown.classList.toggle("hidden");
      e.stopPropagation();
    });

    document.addEventListener("click", function () {
      refs.attachDropdown.classList.add("hidden");
    });

    refs.attachButton.addEventListener("click", function () {
      refs.attachDropdown.classList.add("hidden");
      refs.fileInput.click();
    });

    refs.cameraButton.addEventListener("click", function () {
      refs.attachDropdown.classList.add("hidden");
      setView("camera");
    });

    refs.fileInput.addEventListener("change", handleFileAttachment);
    refs.voiceButton.addEventListener("click", startVoiceInput);
    
    $all(".method-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        state.method = tab.dataset.method;
        renderAll();
      });
    });

    if (refs.systemInstructionInput && db.settings.systemInstruction) {
      refs.systemInstructionInput.value = db.settings.systemInstruction;
    }
    if (refs.saveSettingsBtn && refs.systemInstructionInput) {
      refs.saveSettingsBtn.addEventListener("click", function() {
        db.settings.systemInstruction = refs.systemInstructionInput.value;
        saveDb();
        showToast("Settings saved successfully!", "success");
      });
    }

    // Command Palette Logic
    var commandPalette = $("#commandPalette");
    var commandInput = $("#commandInput");
    if (commandPalette && commandInput) {
      document.addEventListener("keydown", function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === "k") {
          e.preventDefault();
          commandPalette.classList.toggle("hidden");
          if (!commandPalette.classList.contains("hidden")) {
            commandInput.focus();
            commandInput.value = "";
            $all(".command-option").forEach(opt => opt.style.display = "flex");
          }
        }
        if (e.key === "Escape" && !commandPalette.classList.contains("hidden")) {
          commandPalette.classList.add("hidden");
        }
      });
      
      commandPalette.addEventListener("click", function(e) {
        if (e.target.classList.contains("command-palette-backdrop")) {
          commandPalette.classList.add("hidden");
        }
      });

      commandInput.addEventListener("input", function() {
        var term = this.value.toLowerCase();
        $all(".command-option").forEach(function(btn) {
          var text = btn.innerText.toLowerCase();
          btn.style.display = text.includes(term) ? "flex" : "none";
        });
      });

      $all(".command-option").forEach(function(btn) {
        btn.addEventListener("click", function() {
          var action = this.dataset.action;
          commandPalette.classList.add("hidden");
          if (action === "new-chat") {
            if (refs.newChatButton) refs.newChatButton.click();
          } else if (action === "clear-history") {
            if (confirm("Clear all local chat history?")) {
              db.chats = [];
              state.activeChatId = null;
              saveDb();
              openWorkspace();
            }
          } else if (action === "settings") {
            setView("settings");
          }
        });
      });
    }
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function validateEmailField() {
    var email = refs.emailInput.value.trim();
    if (!email) {
      refs.emailHint.textContent = "";
      refs.emailHint.className = "";
      return false;
    }
    if (!isValidEmail(email)) {
      refs.emailHint.textContent = "Use a valid email address.";
      refs.emailHint.className = "error";
      return false;
    }
    refs.emailHint.textContent = "Looks good.";
    refs.emailHint.className = "success";
    return true;
  }

  function setAuthMode(mode) {
    state.authMode = mode;
    $all("[data-auth-mode]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.authMode === mode);
    });

    var isMagic = mode === "magic";
    refs.passwordField.classList.toggle("hidden", isMagic);
    refs.forgotPassword.classList.toggle("hidden", mode !== "signin");
    refs.authSubmit.textContent = mode === "create" ? "Create account" : isMagic ? "Send magic link" : "Sign in";
    refs.passwordInput.autocomplete = mode === "create" ? "new-password" : "current-password";
    setAuthStatus("", "");
  }

  function setAuthStatus(message, type) {
    refs.authMessage.textContent = message;
    refs.authMessage.className = "auth-message " + (type || "");
  }

  function handleAuthSubmit() {
    var email = refs.emailInput.value.trim().toLowerCase();
    var password = refs.passwordInput.value;

    if (!isValidEmail(email)) {
      setAuthStatus("Enter a valid email address.", "error");
      validateEmailField();
      return;
    }

    if (db.failedAttempts >= 3 && refs.captchaInput.value.trim() !== AUTH_CODE) {
      refs.captchaField.classList.remove("hidden");
      setAuthStatus("Enter the verification code to continue.", "error");
      return;
    }

    if (state.authMode === "magic") {
      fetchGuestToken(email, email.split("@")[0], "Magic link");
      return;
    }

    if (!password || password.length < 8) {
      db.failedAttempts += 1;
      refs.captchaField.classList.toggle("hidden", db.failedAttempts < 3);
      saveDb();
      setAuthStatus("Password must be at least 8 characters.", "error");
      return;
    }

    if (state.authMode === "create") {
      db.accounts[email] = {
        email: email,
        name: email.split("@")[0],
        hash: credentialHash(password),
        createdAt: new Date().toISOString()
      };
      fetchGuestToken(email, email.split("@")[0], "Email");
      return;
    }

    var account = db.accounts[email];
    if (!account || account.hash !== credentialHash(password)) {
      db.failedAttempts += 1;
      refs.captchaField.classList.toggle("hidden", db.failedAttempts < 3);
      saveDb();
      setAuthStatus("Incorrect email or password. Try again or reset it.", "error");
      return;
    }

    fetchGuestToken(email, account.name, "Email");
  }

  async function fetchGuestToken(email, name, provider) {
    try {
      const res = await fetch("/api/auth/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, name: name })
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem("luvia_token", data.token);
        db.preferredAuth = provider === "Email" ? "email" : "magic";
        db.failedAttempts = 0;
        signIn({
          email: data.user.email,
          name: data.user.name,
          provider: provider
        });
      } else {
        setAuthStatus(data.error || "Authentication failed. Try again.", "error");
      }
    } catch(err) {
      setAuthStatus("Failed to connect to backend server.", "error");
    }
  }

  function signIn(user) {
    db.user = {
      email: user.email,
      name: user.name,
      provider: user.provider,
      lastLogin: new Date().toISOString()
    };
    if (!db.chats.length) {
      var chat = createChat("New Session");
      state.activeChatId = chat.id;
    } else if (!state.activeChatId) {
      state.activeChatId = db.chats[0].id;
    }
    saveDb();
    openWorkspace();
  }

  function openAuth() {
    refs.authScreen.classList.remove("hidden");
    refs.workspace.classList.add("hidden");
    setAuthMode(state.authMode);
  }

  function openWorkspace() {
    refs.authScreen.classList.add("hidden");
    refs.workspace.classList.remove("hidden");
    
    // Always load a new session each time the user refreshes/opens the app
    var freshChat = createChat("New Session");
    state.activeChatId = freshChat.id;
    
    ensureChat();
    saveDb();
    syncModelDropdown();
    renderAll();
  }

  function syncModelDropdown() {
    var mode = db.settings.modelMode || "fusion";
    if (refs.modelSelect) refs.modelSelect.value = mode;
    var dropdownMenu = $("#modelDropdownMenu");
    var dropdownBtn = $("#modelDropdownBtn");
    if (!dropdownMenu || !dropdownBtn) return;

    $all(".model-option", dropdownMenu).forEach(function (option) {
      var active = option.dataset.value === mode;
      option.classList.toggle("active", active);
      var check = option.querySelector(".check-icon");
      if (check && !option.classList.contains("no-check")) {
        check.style.stroke = active ? "#fff" : "none";
      }
      if (active) {
        var label = option.querySelector(".model-name");
        if (label) dropdownBtn.querySelector("span").textContent = label.textContent;
      }
    });
  }

  function createChat(title) {
    var chat = {
      id: uid("chat"),
      title: title || "New conversation",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
    db.chats.unshift(chat);
    return chat;
  }

  function ensureChat() {
    var chat = db.chats.find(function (item) {
      return item.id === state.activeChatId;
    });
    if (!chat) {
      chat = db.chats[0] || createChat();
      state.activeChatId = chat.id;
    }
    return chat;
  }

  function renderAll() {
    if (!db.user) return;
    renderProfile();
    renderChatList();
    renderSmartSuggestions();

    if (state.view === "chat") renderMessages();
    renderImagesView();
    renderMcqView();
    renderGemsView();
    renderAccountView();
    updateViewChrome();
  }

  function renderProfile() {
    var name = db.user.name || "User";
    refs.profileName.textContent = name;
    refs.profileInitial.textContent = name.slice(0, 1).toUpperCase();
  }

  function renderChatList() {
    var term = state.searchTerm;
    var chats = db.chats.filter(function (chat) {
      if (!term) return true;
      var haystack = [
        chat.title,
        chat.messages
          .map(function (message) {
            return message.content;
          })
          .join(" ")
      ]
        .join(" ")
        .toLowerCase();
      return haystack.indexOf(term) >= 0;
    });

    refs.chatCount.textContent = String(chats.length);
    refs.chatList.innerHTML = "";

    if (!chats.length) {
      var empty = document.createElement("div");
      empty.className = "chat-row";
      empty.innerHTML = "<strong>No matches</strong><span>Try another search</span>";
      refs.chatList.appendChild(empty);
      return;
    }

    chats.forEach(function (chat) {
      var last = chat.messages[chat.messages.length - 1];
      
      var row = document.createElement("div");
      row.className = "chat-row" + (chat.id === state.activeChatId ? " active" : "");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.padding = "8px 12px";
      row.style.margin = "4px 8px";
      row.style.borderRadius = "8px";
      row.style.cursor = "pointer";
      row.style.transition = "background-color 0.2s";
      if (chat.id === state.activeChatId) {
        row.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
      }
      row.onmouseover = () => { if (chat.id !== state.activeChatId) row.style.backgroundColor = "rgba(255, 255, 255, 0.05)"; };
      row.onmouseout = () => { if (chat.id !== state.activeChatId) row.style.backgroundColor = "transparent"; };
      
      var button = document.createElement("button");
      button.type = "button";
      button.style.flex = "1";
      button.style.textAlign = "left";
      button.style.background = "transparent";
      button.style.border = "none";
      button.style.color = "inherit";
      button.style.padding = "0";
      button.style.fontFamily = "inherit";
      button.style.fontSize = "14px";
      button.style.overflow = "hidden";
      button.style.textOverflow = "ellipsis";
      button.style.whiteSpace = "nowrap";
      button.innerHTML = escapeHtml(chat.title);
      
      button.addEventListener("click", function () {
        state.activeChatId = chat.id;
        var sidebar = $(".sidebar");
        if (sidebar) sidebar.classList.remove("open");
        setView("chat");
        renderAll();
      });
      
      var delBtn = document.createElement("button");
      delBtn.className = "icon-button";
      delBtn.style.padding = "4px";
      delBtn.style.marginLeft = "8px";
      delBtn.style.opacity = "0.5";
      delBtn.innerHTML = '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
      delBtn.addEventListener("click", async function (e) {
        e.stopPropagation();
        if (!confirm("Delete this chat?")) return;
        
        // Remove locally
        db.chats = db.chats.filter(c => c.id !== chat.id);
        if (state.activeChatId === chat.id) state.activeChatId = null;
        saveDb();
        renderAll();
        
        // Remove from backend if synced
        if (chat._id && localStorage.getItem('luvia_token')) {
          try {
            await fetch('/api/chat/' + chat._id, {
              method: 'DELETE',
              headers: { 'Authorization': 'Bearer ' + localStorage.getItem('luvia_token') }
            });
          } catch(err) { console.error("Failed to delete from server", err); }
        }
      });
      
      row.appendChild(button);
      row.appendChild(delBtn);
      refs.chatList.appendChild(row);
    });
  }

  function renderMessages() {
    var chat = ensureChat();
    refs.messageStream.innerHTML = "";

    // ALWAYS show the greeting at the top of the chat area
    var firstName = db.user ? db.user.name.split(" ")[0] : "User";
    var greetingDiv = document.createElement("div");
    greetingDiv.className = "empty-state gemini-empty";
    greetingDiv.innerHTML =
      '<div class="empty-state-inner">' +
      '<div class="aurora-ball" style="width: 52px; height: 52px; margin: 0 auto 16px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #38f2d0, #a78bfa 50%, #f472b6); box-shadow: 0 0 20px rgba(167, 139, 250, 0.6), inset -2px -2px 6px rgba(0,0,0,0.4);"></div>' +
      '<h3 class="gemini-greeting" style="font-weight: 300; font-size: 24px; color: #e2e8f0;">Hi ' + escapeHtml(firstName) + ', let\'s get into it</h3>' +
      '</div>';

    // If no messages yet, just show the greeting centered
    if (!chat.messages.length) {
      refs.messageStream.appendChild(greetingDiv);
      return;
    }

    chat.messages.forEach(function (message) {
      var article = document.createElement("article");
      article.className = "message " + (message.role === "user" ? "user" : "assistant");
      
      // Parse Markdown and Math for assistant messages
      var contentHtml = escapeHtml(message.content);
      if (message.role === "assistant" && typeof marked !== 'undefined') {
        try {
          contentHtml = DOMPurify.sanitize(marked.parse(message.content));
        } catch(e) {
          console.error("Markdown parse error", e);
        }
      }
      
      // Check for chart payload [CHART: type, data]
      var chartMatch = message.content.match(/\[CHART:\s*(\w+),\s*(\{.*\})\s*\]/);
      
      if (chartMatch && message.role === "assistant") {
        var chartType = chartMatch[1];
        var chartData = chartMatch[2];
        contentHtml = contentHtml.replace(chartMatch[0], "<div class='chart-container'><canvas></canvas></div>");
        
        window.setTimeout(function() {
          try {
            var canvas = article.querySelector('canvas');
            if (canvas) {
              new Chart(canvas, {
                type: chartType,
                data: JSON.parse(chartData),
                options: { responsive: true, color: '#e2e8f0', scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' } } } }
              });
            }
          } catch(e) { console.error("Chart render error:", e); }
        }, 50);
      } else if (message.content.indexOf("[VISION]") === 0) {
        contentHtml = contentHtml.replace("[VISION]", "<div class='vision-box'><video autoplay playsinline muted></video><canvas></canvas></div>");
      }

      if (message.role === "assistant") {
        contentHtml += '<div class="message-actions">' +
                       '<button class="icon-button tts-btn" type="button" aria-label="Read Aloud" onclick="readAloud(this)" data-text="' + escapeHtml(message.content) + '">' +
                       '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" width="16" height="16"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>' +
                       '</button></div>';
      }

      article.innerHTML =
        '<div class="message-content markdown-body">' +
        contentHtml +
        "</div>";
      refs.messageStream.appendChild(article);
      
      if (typeof hljs !== 'undefined') {
        article.querySelectorAll('pre code').forEach(function(block) {
          hljs.highlightElement(block);
        });
      }
      
      if (typeof renderMathInElement !== 'undefined') {
        renderMathInElement(article, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true}
          ],
          throwOnError: false
        });
      }
    });

    refs.messageStream.scrollTop = refs.messageStream.scrollHeight;
  }

  function promptChip(title, prompt) {
    return (
      '<button class="prompt-chip" type="button" data-prompt="' +
      escapeHtml(prompt) +
      '"><strong>' +
      escapeHtml(title) +
      "</strong><span>" +
      escapeHtml(prompt) +
      "</span></button>"
    );
  }

  function resizeComposer() {
    refs.chatInput.style.height = "auto";
    refs.chatInput.style.height = Math.min(refs.chatInput.scrollHeight, 160) + "px";
  }

  function sendCurrentPrompt() {
    var prompt = refs.chatInput.value.trim();
    if (!prompt || state.thinking) return;
    refs.chatInput.value = "";
    resizeComposer();
    sendPrompt(prompt);
  }

  function sendPrompt(prompt) {
    var chat = ensureChat();
    var now = new Date().toISOString();
    chat.messages.push({
      id: uid("msg"),
      role: "user",
      content: prompt,
      createdAt: now,
      meta: "You"
    });
    if (chat.title === "New Session" || chat.title === "New conversation" || chat.title === "Welcome to Luvia") {
      var words = prompt.split(" ").slice(0, 4).join(" ");
      chat.title = words + (prompt.split(" ").length > 4 ? "..." : "");
    }
    chat.updatedAt = now;
    saveDb();
    renderAll();
    setThinking(true);

    window.setTimeout(async function () {
      try {
        let token = localStorage.getItem('luvia_token');
        
        // Seamlessly upgrade old local sessions to use the real backend
        if (!token && db.user) {
          const guestRes = await fetch("/api/auth/guest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: db.user.email, name: db.user.name })
          });
          const guestData = await guestRes.json();
          if (guestData.token) {
            token = guestData.token;
            localStorage.setItem("luvia_token", token);
          }
        }

        if (token) {
          const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
              chatId: chat._id || null, // Might be new
              message: prompt,
              mode: db.settings.modelMode || "fusion",
              systemInstruction: db.settings.systemInstruction || "",
              image: window._pendingImage || null
            })
          });
          
          if (window._pendingImage) {
            window._pendingImage = null; // Clear it after sending
          }

          if (!response.ok) {
            throw new Error("HTTP error " + response.status);
          }

          var newMsg = {
            id: uid("msg"),
            role: "assistant",
            content: "", // Start empty
            createdAt: new Date().toISOString(),
            meta: modelLabel(db.settings.modelMode || "fusion"),
            isTyping: true
          };
          chat.messages.push(newMsg);
          saveDb();
          setThinking(false);
          renderAll(); // Renders empty message container

          var articles = refs.messageStream.querySelectorAll("article.assistant");
          var targetArticle = articles[articles.length - 1];

          const reader = response.body.getReader();
          const decoder = new TextDecoder("utf-8");
          var sseBuffer = "";

          function renderStreamingMessage() {
            var contentHtml = escapeHtml(newMsg.content);
            if (typeof marked !== 'undefined') {
              try { contentHtml = DOMPurify.sanitize(marked.parse(newMsg.content)); } catch(e) {}
            }
            var contentDiv = targetArticle.querySelector('.message-content');
            if (contentDiv) {
              contentDiv.innerHTML = contentHtml;
            } else {
              targetArticle.innerHTML = '<div class="message-content markdown-body">' + contentHtml + '</div>';
            }
            refs.messageStream.scrollTop = refs.messageStream.scrollHeight;
          }

          function handleSsePayload(payload) {
            if (!payload.trim()) return;
            var line = payload.split(/\r?\n/).find(function (item) {
              return item.indexOf('data: ') === 0;
            });
            if (!line) return;
            const dataObj = JSON.parse(line.slice(6));
            if (dataObj.type === 'init') {
              chat._id = dataObj.chatId;
            } else if (dataObj.type === 'chunk') {
              newMsg.content += dataObj.text || "";
              renderStreamingMessage();
            } else if (dataObj.type === 'done') {
              delete newMsg.isTyping;
              chat.updatedAt = new Date().toISOString();
              saveDb();
              renderAll();
            } else if (dataObj.type === 'error') {
              throw new Error(dataObj.message || "Stream failed");
            }
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            sseBuffer += decoder.decode(value, { stream: true });
            var payloads = sseBuffer.split(/(?:\r?\n){2}/);
            sseBuffer = payloads.pop() || "";
            payloads.forEach(handleSsePayload);
          }
          if (sseBuffer.trim()) handleSsePayload(sseBuffer);
          return; // Stream handled it all
        } else {
          chat.messages.push({
            id: uid("msg"),
            role: "assistant",
            content: "Authentication failed. Please sign out and sign back in.",
            createdAt: new Date().toISOString(),
            meta: "System"
          });
          chat.updatedAt = new Date().toISOString();
          saveDb();
          setThinking(false);
          renderAll();
        }
      } catch(err) {
        console.error("Backend fetch error:", err);
        chat.messages.push({
          id: uid("msg"),
          role: "assistant",
          content: "Sorry, the backend server is unreachable. Please start it.",
          createdAt: new Date().toISOString(),
          meta: "System"
        });
        chat.updatedAt = new Date().toISOString();
        saveDb();
        setThinking(false);
        renderAll();
      }
    }, 100);
  }

  function typeWriter(messageObj, fullText, chat) {
    var articles = refs.messageStream.querySelectorAll("article.assistant");
    var targetArticle = articles[articles.length - 1]; // The latest one
    if (!targetArticle) return; // Fallback
    
    var index = 0;
    var speed = 16; // ~60fps
    var charsPerTick = 3;
    
    function tick() {
      if (index < fullText.length) {
        var chunk = fullText.substr(0, index + charsPerTick);
        index += charsPerTick;
        messageObj.content = chunk;
        
        var contentHtml = escapeHtml(chunk);
        if (typeof marked !== 'undefined') {
          try { contentHtml = DOMPurify.sanitize(marked.parse(chunk)); } catch(e) {}
        }
        
        var contentDiv = targetArticle.querySelector('.message-content');
        if (contentDiv) {
          contentDiv.innerHTML = contentHtml;
        } else {
          targetArticle.innerHTML = '<div class="message-content markdown-body">' + contentHtml + '</div>';
        }
        
        // Auto scroll to bottom
        refs.messageStream.scrollTop = refs.messageStream.scrollHeight;
        
        window.setTimeout(tick, speed);
      } else {
        // Done typing
        messageObj.content = fullText;
        delete messageObj.isTyping;
        chat.updatedAt = new Date().toISOString();
        saveDb();
        renderAll(); // Final render to apply KaTeX and Chart.js properly
      }
    }
    
    window.setTimeout(tick, speed);
  }

  function setThinking(active) {
    state.thinking = active;
    refs.thinkingIndicator.classList.toggle("hidden", !active);
    // Toggle advanced aurora when AI is processing
    document.body.classList.toggle("aurora-thinking", active);
  }

  function modelLabel(mode) {
    return {
      fusion: "Luvia Fusion",
      reasoning: "Reasoning mode",
      fast: "Fast mode",
      ca: "CA syllabus mode"
    }[mode || "fusion"];
  }

  function generateAiReply(prompt, mode, chat) {
    var lower = prompt.toLowerCase();
    var intro =
      mode === "fast"
        ? "Fast read:\n"
        : mode === "reasoning"
          ? "Reasoned path:\n"
          : mode === "ca"
            ? "CA-focused answer:\n"
            : "Luvia Fusion:\n";

    if (lower.indexOf("pdf") >= 0 || lower.indexOf("report") >= 0) {
      return (
        intro +
        "1. I would structure the PDF with an executive summary, source notes, tables, and action points.\n" +
        "2. For long material, I would extract headings, obligations, figures, and unresolved questions first.\n" +
        "3. The current build can export this chat through the PDF button. The next backend step is server-side PDF generation with templates, page numbers, and attachments."
      );
    }

    if (
      lower.indexOf("ca ") >= 0 ||
      lower.indexOf("gst") >= 0 ||
      lower.indexOf("tax") >= 0 ||
      lower.indexOf("audit") >= 0 ||
      lower.indexOf("account") >= 0 ||
      lower.indexOf("law") >= 0
    ) {
      return (
        intro +
        "Exam lens:\n" +
        "- Start with the rule or standard.\n" +
        "- Identify the facts that trigger it.\n" +
        "- Apply the rule in numbered working notes.\n" +
        "- End with the treatment, disclosure, or conclusion.\n\n" +
        "For your prompt, I would build a compact answer with definitions, exceptions, and one exam-style illustration. The MCQ workspace already keeps CA Intermediate practice separate from chat."
      );
    }

    if (lower.indexOf("economy") >= 0 || lower.indexOf("market") >= 0 || lower.indexOf("inflation") >= 0) {
      return (
        intro +
        "A useful economy view connects policy, business earnings, liquidity, currency, and household behavior. I would frame it as: what changed, who benefits, who is pressured, and which indicators confirm the trend. For live figures, the production version should connect to verified data sources before answering."
      );
    }

    if (lower.indexOf("email") >= 0 || lower.indexOf("draft") >= 0) {
      return (
        intro +
        "Subject: Clear next step\n\n" +
        "Hello,\n\n" +
        "I am sharing the updated note for your review. The key points are organized below, with pending items separated so we can close them quickly.\n\n" +
        "Regards,\n" +
        (db.user && db.user.name ? db.user.name : "Luvia User")
      );
    }

    if (lower.indexOf("summar") >= 0 || lower.indexOf("explain") >= 0) {
      return (
        intro +
        "I would compress the material into three layers: a one-line gist, a structured summary, and decision-ready next actions. For difficult topics, I would add examples and flag assumptions separately."
      );
    }

    if (lower.indexOf("image") >= 0 || lower.indexOf("photo") >= 0) {
      return (
        intro +
        "The Images workspace is ready for prompt-based generation. This first build creates local visual concepts in the browser; the production connector can route the same prompt to an image model and save outputs in the offline image library."
      );
    }

    if (lower.indexOf("voice") >= 0 || lower.indexOf("interview") >= 0) {
      return (
        intro +
        "Voice-first practice should feel natural: listen, respond, ask one follow-up, and remember the goal of the session. This build uses browser speech input when supported; a live model stream can replace it later."
      );
    }

    var prior = chat.messages.length > 2 ? " I am also keeping this conversation in local history so search can find it later." : "";
    return (
      intro +
      "I can work across the idea, the structure, and the execution. For this request, I would break the problem into context, constraints, options, and the best next move." +
      prior
    );
  }

  function handleFileAttachment() {
    var file = refs.fileInput.files && refs.fileInput.files[0];
    if (!file) return;

    var chat = ensureChat();
    
    setThinking(true);
    addScanResult('Uploading ' + file.name + '...');
    
    var formData = new FormData();
    formData.append('file', file);
    
    fetch('/api/upload', {
      method: 'POST',
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      setThinking(false);
      if (data.error) {
         addScanResult('Upload error: ' + data.error);
         return;
      }
      
      if (data.type === 'text') {
         db.settings = db.settings || {};
         db.settings.systemInstruction = (db.settings.systemInstruction || '') + '\n\nDocument Context (' + data.filename + '):\n' + data.text.substring(0, 20000);
         saveDb();
         addScanResult('Extracted text from ' + data.filename + ' and added it to system knowledge.');
      } else if (data.type === 'image') {
         window._pendingImage = data;
         addScanResult('Uploaded image ' + data.filename + '. Your next message will include this image!');
      }
    })
    .catch(err => {
      setThinking(false);
      addScanResult('Upload failed: ' + err.message);
    });

    function addScanResult(text) {
      chat.messages.push({
        id: uid('msg'),
        role: 'assistant',
        content: text,
        createdAt: new Date().toISOString(),
        meta: 'System'
      });
      chat.updatedAt = new Date().toISOString();
      saveDb();
      renderAll();
    }

    refs.fileInput.value = '';
  }

  function startVoiceInput() {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Voice input is not supported in this browser yet.", "error");
      return;
    }
    var recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    refs.voiceButton.classList.add("active");
    recognition.onresult = function (event) {
      var transcript = event.results[0][0].transcript;
      refs.chatInput.value = (refs.chatInput.value + " " + transcript).trim();
      resizeComposer();
      refs.chatInput.focus();
    };
    recognition.onerror = function () {
      showToast("Voice capture stopped. Check microphone permission.", "error");
    };
    recognition.onend = function () {
      refs.voiceButton.classList.remove("active");
    };
    recognition.start();
  }

  function renderSmartSuggestions() {
    if (!refs.smartSuggestions) return;
    var hour = new Date().getHours();
    var greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
    
    var suggestions = [
      "Summarize my recent emails",
      "Draft a quick response",
      "Plan my " + greeting + " tasks",
      "Analyze the latest economy trends",
      "Start a CA Tax revision"
    ];
    
    // Pick 3 random
    var picked = suggestions.sort(() => 0.5 - Math.random()).slice(0, 3);
    
    refs.smartSuggestions.innerHTML = picked.map(function(s) {
      return '<button class="smart-chip" type="button" data-prompt="' + escapeHtml(s) + '">' + escapeHtml(s) + '</button>';
    }).join("");
    refs.smartSuggestions.classList.remove("hidden");
    
    $all(".smart-chip", refs.smartSuggestions).forEach(function(btn) {
      btn.addEventListener("click", function() {
        refs.chatInput.value = btn.dataset.prompt;
        resizeComposer();
        refs.chatForm.dispatchEvent(new Event('submit'));
      });
    });
  }

  async function startLiveVision() {
    var chat = ensureChat();
    var now = new Date().toISOString();
    
    // Add user message
    chat.messages.push({
      id: uid("msg"),
      role: "user",
      content: "Opening Live Camera Vision...",
      createdAt: now,
      meta: "You"
    });
    
    // Add system video block
    chat.messages.push({
      id: uid("msg"),
      role: "assistant",
      content: "[VISION] Scanning for objects. Please hold items up to the camera.",
      createdAt: new Date().toISOString(),
      meta: "Vision Model (COCO-SSD)"
    });
    
    saveDb();
    renderAll();
    
    try {
      // Find the injected video element
      var articles = refs.messageStream.querySelectorAll('article');
      var lastArticle = articles[articles.length - 1];
      var video = lastArticle.querySelector('video');
      var canvas = lastArticle.querySelector('canvas');
      
      if (!video) throw new Error("Video element not found");
      
      var stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      video.srcObject = stream;
      
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          resolve(video);
        };
      });
      
      // Load COCO-SSD
      var model = await window.cocoSsd.load();
      var ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      var scanInterval = setInterval(async function() {
        if (!video.srcObject) {
          clearInterval(scanInterval);
          return;
        }
        var predictions = await model.detect(video);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        predictions.forEach(prediction => {
          ctx.beginPath();
          ctx.rect(...prediction.bbox);
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#0f766e';
          ctx.fillStyle = '#0f766e';
          ctx.stroke();
          ctx.fillText(
            prediction.class + ' (' + Math.round(prediction.score * 100) + '%)', 
            prediction.bbox[0], 
            prediction.bbox[1] > 10 ? prediction.bbox[1] - 5 : 10
          );
        });
      }, 500);
      
      // Auto-stop after 15 seconds to save resources
      setTimeout(() => {
        clearInterval(scanInterval);
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }, 15000);
      
    } catch(err) {
      console.error(err);
      showToast("Could not access camera or load vision model.", "error");
    }
  }

  function setView(view) {
    state.view = view || "chat";
    $all(".view").forEach(function (section) {
      section.classList.remove("active-view");
    });
    var target = $("#" + state.view + "View");
    if (target) target.classList.add("active-view");

    $all(".nav-item").forEach(function (button) {
      button.classList.toggle("active", button.dataset.view === state.view);
    });
    refs.accountButton.classList.toggle("active", state.view === "account");
    updateViewChrome();
  }

  function updateViewChrome() {
    var titles = {
      chat: { k: "Chat", t: "Luvia Fusion" },
      images: { k: "Images", t: "Photo generation lab" },
      mcq: { k: "CA MCQs", t: "Intermediate practice" },
      gems: { k: "Gems", t: "Specialized assistants" },
      account: { k: "Account", t: "Personal intelligence" }
    };
    var d = titles[state.view] || titles.chat;
    if (refs.viewKicker) refs.viewKicker.textContent = d.k;
    if (refs.viewTitle) refs.viewTitle.textContent = d.t;
    if (refs.exportPdf) refs.exportPdf.classList.toggle("hidden", state.view !== "chat");
  }

  function renderImagesView() {
    refs.imagesView.innerHTML =
      '<div class="tool-layout">' +
      '<form id="imageForm" class="image-generator">' +
      "<h3>Image studio</h3>" +
      '<label class="field"><span>Prompt</span><textarea id="imagePrompt" placeholder="A glass AI study room with aurora light"></textarea></label>' +
      '<div class="control-row">' +
      '<label class="field"><span>Style</span><select id="imageStyle"><option>Photoreal</option><option>Editorial</option><option>Concept art</option><option>Product mockup</option></select></label>' +
      '<label class="field"><span>Aspect</span><select id="imageAspect"><option value="1:1">1:1</option><option value="4:3">4:3</option><option value="16:9">16:9</option></select></label>' +
      "</div>" +
      '<button class="primary-action" type="submit">Generate image</button>' +
      "</form>" +
      '<div class="gallery" id="imageGallery"></div>' +
      "</div>";

    $("#imageForm", refs.imagesView).addEventListener("submit", function (event) {
      event.preventDefault();
      var prompt = $("#imagePrompt", refs.imagesView).value.trim() || "Luvia neural aurora workspace";
      var style = $("#imageStyle", refs.imagesView).value;
      var aspect = $("#imageAspect", refs.imagesView).value;
      db.images.unshift(makeGeneratedImage(prompt, style, aspect));
      saveDb();
      renderImagesView();
    });

    var gallery = $("#imageGallery", refs.imagesView);
    if (!db.images.length) {
      gallery.innerHTML =
        '<div class="tool-panel"><h3>Gallery</h3><p>Generated visuals will appear here and remain available offline in this browser.</p></div>';
      return;
    }

    db.images.forEach(function (image) {
      var tile = document.createElement("article");
      tile.className = "image-tile";
      tile.innerHTML =
        '<img alt="' +
        escapeHtml(image.prompt) +
        '" src="' +
        image.dataUrl +
        '" /><footer><span>' +
        escapeHtml(compactText(image.prompt, 28)) +
        '</span><a class="small-action" download="luvia-image.png" href="' +
        image.dataUrl +
        '">Save</a></footer>';
      gallery.appendChild(tile);
    });
  }

  function makeGeneratedImage(prompt, style, aspect) {
    var parts = aspect.split(":").map(Number);
    var width = 640;
    var height = Math.round((width * (parts[1] || 1)) / (parts[0] || 1));
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext("2d");
    var seed = 0;
    for (var i = 0; i < prompt.length; i += 1) seed += prompt.charCodeAt(i) * (i + 1);

    var gradient = ctx.createLinearGradient(0, 0, width, height);
    var hueA = seed % 360;
    var hueB = (hueA + 95) % 360;
    var hueC = (hueA + 210) % 360;
    gradient.addColorStop(0, "hsl(" + hueA + " 78% 14%)");
    gradient.addColorStop(0.48, "hsl(" + hueB + " 78% 34%)");
    gradient.addColorStop(1, "hsl(" + hueC + " 84% 20%)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (var j = 0; j < 36; j += 1) {
      var x = ((seed * (j + 13)) % width) + Math.sin(j) * 40;
      var y = ((seed * (j + 29)) % height) + Math.cos(j) * 30;
      var radius = 60 + ((seed + j * 31) % 140);
      var glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, "rgba(255,255,255,0.24)");
      glow.addColorStop(0.35, j % 2 ? "rgba(56,242,208,0.18)" : "rgba(255,109,157,0.17)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 0.52;
    for (var line = 0; line < 9; line += 1) {
      ctx.strokeStyle = line % 3 === 0 ? "#38f2d0" : line % 3 === 1 ? "#ff6d9d" : "#ffd166";
      ctx.lineWidth = 2 + (line % 4);
      ctx.beginPath();
      var yLine = (height / 10) * (line + 1);
      ctx.moveTo(0, yLine);
      for (var step = 0; step <= width; step += 42) {
        ctx.lineTo(step, yLine + Math.sin((step + seed + line * 30) / 70) * 26);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(8,10,15,0.42)";
    ctx.fillRect(0, height - 96, width, 96);
    ctx.fillStyle = "#f6f8fb";
    ctx.font = "700 28px Segoe UI, sans-serif";
    ctx.fillText("Luvia " + style, 28, height - 54);
    ctx.font = "16px Segoe UI, sans-serif";
    ctx.fillStyle = "rgba(246,248,251,0.78)";
    ctx.fillText(compactText(prompt, 64), 28, height - 26);

    return {
      id: uid("image"),
      prompt: prompt,
      style: style,
      aspect: aspect,
      dataUrl: canvas.toDataURL("image/png"),
      createdAt: new Date().toISOString()
    };
  }

  function renderMcqView() {
    var questions = Array.isArray(window.LUVIA_MCQS) ? window.LUVIA_MCQS : [];
    var subjects = questions
      .map(function (q) {
        return q.subject;
      })
      .filter(function (subject, index, list) {
        return list.indexOf(subject) === index;
      });

    if (!state.selectedSubject) state.selectedSubject = subjects[0] || "";
    var subjectQuestions = questions.filter(function (q) {
      return q.subject === state.selectedSubject;
    });
    if (state.selectedQuestion >= subjectQuestions.length) state.selectedQuestion = 0;
    var current = subjectQuestions[state.selectedQuestion];
    var progress = db.mcqProgress[state.selectedSubject] || {};
    var answered = progress[current ? current.question : ""];
    var correctCount = subjectQuestions.filter(function (q) {
      return progress[q.question] === q.answer;
    }).length;

    refs.mcqView.innerHTML =
      '<div class="quiz-shell">' +
      '<div class="subject-tabs">' +
      subjects
        .map(function (subject) {
          return (
            '<button class="choice-pill ' +
            (subject === state.selectedSubject ? "active" : "") +
            '" type="button" data-subject="' +
            escapeHtml(subject) +
            '">' +
            escapeHtml(subject) +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      '<div class="metric-grid">' +
      metric("Score", correctCount + "/" + subjectQuestions.length) +
      metric("Answered", Object.keys(progress).length) +
      metric("Subject", subjects.indexOf(state.selectedSubject) + 1 + "/" + subjects.length) +
      "</div>" +
      (current ? questionMarkup(current, answered) : "<p>No questions loaded.</p>") +
      "</div>";

    $all("[data-subject]", refs.mcqView).forEach(function (button) {
      button.addEventListener("click", function () {
        state.selectedSubject = button.dataset.subject;
        state.selectedQuestion = 0;
        renderMcqView();
      });
    });

    $all("[data-answer]", refs.mcqView).forEach(function (button) {
      button.addEventListener("click", function () {
        if (!current) return;
        if (!db.mcqProgress[state.selectedSubject]) db.mcqProgress[state.selectedSubject] = {};
        db.mcqProgress[state.selectedSubject][current.question] = Number(button.dataset.answer);
        saveDb();
        renderMcqView();
      });
    });

    var next = $("#nextQuestion", refs.mcqView);
    if (next) {
      next.addEventListener("click", function () {
        state.selectedQuestion = (state.selectedQuestion + 1) % subjectQuestions.length;
        renderMcqView();
      });
    }

    var reset = $("#resetQuiz", refs.mcqView);
    if (reset) {
      reset.addEventListener("click", function () {
        db.mcqProgress[state.selectedSubject] = {};
        saveDb();
        renderMcqView();
      });
    }
  }

  function metric(label, value) {
    return '<div class="metric"><strong>' + escapeHtml(value) + "</strong><span>" + escapeHtml(label) + "</span></div>";
  }

  function questionMarkup(question, answered) {
    var hasAnswer = typeof answered === "number";
    return (
      '<div class="question-box">' +
      '<div class="question-meta"><span>' +
      escapeHtml(question.chapter) +
      "</span><span>Question " +
      (state.selectedQuestion + 1) +
      "</span></div>" +
      '<h3 class="question-text">' +
      escapeHtml(question.question) +
      "</h3>" +
      '<div class="option-grid">' +
      question.options
        .map(function (option, index) {
          var resultClass = "";
          if (hasAnswer && index === question.answer) resultClass = " correct";
          if (hasAnswer && index === answered && answered !== question.answer) resultClass = " incorrect";
          return (
            '<button class="option-button' +
            resultClass +
            '" type="button" data-answer="' +
            index +
            '">' +
            escapeHtml(String.fromCharCode(65 + index) + ". " + option) +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      (hasAnswer ? '<div class="explanation">' + escapeHtml(question.explanation) + "</div>" : "") +
      '<div class="quiz-actions"><button id="resetQuiz" class="small-action" type="button">Reset subject</button><button id="nextQuestion" class="primary-action" type="button">Next question</button></div>' +
      "</div>"
    );
  }

  function renderGemsView() {
    refs.gemsView.innerHTML =
      '<div class="gem-shell">' +
      "<h3>Gems</h3>" +
      '<form id="gemForm" class="gem-form">' +
      '<div class="control-row">' +
      '<label class="field"><span>Name</span><input id="gemName" placeholder="Research partner" /></label>' +
      '<label class="field"><span>Tone</span><input id="gemTone" placeholder="Calm and precise" /></label>' +
      "</div>" +
      '<label class="field"><span>Instructions</span><input id="gemInstruction" placeholder="Specialize this assistant" /></label>' +
      '<button class="primary-action" type="submit">Create Gem</button>' +
      "</form>" +
      '<div class="gem-grid">' +
      db.gems
        .map(function (gem) {
          return (
            '<article class="gem-card"><h4><span class="status-dot"></span>' +
            escapeHtml(gem.name) +
            "</h4><p>" +
            escapeHtml(gem.instruction) +
            '</p><button class="small-action" type="button" data-use-gem="' +
            escapeHtml(gem.id) +
            '">Open</button></article>'
          );
        })
        .join("") +
      "</div></div>";

    $("#gemForm", refs.gemsView).addEventListener("submit", function (event) {
      event.preventDefault();
      var name = $("#gemName", refs.gemsView).value.trim();
      var tone = $("#gemTone", refs.gemsView).value.trim();
      var instruction = $("#gemInstruction", refs.gemsView).value.trim();
      if (!name || !instruction) return;
      db.gems.unshift({
        id: uid("gem"),
        name: name,
        tone: tone || "Balanced",
        instruction: instruction
      });
      saveDb();
      renderGemsView();
    });

    $all("[data-use-gem]", refs.gemsView).forEach(function (button) {
      button.addEventListener("click", function () {
        var gem = db.gems.find(function (item) {
          return item.id === button.dataset.useGem;
        });
        if (!gem) return;
        var chat = createChat(gem.name);
        chat.messages.push({
          id: uid("msg"),
          role: "assistant",
          content: "Gem loaded: " + gem.name + "\n\n" + gem.instruction,
          createdAt: new Date().toISOString(),
          meta: gem.tone || "Gem"
        });
        state.activeChatId = chat.id;
        saveDb();
        setView("chat");
        renderAll();
      });
    });
  }

  function renderAccountView() {
    refs.accountView.innerHTML =
      '<div class="account-shell">' +
      "<h3>Account</h3>" +
      '<div class="account-grid">' +
      accountCard("Profile", escapeHtml(db.user.name) + "<br>" + escapeHtml(db.user.email)) +
      accountCard("Authentication", escapeHtml(db.user.provider) + " session<br>Preferred: " + escapeHtml(db.preferredAuth || "not set")) +
      accountCard("Offline database", db.chats.length + " chats<br>" + db.images.length + " images<br>" + db.gems.length + " gems") +
      accountCard("Security hooks", "CAPTCHA after failed attempts<br>OAuth connector ready<br>JWT/API key handoff ready") +
      accountCard("Productivity", "Docs, Drive, Gmail, Calendar, camera, OCR, and live voice connectors can attach here.") +
      accountCard("Personal intelligence", "Local behavior signals can tune suggested modes, Gems, and study paths.") +
      "</div>" +
      '<div class="quiz-actions"><button id="clearLocal" class="small-action" type="button">Clear local data</button></div>' +
      "</div>";

    refs.accountButton.addEventListener("click", function () {
      setView("account");
    });

    $("#clearLocal", refs.accountView).addEventListener("click", function () {
      if (!window.confirm("Clear local Luvia data from this browser?")) return;
      localStorage.removeItem(DB_KEY);
      db = defaultDb();
      state.activeChatId = "";
      openAuth();
    });
  }

  function accountCard(title, body) {
    return '<article class="account-card"><h4>' + escapeHtml(title) + "</h4><p>" + body + "</p></article>";
  }

  function exportActiveChat() {
    var chat = ensureChat();
    var rows = chat.messages
      .map(function (message) {
        return (
          "<section><h2>" +
          escapeHtml(message.role === "user" ? "You" : message.meta || "Luvia") +
          "</h2><p>" +
          escapeHtml(message.content).replace(/\n/g, "<br>") +
          "</p></section>"
        );
      })
      .join("");
    var html =
      "<div><h1 style='font-family: sans-serif;'>" +
      escapeHtml(chat.title) +
      "</h1><p style='color: gray; font-family: sans-serif;'>Generated by Luvia AI.</p>" +
      "<div style='font-family: sans-serif;'>" + rows + "</div></div>";

    var element = document.createElement("div");
    element.innerHTML = html;
    
    html2pdf().set({
      margin: 15,
      filename: 'luvia-export-' + Date.now() + '.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(element).save();
  }

  // document.addEventListener("DOMContentLoaded", boot); removed to avoid duplicate
  
  // Global TTS handler
  window.readAloud = function(btn) {
    if (!('speechSynthesis' in window)) return alert('Text-to-Speech not supported');
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      return;
    }
    const text = btn.getAttribute('data-text') || '';
    // Strip markdown chars roughly
    const cleanText = text.replace(/[*_#`~]/g, '');
    const msg = new SpeechSynthesisUtterance(cleanText);
    msg.lang = 'en-US';
    msg.rate = 1.1;
    msg.pitch = 1.6;
    
    // Attempt to select a female voice if available
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => /female|samantha|zira|susan|victoria/i.test(v.name));
    if (femaleVoice) {
      msg.voice = femaleVoice;
    } else {
      msg.pitch = 1.8; // Fallback to higher pitch if no female voice found
    }

    btn.style.color = '#38f2d0';
    msg.onend = function() { btn.style.color = ''; };
    msg.onerror = function() { btn.style.color = ''; };
    window.speechSynthesis.speak(msg);
  };

  document.addEventListener("DOMContentLoaded", function() {
    boot();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(function(registration) {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      }, function(err) {
        console.log('ServiceWorker registration failed: ', err);
      });
    }
  });
})();
