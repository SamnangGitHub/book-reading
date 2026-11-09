import React, { useState, useEffect, useRef } from "react";
import { apiConfigured, adminLogin, loadBooks, loadAdminBooks, saveBook as saveBookToApi, deleteBook as deleteBookFromApi, userAccount, saveReadingProgress, loadReadingProgress, recordPageVisit } from "./src/bookApi.js";
import {
  BookOpen,
  Plus,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Headphones,
  VolumeX,
  Settings,
  Upload,
  Trash2,
  Edit3,
  Check,
  Sun,
  Moon,
  Coffee,
  Bookmark,
  FileAudio,
  Image as ImageIcon,
  Languages,
  Sparkles,
  Sliders,
  Type,
  Eye,
  FolderOpen,
  ArrowUp,
  ArrowDown,
  PlusCircle,
  Search,
  Menu,
  X,
  LayoutGrid,
  List
} from "lucide-react";

function bookCoverImage(book) {
  return book.coverImage || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=600&q=80";
}

export default function App() {
  // Navigation State: 'library' | 'reader' | 'create'
  const [currentView, setCurrentView] = useState("library");
  const [libraryTab, setLibraryTab] = useState("home");
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const featuredTouchStartX = useRef(null);

  // Books List
  const [books, setBooks] = useState([]);
  const [activeBookId, setActiveBookId] = useState("");
  const [isLoadingBooks, setIsLoadingBooks] = useState(apiConfigured);
  const [bookSearch, setBookSearch] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("all");
  const [bookTypeFilter, setBookTypeFilter] = useState("all");
  const [bookSort, setBookSort] = useState("newest");
  const [libraryLayout, setLibraryLayout] = useState("grid");
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [pageJump, setPageJump] = useState("1");
  const [readingProgress, setReadingProgress] = useState(() => {
    try { return JSON.parse(localStorage.getItem("khmer-reader-progress") || "{}"); } catch { return {}; }
  });
  const [storageMessage, setStorageMessage] = useState("");
  const [isSavingBook, setIsSavingBook] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [excelUploadName, setExcelUploadName] = useState("");
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [showHiddenBooks, setShowHiddenBooks] = useState(false);
  const [readerUser, setReaderUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("khmer-reader-user") || "null"); } catch { return null; }
  });
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountMode, setAccountMode] = useState("login");
  const [accountUsername, setAccountUsername] = useState("");
  const [accountPhone, setAccountPhone] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [showRegisterOffer, setShowRegisterOffer] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installMessage, setInstallMessage] = useState("");
  const [pageVisitCount, setPageVisitCount] = useState(null);

  useEffect(() => {
    if (!apiConfigured) return;
    let cancelled = false;
    try {
      let sessionId = sessionStorage.getItem("khmer-reader-visit-session");
      if (!sessionId) {
        sessionId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem("khmer-reader-visit-session", sessionId);
      }
      recordPageVisit(sessionId).then((result) => {
        if (!cancelled) setPageVisitCount(result.visits);
      }).catch(() => {});
    } catch {
      // The visit counter is optional; the reader remains usable if storage is unavailable.
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setInstallMessage("Khmer Reader was added to your home screen.");
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const installApp = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const result = await installPrompt.userChoice;
      setInstallMessage(result.outcome === "accepted" ? "Khmer Reader was added to your home screen." : "You can add Khmer Reader from your browser menu anytime.");
      setInstallPrompt(null);
      return;
    }
    setInstallMessage(/iphone|ipad|ipod/i.test(navigator.userAgent)
      ? "To install: tap Share, then Add to Home Screen."
      : "To install: open your browser menu and choose Install app or Add to Home screen.");
  };

  const refreshReaderHistory = async (username = readerUser?.username) => {
    if (!username || !apiConfigured) return;
    setHistoryBusy(true);
    try {
      const saved = await loadReadingProgress(username);
      const progressMap = Object.fromEntries((saved.progress || []).map((item) => [item.bookId, Number(item.pageIndex) || 0]));
      setReadingProgress(progressMap);
      localStorage.setItem("khmer-reader-progress", JSON.stringify(progressMap));
      const latest = (saved.progress || []).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
      setAccountMessage(latest ? `Reading history refreshed for ${username}.` : `Signed in as ${username}. No saved reading history yet.`);
    } catch (error) {
      setAccountMessage(`Could not load reading history: ${error.message}`);
    } finally {
      setHistoryBusy(false);
    }
  };

  // Editing state: null when creating new, or book ID string when editing existing
  const [editingBookId, setEditingBookId] = useState(null);
  const [expandedPageId, setExpandedPageId] = useState(null);
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem("khmer-reader-admin-token") || "");

  const submitAccount = async (event) => {
    event.preventDefault();
    if (!apiConfigured) { setAccountMessage("Accounts require the app API. Configure VITE_API_URL first."); return; }
    setAccountBusy(true);
    setAccountMessage("");
    setShowRegisterOffer(false);
    try {
      const result = await userAccount(accountMode === "register" ? "register" : "login", { username: accountUsername, phone: accountPhone });
      const user = result.user;
      localStorage.setItem("khmer-reader-user", JSON.stringify(user));
      setReaderUser(user);
      setShowAccountForm(false);
      setAccountPhone("");
      setAccountMessage(`Signed in as ${user.username}. Refreshing reading history…`);
    } catch (error) {
      setAccountMessage(error.message);
      setShowRegisterOffer(accountMode === "login" && error.status === 401);
    }
    finally { setAccountBusy(false); }
  };

  const signOutReader = () => {
    localStorage.removeItem("khmer-reader-user");
    setReaderUser(null);
    setAccountMessage("You are browsing as a guest. Reading history stays on this device until you sign in.");
  };

  useEffect(() => {
    if (!readerUser?.username || !apiConfigured) return;
    void refreshReaderHistory(readerUser.username);
  }, [readerUser?.username]);

  const requireAdmin = async (action) => {
    if (!apiConfigured) {
      window.alert("Book API is not configured. Set VITE_API_URL and rebuild the app.");
      return false;
    }
    if (adminToken) {
      setAdminMode(true);
      loadAdminBooks(adminToken).then(setBooks).catch((error) => setStorageMessage(`Could not load admin books: ${error.message}`));
      return true;
    }
    const entered = window.prompt(`Enter the admin password to ${action}:`);
    if (entered === null) return false;
    try {
      const token = await adminLogin(entered);
      sessionStorage.setItem("khmer-reader-admin-token", token);
      setAdminToken(token);
      setAdminMode(true);
      loadAdminBooks(token).then(setBooks).catch((error) => setStorageMessage(`Could not load admin books: ${error.message}`));
      return true;
    } catch (error) {
      window.alert(error.message);
      return false;
    }
  };

  // Reader Settings & Preferences
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [displayMode, setDisplayMode] = useState("both"); // 'original' | 'both' | 'khmer'
  const [theme, setTheme] = useState(() => localStorage.getItem("khmer-reader-theme") || "light"); // 'light' | 'dark'
  const [fontSize, setFontSize] = useState(18); // Base font size in px
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Audio Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPlaybackError, setAudioPlaybackError] = useState("");
  const [audioQueueActive, setAudioQueueActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const audioRef = useRef(null);
  const autoAdvanceAudioRef = useRef(false);

  useEffect(() => {
    if (!apiConfigured) return;
    let cancelled = false;
    loadBooks()
      .then((remoteBooks) => {
        if (cancelled) return;
        setBooks(remoteBooks);
        setActiveBookId(remoteBooks[0]?.id || "");
      })
      .catch((error) => {
        if (!cancelled) setStorageMessage(`Google storage: ${error.message}`);
      })
      .finally(() => { if (!cancelled) setIsLoadingBooks(false); });
    return () => { cancelled = true; };
  }, []);

  // Active Book Data
  const currentBook = books.find((b) => b.id === activeBookId) || books[0];
  const currentPage = currentBook?.pages[currentPageIndex] || null;

  useEffect(() => {
    if (!readerUser || !currentBook?.id || !["reader", "listen"].includes(currentView)) return;
    const timer = window.setTimeout(() => {
      setReadingProgress((previous) => {
        const next = { ...previous, [currentBook.id]: currentPageIndex };
        localStorage.setItem("khmer-reader-progress", JSON.stringify(next));
        return next;
      });
      saveReadingProgress(readerUser.username, currentBook.id, currentPageIndex).catch((error) => setAccountMessage(`Could not save reading history: ${error.message}`));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [readerUser, currentBook?.id, currentPageIndex, currentView]);

  // New Book Creator Form State
  const [newBook, setNewBook] = useState({
    title: "",
    titleKhmer: "",
    author: "",
    bookType: "",
    customBookType: "",
    isComingSoon: false,
    coverImage: "",
    pages: [
      {
        id: "page-1",
        pageNumber: 1,
        originalText: "",
        khmerText: "",
        audioUrl: "",
        audioFileName: ""
      }
    ]
  });

  // Handle Audio Time Updates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setPlaybackProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleLoadedMetadata = () => {
      setAudioDuration(audio.duration || 0);
    };

    const handleEnded = () => {
      setPlaybackProgress(0);
      if (audioQueueActive) {
        const nextAudioIndex = currentBook?.pages.findIndex((page, index) => index > currentPageIndex && page.audioUrl) ?? -1;
        if (nextAudioIndex >= 0) {
          autoAdvanceAudioRef.current = true;
          setCurrentPageIndex(nextAudioIndex);
        } else {
          setIsPlaying(false);
          setAudioQueueActive(false);
        }
      } else {
        setIsPlaying(false);
      }
      if (!audioQueueActive && currentPageIndex < (currentBook?.pages.length || 0) - 1) {
        setCurrentPageIndex((prev) => prev + 1);
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [currentPageIndex, currentBook, audioQueueActive]);

  useEffect(() => {
    if (currentView !== "listen" || !isPlaying || autoAdvanceAudioRef.current || !currentPage?.audioUrl || !audioRef.current) return;
    audioRef.current.play().catch((err) => {
      if (err.name === "AbortError") return;
      setAudioPlaybackError(`Audio could not play: ${err.message || "check the audio file access and format."}`);
      setIsPlaying(false);
    });
  }, [currentPageIndex, currentView, currentPage?.audioUrl, isPlaying]);

  // Handle Page Change Reset
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      if (autoAdvanceAudioRef.current) {
        audioRef.current.load();
      } else {
        setIsPlaying(false);
      }
      setPlaybackProgress(0);
    }
    setAudioPlaybackError("");
  }, [currentPageIndex]);

  useEffect(() => setPageJump(String(currentPageIndex + 1)), [currentPageIndex]);

  // Audio Play / Pause Toggle
  const togglePlayAudio = () => {
    // Book narration is for registered readers. Keep the reader itself
    // available to guests and prompt them here.
    if (!readerUser?.username) {
      setAccountMode("login");
      setAccountUsername("");
      setAccountPhone("");
      setAccountMessage("Sign in or create an account to listen to book audio.");
      setShowAccountForm(true);
      return;
    }

    if (!currentPage?.audioUrl || !audioRef.current) {
      setAudioPlaybackError("Audio is not available for this page yet.");
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setAudioPlaybackError("");
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("Audio playback error:", err);
          setAudioPlaybackError(`Audio could not play: ${err.message || "check the Drive file access and audio format."}`);
          setIsPlaying(false);
        });
    }
  };

  const handleSeek = (e) => {
    if (!audioRef.current || !audioDuration) return;
    const newPercent = parseFloat(e.target.value);
    const newTime = (newPercent / 100) * audioDuration;
    audioRef.current.currentTime = newTime;
    setPlaybackProgress(newPercent);
  };

  const changeSpeed = () => {
    const speeds = [0.8, 1.0, 1.25, 1.5];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  // Switch to Reader View
  const openReader = (bookId) => {
    const book = books.find((item) => item.id === bookId);
    setAudioQueueActive(false);
    setIsPlaying(false);
    setActiveBookId(bookId);
    setCurrentPageIndex(Math.min(readingProgress[bookId] || 0, Math.max(0, (book?.pages.length || 1) - 1)));
    setCurrentView("reader");
  };

  const openBook = (bookId) => {
    const book = books.find((item) => item.id === bookId);
    if (book?.pages.some((page) => page.audioUrl)) {
      const historyIndex = Math.min(Number(readingProgress[bookId]) || 0, Math.max(0, book.pages.length - 1));
      const historyAudioIndex = book.pages.findIndex((page, index) => index >= historyIndex && page.audioUrl);
      const firstAudioIndex = book.pages.findIndex((page) => page.audioUrl);
      setActiveBookId(bookId);
      setCurrentPageIndex(historyAudioIndex >= 0 ? historyAudioIndex : firstAudioIndex);
      setCurrentView("listen");
      setAudioQueueActive(false);
      setIsPlaying(false);
    } else openReader(bookId);
  };

  const startAudioBook = () => {
    if (!readerUser?.username) {
      setAccountMode("login");
      setAccountMessage("Sign in or create an account to listen to book audio.");
      setShowAccountForm(true);
      return;
    }
    if (!currentPage?.audioUrl) {
      setAudioPlaybackError("Choose a page with an audio track to start playback.");
      return;
    }
    setAudioQueueActive(true);
    setIsPlaying(true);
    setAudioPlaybackError("");
  };

  // Open Editor for an Existing Book
  const openEditBook = (book) => {
    setEditingBookId(book.id);
    setSaveStatus("");
    setExpandedPageId(null);
    // Deep copy pages to avoid unintended direct mutations
    setNewBook({
      title: book.title || "",
      titleKhmer: book.titleKhmer || "",
      author: book.author || "",
      bookType: book.bookType || "Other",
      customBookType: book.bookType || "",
      isComingSoon: Boolean(book.isComingSoon),
      coverImage: book.coverImage || "",
      pages: book.pages.map((p) => ({ ...p }))
    });
    setCurrentView("create");
  };

  // Open Creator for a Brand New Book
  const openCreateNewBook = () => {
    setEditingBookId(null);
    setSaveStatus("");
    setExcelUploadName("");
    const firstPageId = `page-${Date.now()}`;
    setExpandedPageId(firstPageId);
    setNewBook({
      title: "",
      titleKhmer: "",
      author: "",
      bookType: "",
      customBookType: "",
      isComingSoon: false,
      coverImage: "",
      pages: [
        {
          id: firstPageId,
          pageNumber: 1,
          originalText: "",
          khmerText: "",
          audioUrl: "",
          audioFileName: ""
        }
      ]
    });
    setCurrentView("create");
  };

  // Import page rows from an Excel workbook (A: page number, B: English, C: Khmer).
  const importExcelFile = async (file) => {
    if (!file) return;
    setIsImportingExcel(true);
    setSaveStatus("Reading Excel workbook…");
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error("The workbook is over the 25 MB import limit.");
      const worker = new Worker(new URL("./src/excelImportWorker.js", import.meta.url), { type: "module" });
      const rows = await new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          worker.terminate();
          reject(new Error("Excel import timed out. Try saving the workbook as .xlsx and importing it again."));
        }, 30000);
        const finish = (callback, value) => {
          window.clearTimeout(timeoutId);
          worker.terminate();
          callback(value);
        };
        worker.onmessage = ({ data }) => {
          data.error ? finish(reject, new Error(data.error)) : finish(resolve, data.rows);
        };
        worker.onerror = (event) => {
          event.preventDefault();
          finish(reject, new Error("Could not read this workbook. Check that it is a valid Excel file."));
        };
        worker.onmessageerror = () => {
          finish(reject, new Error("The workbook result could not be read. Try saving it as .xlsx and importing it again."));
        };
        file.arrayBuffer().then((buffer) => worker.postMessage(buffer, [buffer])).catch((error) => {
          finish(reject, error);
        });
      });
      const pages = rows.map((row, index) => {
        const pageNumberValue = Number(String(row[0] ?? "").trim());
        return {
          id: `page-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
          pageNumber: Number.isFinite(pageNumberValue) && pageNumberValue > 0 ? pageNumberValue : index + 1,
          originalText: String(row[1] ?? ""),
          khmerText: String(row[2] ?? ""),
          audioUrl: "",
          audioFileName: ""
        };
      });
      setNewBook((prev) => ({ ...prev, pages }));
      setExpandedPageId(pages[0].id);
      setExcelUploadName(`${file.name} · ${pages.length} pages imported`);
      setSaveStatus("Excel pages imported. Add the book title, then publish the book.");
    } catch (error) {
      setSaveStatus(`Excel import failed: ${error.message}`);
    } finally {
      setIsImportingExcel(false);
    }
  };

  const handleExcelUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    void importExcelFile(file);
  };

  const handleExcelDrop = (event) => {
    event.preventDefault();
    void importExcelFile(event.dataTransfer.files?.[0]);
  };

  const handleToggleBookVisibility = async (book) => {
    if (!(await requireAdmin(book.isHidden ? "unhide this book" : "hide this book"))) return;
    try {
      const updatedBooks = await saveBookToApi({ ...book, isHidden: !book.isHidden }, adminToken || sessionStorage.getItem("khmer-reader-admin-token"));
      setBooks(updatedBooks);
    } catch (error) {
      setSaveStatus(`Could not update book visibility: ${error.message}`);
      setStorageMessage(`Book visibility update failed: ${error.message}`);
    }
  };

  const handleDeleteBook = async (book) => {
    if (!window.confirm(`Permanently delete “${book.title}” and all its pages? This cannot be undone.`)) return;
    if (!(await requireAdmin("delete books"))) return;
    try {
      const updatedBooks = await deleteBookFromApi(book.id, adminToken || sessionStorage.getItem("khmer-reader-admin-token"));
      setBooks(updatedBooks);
      if (activeBookId === book.id) setActiveBookId(updatedBooks.find((item) => !item.isHidden)?.id || "");
    } catch (error) {
      setStorageMessage(`Book deletion failed: ${error.message}`);
    }
  };

  // Cover Image File Upload Handler
  const handleCoverUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setNewBook((prev) => ({
          ...prev,
          coverImage: event.target.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Page Voice Audio File Upload Handler
  const handlePageAudioUpload = (pageIndex, file) => {
    if (!file) return;
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (!["mp3", "wav", "m4a"].includes(fileExtension)) {
      window.alert("Choose an MP3, WAV, or M4A audio file. Raw .aac files are not supported reliably by browsers.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const mimeByExtension = { mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4" };
      const audioUrl = String(reader.result).replace(/^data:[^;,]+;/, `data:${mimeByExtension[fileExtension]};`);
      setNewBook((prev) => {
        const updated = [...prev.pages];
        updated[pageIndex] = { ...updated[pageIndex], audioUrl, audioFileName: file.name };
        return { ...prev, pages: updated };
      });
    };
    reader.readAsDataURL(file);
  };

  // Add Page in Creator (Appends at the end)
  const addNewPageToForm = () => {
    const id = `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setExpandedPageId(id);
    setNewBook((prev) => ({
      ...prev,
      pages: [
        ...prev.pages,
        {
          id,
          pageNumber: prev.pages.length + 1,
          originalText: "",
          khmerText: "",
          audioUrl: "",
          audioFileName: ""
        }
      ]
    }));
  };

  // Insert Page at a Specific Index (e.g. after index `targetIndex`)
  const insertPageAt = (targetIndex) => {
    const id = `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setExpandedPageId(id);
    setNewBook((prev) => {
      const newPage = {
        id,
        pageNumber: targetIndex + 2,
        originalText: "",
        khmerText: "",
        audioUrl: "",
        audioFileName: ""
      };
      const updated = [...prev.pages];
      updated.splice(targetIndex + 1, 0, newPage);
      // Renumber
      const renumbered = updated.map((p, idx) => ({
        ...p,
        pageNumber: idx + 1
      }));
      return { ...prev, pages: renumbered };
    });
  };

  // Move Page Up / Down
  const movePage = (index, direction) => {
    setNewBook((prev) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.pages.length) return prev;
      const updated = [...prev.pages];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      const renumbered = updated.map((p, idx) => ({
        ...p,
        pageNumber: idx + 1
      }));
      return { ...prev, pages: renumbered };
    });
  };

  // Remove Page in Creator
  const removePageFromForm = (index) => {
    if (newBook.pages.length <= 1) return;
    setNewBook((prev) => {
      const filtered = prev.pages.filter((_, idx) => idx !== index);
      const renumbered = filtered.map((p, idx) => ({
        ...p,
        pageNumber: idx + 1
      }));
      return { ...prev, pages: renumbered };
    });
  };

  // Save Book (Handles both Create and Update)
  const handleSaveBook = async (e) => {
    if (e) e.preventDefault();
    if (isSavingBook) return;
    if (!(await requireAdmin("save books")) || !newBook.title.trim()) return;
    const selectedBookType = newBook.bookType === "Other" ? newBook.customBookType.trim() : newBook.bookType;
    if (!selectedBookType) {
      setSaveStatus("Choose a book type. Enter a type if you select Other.");
      return;
    }

    setIsSavingBook(true);
    setSaveStatus("Preparing book update…");
    let bookToPersist;

    try {
    if (editingBookId) {
      // Update existing book
      const savedBook = books.find((book) => book.id === editingBookId);
      const updatedBooks = books.map((b) => {
        if (b.id === editingBookId) {
          return {
            ...b,
            title: newBook.title,
            titleKhmer: newBook.titleKhmer,
            author: newBook.author,
            bookType: selectedBookType,
            isComingSoon: Boolean(newBook.isComingSoon),
            coverImage:
              newBook.coverImage ||
              "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=600&q=80",
            // Existing book pages are saved only with their individual Save Page action.
            pages: savedBook?.pages || b.pages
          };
        }
        return b;
      });
      bookToPersist = updatedBooks.find((book) => book.id === editingBookId);
      setBooks(updatedBooks);
      setActiveBookId(editingBookId);
      // Ensure currentPageIndex stays in valid bounds
      setCurrentPageIndex((prev) =>
        Math.min(prev, Math.max(0, newBook.pages.length - 1))
      );
    } else {
      // Create new book
      const createdBook = {
        ...newBook,
        bookType: selectedBookType,
        id: `book-${Date.now()}`,
        coverImage:
          newBook.coverImage ||
          "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=600&q=80"
      };

      bookToPersist = createdBook;
      setBooks([createdBook, ...books]);
      setActiveBookId(createdBook.id);
      setCurrentPageIndex(0);
    }

    if (apiConfigured) {
      setSaveStatus("Uploading cover, audio, and page data…");
      try {
        const remoteBooks = await saveBookToApi(bookToPersist, adminToken || sessionStorage.getItem("khmer-reader-admin-token"));
        setBooks(remoteBooks);
        setSaveStatus("Book saved successfully.");
      } catch (error) {
        setStorageMessage(`API save failed: ${error.message}`);
        setSaveStatus(`Save failed: ${error.message}`);
        return;
      }
    }

    if (editingBookId) {
      setSaveStatus("Book information saved. Page edits are saved individually.");
    } else {
      setCurrentView(newBook.isComingSoon ? "library" : "reader");
    }
    } finally {
      setIsSavingBook(false);
    }
  };

  // Save only the selected page while retaining every other page as it was last saved.
  const handleSavePage = async (pageIndex) => {
    if (isSavingBook || !editingBookId) return;
    if (!(await requireAdmin("save this page"))) return;
    const savedBook = books.find((book) => book.id === editingBookId);
    if (!savedBook) {
      setSaveStatus("Could not find this book. Reopen it and try again.");
      return;
    }
    const pageToSave = newBook.pages[pageIndex];
    if (!pageToSave) return;
    const updatedBook = {
      ...savedBook,
      title: newBook.title,
      titleKhmer: newBook.titleKhmer,
      author: newBook.author,
      bookType: newBook.bookType === "Other" ? newBook.customBookType.trim() : newBook.bookType,
      coverImage: newBook.coverImage || savedBook.coverImage,
      pages: savedBook.pages.some((page) => page.id === pageToSave.id)
        ? savedBook.pages.map((page) =>
            page.id === pageToSave.id ? { ...pageToSave, pageNumber: page.pageNumber } : page
          )
        : [...savedBook.pages, { ...pageToSave, pageNumber: savedBook.pages.length + 1 }]
    };

    setIsSavingBook(true);
    setSaveStatus(`Saving page ${pageIndex + 1}…`);
    try {
      let updatedBooks = books.map((book) => book.id === editingBookId ? updatedBook : book);
      if (apiConfigured) {
        updatedBooks = await saveBookToApi(
          updatedBook,
          adminToken || sessionStorage.getItem("khmer-reader-admin-token")
        );
      }
      setBooks(updatedBooks);
      const persistedBook = updatedBooks.find((book) => book.id === editingBookId) || updatedBook;
      setNewBook((prev) => ({
        ...prev,
        pages: prev.pages.map((page) =>
          page.id === pageToSave.id
            ? { ...(persistedBook.pages.find((savedPage) => savedPage.id === page.id) || page) }
            : page
        ).concat(prev.pages.some((page) => page.id === pageToSave.id)
          ? []
          : [{ ...(persistedBook.pages.find((savedPage) => savedPage.id === pageToSave.id) || pageToSave) }])
      }));
      setSaveStatus(`Page ${pageIndex + 1} saved successfully.`);
    } catch (error) {
      setStorageMessage(`API save failed: ${error.message}`);
      setSaveStatus(`Page save failed: ${error.message}`);
    } finally {
      setIsSavingBook(false);
    }
  };

  const handleDeletePage = async (pageIndex) => {
    if (!editingBookId) {
      removePageFromForm(pageIndex);
      return;
    }
    if (isSavingBook || newBook.pages.length <= 1) return;
    if (!window.confirm(`Delete page ${pageIndex + 1}? This cannot be undone.`)) return;
    if (!(await requireAdmin("delete this page"))) return;
    const savedBook = books.find((book) => book.id === editingBookId);
    const pageToDelete = newBook.pages[pageIndex];
    if (!savedBook || !pageToDelete) return;
    if (!savedBook.pages.some((page) => page.id === pageToDelete.id)) {
      setNewBook((prev) => ({
        ...prev,
        pages: prev.pages.filter((page) => page.id !== pageToDelete.id)
          .map((page, index) => ({ ...page, pageNumber: index + 1 }))
      }));
      setExpandedPageId(newBook.pages[pageIndex - 1]?.id || null);
      return;
    }
    if (savedBook.pages.length <= 1) {
      setSaveStatus("Save another page before deleting the last saved page.");
      return;
    }
    const updatedBook = {
      ...savedBook,
      pages: savedBook.pages
        .filter((page) => page.id !== pageToDelete.id)
        .map((page, index) => ({ ...page, pageNumber: index + 1 }))
    };
    setIsSavingBook(true);
    setSaveStatus(`Deleting page ${pageIndex + 1}…`);
    try {
      let updatedBooks = books.map((book) => book.id === editingBookId ? updatedBook : book);
      if (apiConfigured) {
        updatedBooks = await saveBookToApi(
          updatedBook,
          adminToken || sessionStorage.getItem("khmer-reader-admin-token")
        );
      }
      setBooks(updatedBooks);
      const persistedBook = updatedBooks.find((book) => book.id === editingBookId) || updatedBook;
      const nextPages = persistedBook.pages.map((savedPage) => {
        const draftPage = newBook.pages.find((page) => page.id === savedPage.id);
        return { ...(draftPage || savedPage), pageNumber: savedPage.pageNumber };
      });
      setNewBook((prev) => ({ ...prev, pages: nextPages }));
      setExpandedPageId(nextPages[Math.min(pageIndex, nextPages.length - 1)]?.id || null);
      setSaveStatus(`Page ${pageIndex + 1} deleted.`);
    } catch (error) {
      setStorageMessage(`API save failed: ${error.message}`);
      setSaveStatus(`Page delete failed: ${error.message}`);
    } finally {
      setIsSavingBook(false);
    }
  };

  // Theme-based style mapping
  const themeStyles = {
    light: {
      bg: "bg-slate-50",
      card: "bg-white",
      text: "text-slate-800",
      subtext: "text-slate-500",
      accent: "text-indigo-600",
      border: "border-slate-200",
      badge: "bg-indigo-50 text-indigo-700 border-indigo-100",
      highlight: "bg-blue-50/70 text-slate-900 border-l-4 border-blue-500"
    },
    dark: {
      bg: "bg-zinc-950",
      card: "bg-zinc-900",
      text: "text-zinc-100",
      subtext: "text-zinc-400",
      accent: "text-indigo-400",
      border: "border-zinc-800",
      badge: "bg-zinc-800 text-zinc-300 border-zinc-700",
      highlight: "bg-zinc-800/80 text-zinc-100 border-l-4 border-indigo-500"
    },
    reading: {
      bg: "bg-amber-50",
      card: "bg-[#fff8e8]",
      text: "text-amber-950",
      subtext: "text-amber-800",
      accent: "text-amber-800",
      border: "border-amber-200",
      badge: "bg-amber-100 text-amber-900 border-amber-200",
      highlight: "bg-amber-100/80 text-amber-950 border-l-4 border-amber-600"
    }
  };

  const currentTheme = themeStyles[theme];
  useEffect(() => {
    localStorage.setItem("khmer-reader-theme", theme);
    // Keep the device/browser bands around the app black in every reader theme.
    document.documentElement.style.background = "#000000";
  }, [theme]);
  const normalizedBookSearch = bookSearch.trim().toLocaleLowerCase();
  const getBookTypes = (book) => [...new Set(String(book.bookType || "Other").split(/[\/;,]+/).map((type) => type.trim()).filter(Boolean))];
  const bookTypes = [...new Set(books.flatMap(getBookTypes))].sort((a, b) => a.localeCompare(b));
  const hasReadingHistory = (bookId) => Object.prototype.hasOwnProperty.call(readingProgress, bookId);
  const recommendedBooks = books
    .filter((book) => !book.isHidden && !book.isComingSoon && hasReadingHistory(book.id))
    .sort((a, b) => (Number(readingProgress[b.id]) || 0) - (Number(readingProgress[a.id]) || 0))
    .slice(0, 12);
  const filteredBooks = books.filter((book) => (adminMode ? Boolean(book.isHidden) === showHiddenBooks : !book.isHidden) &&
    [book.title, book.titleKhmer, book.author]
      .some((value) => String(value || "").toLocaleLowerCase().includes(normalizedBookSearch)) &&
    (libraryFilter !== "reading" || hasReadingHistory(book.id)) &&
    (libraryFilter !== "audio" || book.pages.some((page) => page.audioUrl)) &&
    (libraryFilter !== "text" || !book.isComingSoon) &&
    (libraryFilter !== "coming" || Boolean(book.isComingSoon)) &&
    (bookTypeFilter === "all" || getBookTypes(book).includes(bookTypeFilter)) &&
    (libraryFilter !== "favorites" || hasReadingHistory(book.id))
  ).sort((a, b) => {
    if (bookSort === "title") return String(a.title || "").localeCompare(String(b.title || ""));
    if (bookSort === "mostRead") return (Number(readingProgress[b.id]) || 0) - (Number(readingProgress[a.id]) || 0);
    return books.indexOf(a) - books.indexOf(b);
  });
  const featuredBooks = books.filter((book) => !book.isHidden && !book.isComingSoon);
  const featuredBook = featuredBooks.length ? featuredBooks[featuredIndex % featuredBooks.length] : null;
  const readerName = readerUser?.name || readerUser?.displayName || readerUser?.username;
  const audioReadyBooks = books.filter((book) => !book.isHidden && !book.isComingSoon && book.pages.some((page) => page.audioUrl));

  return (
    <div
      className={`min-h-screen bg-black ${currentTheme.text} flex justify-center font-sans transition-colors duration-200 antialiased`}
    >
      {/* Mobile Wrapper with fixed max-width for phone proportions */}
      <div className={`w-full max-w-5xl min-h-screen flex flex-col relative ${theme === "dark" ? "bg-zinc-950" : theme === "reading" ? "bg-[#fbf0d9]" : "bg-slate-50"} shadow-2xl border-x border-black`}>
        
        {/* ========================================================= */}
        {/* VIEW 1: BOOK LIBRARY                                      */}
        {/* ========================================================= */}
        {currentView === "library" && (
          <div className="flex-1 flex flex-col">
            {libraryTab === "home" && <main
              className="relative flex h-[100dvh] min-h-[520px] flex-col overflow-hidden bg-black text-white"
              onTouchStart={(event) => { featuredTouchStartX.current = event.touches[0]?.clientX ?? null; }}
              onTouchEnd={(event) => {
                const startX = featuredTouchStartX.current;
                featuredTouchStartX.current = null;
                const endX = event.changedTouches[0]?.clientX;
                if (startX == null || endX == null || featuredBooks.length < 2) return;
                const deltaX = endX - startX;
                if (Math.abs(deltaX) < 45) return;
                setFeaturedIndex((index) => (index + (deltaX < 0 ? 1 : -1) + featuredBooks.length) % featuredBooks.length);
              }}
            >
              <div className="absolute inset-0 bg-cover bg-center opacity-45 blur-[2px] scale-110" style={{ backgroundImage: featuredBook ? `url(${bookCoverImage(featuredBook)})` : "linear-gradient(135deg,#49351d,#131313)" }} />
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/95" />
              <header className="relative z-10 flex items-center justify-between px-6 py-4"><div><span className="block font-serif text-2xl italic">Khmer Reader</span><span className="mt-1 block text-sm font-medium text-white/85">{readerName ? `Welcome, ${readerName}` : "Browsing as guest"}</span></div><button onClick={() => setLibraryTab("search")} aria-label="Search books" className="rounded-full p-2"><Search /></button></header>
              {featuredBook ? <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-7 pb-20 text-center">
                <div className="flex h-[min(58vh,520px)] w-full max-w-[360px] items-center justify-center">
                  {featuredBooks.length > 1 && <button aria-label="Previous book" onClick={() => setFeaturedIndex((featuredIndex - 1 + featuredBooks.length) % featuredBooks.length)} className="absolute left-1 rounded-full bg-white/10 p-2"><ChevronLeft /></button>}
                  <button onClick={() => openBook(featuredBook.id)} aria-label={`${featuredBook.pages.some((page) => page.audioUrl) ? "Listen to" : "Read"} ${featuredBook.title}`} className="h-[94%] w-[min(76vw,330px)] shrink-0 overflow-hidden rounded-md shadow-[0_24px_48px_rgba(0,0,0,.55)]">
                    <img src={bookCoverImage(featuredBook)} alt={`${featuredBook.title} cover`} className="h-full w-full object-contain" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=600&q=80"; }} />
                  </button>
                  {featuredBooks.length > 1 && <button aria-label="Next book" onClick={() => setFeaturedIndex((featuredIndex + 1) % featuredBooks.length)} className="absolute right-1 rounded-full bg-white/10 p-2"><ChevronRight /></button>}
                </div>
                <div className="mt-5 flex gap-1.5">{featuredBooks.slice(0, 9).map((book, index) => <button key={book.id} aria-label={`Show ${book.title}`} onClick={() => setFeaturedIndex(index)} className={`h-1.5 rounded-full ${index === featuredIndex % featuredBooks.length ? "w-5 bg-white" : "w-1.5 bg-white/40"}`} />)}</div>
                <h1 className="mt-4 text-2xl font-semibold">{featuredBook.title}</h1>
                {featuredBook.titleKhmer && <p lang="km" className="mt-1 text-lg font-medium text-white/90">{featuredBook.titleKhmer}</p>}
                <p className="mt-1 text-sm text-white/70">{featuredBook.author || "Khmer Reader collection"}</p>
                <span className="mt-3 rounded-full bg-white/15 px-3 py-1 text-xs text-white/85">{featuredBook.pages.some((page) => page.audioUrl) ? "◉  Ready to Read · Audio" : "◉  Ready to Read · Text"}</span>
              </div> : isLoadingBooks ? <section aria-label="Loading books" aria-busy="true" className="relative z-10 flex flex-1 flex-col items-center justify-center px-7 pb-20 text-center text-white">
                <p className="mb-5 text-xs font-medium text-white/75">{readerName ? `Welcome, ${readerName}` : "Welcome to Khmer Reader"}</p>
                <div className="flex h-[min(58vh,520px)] w-full max-w-[360px] items-center justify-center">
                  <div className="h-[94%] w-[min(76vw,330px)] animate-pulse rounded-md bg-white/15 shadow-[0_24px_48px_rgba(0,0,0,.35)]" />
                </div>
                <div className="mt-5 h-1.5 w-14 animate-pulse rounded-full bg-white/45" />
                <div className="mt-5 h-6 w-64 max-w-full animate-pulse rounded bg-white/20" />
                <div className="mt-3 h-4 w-48 max-w-full animate-pulse rounded bg-white/15" />
                <p className="mt-5 text-xs text-white/65">Getting your books ready…</p>
              </section> : <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center text-white/70"><p className="text-lg font-semibold text-white">{readerName ? `Welcome, ${readerName}` : "Welcome to Khmer Reader"}</p><p>{storageMessage ? "We couldn’t load your books. Please try again later." : "Your books will appear here"}</p></div>}
            </main>}
            {/* Header */}
            <header className={`${libraryTab === "home" ? "hidden" : ""} sticky top-0 z-20 backdrop-blur-md px-4 sm:px-5 py-3 flex items-center justify-between border-b ${theme === "dark" ? "bg-zinc-950/95 border-zinc-800" : "bg-white/95 border-slate-200"}`}>
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                  <Languages className="w-4 h-4" />
                </div>
                <div>
                  <h1 className="text-sm font-extrabold leading-tight">Khmer Reader <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">PRO</span></h1>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">
                    {readerUser?.username ? `Signed in as ${readerUser.username}` : "Browsing as guest"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "reading" : "dark")} aria-label={`Current theme: ${theme}. Change theme`} title={`Theme: ${theme}`} className={`h-9 w-9 rounded-full border flex items-center justify-center transition ${theme === "dark" ? "border-zinc-700 bg-zinc-900 text-amber-300" : "border-slate-200 bg-white/80 text-slate-600"}`}>
                  {theme === "dark" ? <Moon className="w-4 h-4" /> : theme === "reading" ? <Coffee className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </button>
                <button onClick={() => window.location.reload()} aria-label="Refresh app" title="Refresh app" className={`h-9 w-9 rounded-full border flex items-center justify-center transition ${theme === "dark" ? "border-zinc-700 bg-zinc-900 text-zinc-300" : "border-slate-200 bg-white/80 text-slate-600"}`}>
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button onClick={() => setShowMainMenu((open) => !open)} aria-label={showMainMenu ? "Close menu" : "Open menu"} aria-expanded={showMainMenu} className={`h-9 w-9 rounded-full border flex items-center justify-center ${theme === "dark" ? "border-zinc-700 bg-zinc-900" : "border-slate-200 bg-white/80"}`}>
                  {showMainMenu ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                </button>
              </div>
            </header>

            {(showMainMenu || libraryTab === "profile") && <div className={`sticky top-[61px] z-20 border-b px-4 py-3 shadow-sm ${currentTheme.card} ${currentTheme.border}`}>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button onClick={() => { setLibraryFilter("all"); setShowMainMenu(false); }} className="rounded-lg border px-3 py-2 text-left">Library</button>
                <button onClick={() => { setLibraryFilter("audio"); setShowMainMenu(false); }} className="rounded-lg border px-3 py-2 text-left">Audio ready</button>
                <button onClick={() => { setLibraryFilter("text"); setShowMainMenu(false); }} className="rounded-lg border px-3 py-2 text-left">Text reading</button>
                <button onClick={() => { setLibraryFilter("favorites"); setShowMainMenu(false); }} className="rounded-lg border px-3 py-2 text-left">Saved books</button>
                <button onClick={() => { setAccountMode("login"); setAccountMessage(""); setShowAccountForm(true); setShowMainMenu(false); }} className="rounded-lg border px-3 py-2 text-left">{readerUser ? `Account · ${readerUser.username}` : "Sign in / Account"}</button>
                <button onClick={() => { setShowMainMenu(false); void installApp(); }} className="rounded-lg border px-3 py-2 text-left">Add to home screen</button>
                <button onClick={async () => { setShowMainMenu(false); if (await requireAdmin("add books")) openCreateNewBook(); }} className="col-span-2 rounded-lg bg-indigo-600 px-3 py-2 text-left font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" />Upload a book</button>
                {adminMode && <button onClick={() => { setShowHiddenBooks((hidden) => !hidden); setShowMainMenu(false); }} className="col-span-2 rounded-lg border px-3 py-2 text-left">{showHiddenBooks ? "Show available books" : "Show hidden books"}</button>}
                <div className="col-span-2 flex items-center gap-2 border-t pt-2"><span className="text-slate-500">Theme</span>{[["light","Light"],["dark","Black"],["reading","Reading"]].map(([value,label]) => <button key={value} onClick={() => setTheme(value)} className={`rounded-md border px-2.5 py-1.5 ${theme === value ? "border-indigo-500 text-indigo-600" : ""}`}>{label}</button>)}</div>
              </div>
            </div>}

            {libraryTab === "profile" && <section aria-label="Page visits" className={`mx-4 mt-3 rounded-xl border p-4 ${currentTheme.card} ${currentTheme.border}`}>
              <h2 className="text-sm font-bold">Page visits</h2>
              <p className="mt-1 text-2xl font-extrabold text-indigo-600">{pageVisitCount == null ? "—" : pageVisitCount.toLocaleString()}</p>
              <p className={`text-[10px] ${currentTheme.subtext}`}>Visitor sessions recorded</p>
            </section>}

            {libraryTab !== "home" && libraryTab !== "profile" && !readerUser && <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-xs text-indigo-950">
              <p><strong>Keep your place on every device.</strong> Sign in to sync your reading progress.</p>
              <button onClick={() => { setAccountMode("register"); setAccountMessage(""); setShowAccountForm(true); }} className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white">Save progress</button>
            </div>}
            {libraryTab !== "home" && installMessage && <div role="status" className="mx-4 mt-2 flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><span>{installMessage}</span><button aria-label="Dismiss install message" onClick={() => setInstallMessage("")}><X className="h-4 w-4" /></button></div>}

            {/* Content List */}
            <div className={`p-4 space-y-4 flex-1 ${libraryTab === "home" || libraryTab === "profile" ? "hidden" : ""}`}>
              {storageMessage && <p className="text-[11px] text-rose-600 dark:text-rose-400" role="status">{storageMessage}</p>}
              {/* Banner */}
              <div className="p-5 sm:p-7 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-semibold backdrop-blur-sm">
                    Dual Language & Voice
                  </span>
                  <h2 className="text-lg font-bold mt-2">អាន និងស្តាប់ជាភាសាខ្មែរ</h2>
                  <p className="text-xs text-indigo-100 mt-1 max-w-lg">
                    Read side-by-side or in Khmer with native page audio narration.
                  </p>
                </div>
                <Sparkles className="absolute right-3 bottom-2 w-20 h-20 text-white/10 pointer-events-none" />
              </div>

              <label className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-[#e9e4df] dark:border-zinc-800 text-slate-400 shadow-sm focus-within:border-violet-300 focus-within:ring-1 focus-within:ring-violet-100">
                <Search className="w-2 h-2 shrink-0 text-[#a5a0a0]" />
                <input
                  type="search"
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                  placeholder="Search books by title, author or Khmer..."
                  aria-label="Search books by title, author or Khmer"
                  className="w-full bg-transparent text-[7px] text-slate-800 dark:text-zinc-100 outline-none placeholder:text-[#aaa4a1]"
                />
              </label>

              <div className="space-y-1.5">
                {!adminMode && <nav aria-label="Filter books" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {[
                    ["all", "All books"],
                    ["audio", "Audio ready"],
                    ["text", "Available reading"],
                    ["coming", "Coming soon"],
                    ["favorites", "Favorites"]
                  ].map(([value, label]) => <button
                    key={value}
                    type="button"
                    aria-pressed={libraryFilter === value}
                    onClick={() => setLibraryFilter(value)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-[9px] font-semibold transition ${libraryFilter === value ? "border-indigo-600 bg-indigo-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600"}`}
                  >{label}</button>)}
                </nav>}
                <div className="flex min-w-0 items-center gap-2">
                  {bookTypes.length > 0 && <label className="flex min-w-0 items-center gap-2 text-[10px] font-medium text-slate-500">
                    <span className="shrink-0">Book type</span>
                    <select value={bookTypeFilter} onChange={(event) => setBookTypeFilter(event.target.value)} aria-label="Filter books by type" className="w-24 rounded-xl border border-[#e9e4df] bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-700 outline-none focus:border-violet-400">
                      <option value="all">All types</option>
                      {bookTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </label>}
                  <label className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-slate-500">
                    <span className="shrink-0">Sort</span>
                    <select value={bookSort} onChange={(event) => setBookSort(event.target.value)} aria-label="Sort books" className="w-28 rounded-xl border border-[#e9e4df] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 outline-none focus:border-violet-400">
                      <option value="newest">Newest</option>
                      <option value="mostRead">Most read</option>
                      <option value="title">Title A–Z</option>
                    </select>
                  </label>
                  <div className="ml-auto flex shrink-0 rounded-xl border border-[#e9e4df] bg-white p-0.5">
                    <button aria-label="Grid view" aria-pressed={libraryLayout === "grid"} onClick={() => setLibraryLayout("grid")} className={`rounded-lg p-1.5 transition-colors ${libraryLayout === "grid" ? "bg-violet-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}><LayoutGrid className="h-4 w-4" /></button>
                    <button aria-label="List view" aria-pressed={libraryLayout === "list"} onClick={() => setLibraryLayout("list")} className={`rounded-lg p-1.5 transition-colors ${libraryLayout === "list" ? "bg-violet-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}><List className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>

              {!adminMode && libraryFilter === "all" && recommendedBooks.length > 0 && <section aria-label="Recommended from your reading history" className="space-y-2">
                <div className="flex items-end justify-between"><div><h2 className="text-sm font-bold">Recommended for you</h2><p className="text-[10px] text-slate-500">Based on the books you’ve read</p></div></div>
                <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Recommended books; scroll horizontally">
                  {recommendedBooks.map((book) => <button key={book.id} type="button" onClick={() => openBook(book.id)} aria-label={`Open ${book.title}`} className="w-24 shrink-0 overflow-hidden rounded-xl text-left transition hover:-translate-y-0.5">
                    <img src={bookCoverImage(book)} alt={`${book.title} front cover`} className="aspect-[3/4] w-full object-contain" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=600&q=80"; }} />
                  </button>)}
                </div>
              </section>}

              {/* Book List Header */}
              <div className="flex items-center justify-between pt-2">
                <h2 className="text-[10px] font-semibold tracking-wide uppercase text-slate-500 dark:text-zinc-400">
                    {adminMode && showHiddenBooks ? "Hidden Books" : "Available Books"} ({filteredBooks.length})
                </h2>
                {adminMode && (
                  <button onClick={() => setShowHiddenBooks((hidden) => !hidden)} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">
                    {showHiddenBooks ? "Show available" : "Show hidden"}
                  </button>
                )}
              </div>

              {/* Grid of Books */}
              <div className={libraryLayout === "grid" ? "grid grid-cols-2 lg:grid-cols-4 gap-3" : "grid grid-cols-1 gap-3"}>
                {isLoadingBooks ? (
                  Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                      <div className="aspect-[3/4] bg-slate-200 dark:bg-zinc-800" />
                      <div className="p-3 space-y-2"><div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-zinc-800" /><div className="h-2.5 w-1/2 rounded bg-slate-100 dark:bg-zinc-800" /></div>
                    </div>
                  ))
                ) : filteredBooks.length ? filteredBooks.map((b) => (
                  <div
                    key={b.id}
                    className={`group bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition relative ${libraryLayout === "grid" ? "flex flex-col" : "flex flex-row"}`}
                  >
                    {/* Book Cover */}
                    <div
                      onClick={() => { if (!b.isComingSoon) openBook(b.id); }}
                      className={`${libraryLayout === "grid" ? "aspect-[3/4] w-full" : "w-24 h-32 shrink-0"} relative overflow-hidden ${b.isComingSoon ? "cursor-default" : "cursor-pointer"}`}
                    >
                      <img
                        src={bookCoverImage(b)}
                        alt={b.title}
                        className="w-full h-full object-contain group-hover:scale-105 transition duration-300"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=600&q=80";
                        }}
                      />
                      {b.isComingSoon && <span className={`absolute left-1 bottom-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[8px] font-extrabold text-amber-950 shadow ${libraryLayout !== "grid" ? "left-2 bottom-2 px-2.5 py-1 text-[10px]" : ""}`}>Coming soon</span>}
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] text-white flex items-center space-x-1">
                        {b.pages.some((page) => page.audioUrl) && <span aria-label={`Audio narration on ${b.pages.filter((page) => page.audioUrl).length} of ${b.pages.length} pages`} title={`Audio narration on ${b.pages.filter((page) => page.audioUrl).length} of ${b.pages.length} pages`} className="relative inline-flex h-4 w-4 items-center justify-center text-white">
                          <Headphones aria-hidden="true" className="h-4 w-4" />
                          <Play aria-hidden="true" className="absolute h-1.5 w-1.5 fill-current" />
                        </span>}
                        <BookOpen className="w-3 h-3" />
                        <span>{b.pages.length} pgs</span>
                      </div>
                      {libraryLayout === "grid" && !b.isComingSoon && <button onClick={() => openBook(b.id)} aria-label={`${b.pages.some((page) => page.audioUrl) ? "Listen to" : "Read"} ${b.title}`} className="absolute right-2 bottom-2 w-7 h-7 rounded-full bg-white/95 text-indigo-600 flex items-center justify-center shadow"><Play className="w-3.5 h-3.5 fill-current" /></button>}
                    </div>

                    {/* Book Details */}
                    <div className={`p-2.5 flex flex-col flex-1 justify-between min-w-0 ${libraryLayout === "grid" ? "min-h-36" : "py-2"}`}>
                      <div onClick={() => { if (!b.isComingSoon) openBook(b.id); }} className={b.isComingSoon ? "" : "cursor-pointer"}>
                        <h3 className="text-[11px] font-bold line-clamp-1 group-hover:text-indigo-600 transition">
                          {b.title}
                        </h3>
                        {b.titleKhmer && (
                          <p className="text-[10px] text-indigo-600 font-medium line-clamp-1 mt-0.5">
                            {b.titleKhmer}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-500 mt-1">
                          {b.author || "Unknown Author"}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">{getBookTypes(b).map((type) => <span key={type} className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-semibold text-indigo-700">{type}</span>)}</div>
                      </div>

                      {!adminMode && <div className="mt-2 border-t border-slate-100 pt-2">
                        <div className="flex justify-between text-[9px] text-slate-500 mb-1"><span>Progress</span><span className="font-bold text-slate-700">{Math.round((Math.min(readingProgress[b.id] || 0, Math.max(0, b.pages.length - 1)) / Math.max(1, b.pages.length)) * 100)}%</span></div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${Math.round((Math.min(readingProgress[b.id] || 0, Math.max(0, b.pages.length - 1)) / Math.max(1, b.pages.length)) * 100)}%` }} /></div>
                      </div>}

                      {/* Book actions are only shown after admin authentication. */}
                      {adminMode && <div className="mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-[11px] font-medium">
                        {adminMode && <button
                          onClick={() => void handleToggleBookVisibility(b)}
                          className="text-amber-700 hover:text-amber-900 dark:text-amber-400 p-1"
                          title={b.isHidden ? "Unhide this book" : "Hide this book from readers"}
                        >
                          {b.isHidden ? "Unhide" : "Hide"}
                        </button>}
                        {adminMode && <button
                          onClick={() => void handleDeleteBook(b)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Permanently delete this book and its pages"
                        >Delete</button>}
                        {!b.isComingSoon && <button
                          onClick={() => openReader(b.id)}
                          className="text-indigo-600 hover:text-indigo-700 flex items-center space-x-0.5"
                        >
                          <span>Read</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void requireAdmin("edit books").then((allowed) => { if (allowed) openEditBook(b); });
                          }}
                          className="flex items-center space-x-1 text-slate-500 hover:text-indigo-600 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                          title="Edit Book / Manage Pages"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span className="text-[10px]">Edit</span>
                        </button>
                      </div>}
                    </div>
                  </div>
                )) : (
                  <p className="col-span-2 py-10 text-center text-sm text-slate-500 dark:text-zinc-400">
                    {books.length ? "No books match your search." : "No books available yet."}
                  </p>
                )}
              </div>
            </div>
          <nav aria-label="Main navigation" className="fixed bottom-0 z-40 flex w-full max-w-5xl items-end justify-around border-t border-black bg-[#100f0e]/95 px-3 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 text-[10px] text-white shadow-[0_-8px_24px_rgba(0,0,0,.18)] backdrop-blur-md">
            <button onClick={() => { setLibraryTab("home"); setShowMainMenu(false); }} className={`flex min-w-14 flex-col items-center gap-1 py-1 ${libraryTab === "home" ? "text-amber-300" : "text-white/65"}`}><BookOpen className="h-5 w-5" />Home</button>
            <button onClick={() => { setLibraryTab("list"); setLibraryFilter("all"); setShowMainMenu(false); }} className={`flex min-w-14 flex-col items-center gap-1 py-1 ${libraryTab === "list" ? "text-amber-300" : "text-white/65"}`}><List className="h-5 w-5" />List</button>
            <button aria-label="Show audio ready books" onClick={() => { setLibraryTab("list"); setLibraryFilter("audio"); setShowMainMenu(false); }} className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full border-4 border-[#100f0e] bg-amber-200 text-[#291f11] shadow-lg"><Play className="h-6 w-6 fill-current" /></button>
            <button onClick={() => { setLibraryTab("search"); setShowMainMenu(false); }} className={`flex min-w-14 flex-col items-center gap-1 py-1 ${libraryTab === "search" ? "text-amber-300" : "text-white/65"}`}><Search className="h-5 w-5" />Search</button>
            <button onClick={() => { setLibraryTab("profile"); setShowMainMenu(false); }} className={`flex min-w-14 flex-col items-center gap-1 py-1 ${libraryTab === "profile" ? "text-amber-300" : "text-white/65"}`}><Settings className="h-5 w-5" />Profile</button>
          </nav>
          </div>
        )}

        {showAccountForm && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-5" onClick={(event) => { if (event.target === event.currentTarget) setShowAccountForm(false); }}>
            <form onSubmit={submitAccount} className={`w-full max-w-sm rounded-2xl p-5 shadow-xl ${currentTheme.card}`}>
              <h2 className="text-lg font-bold mb-1">{accountMode === "register" ? "Create account" : "Sign in"}</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">Sign in or create an account to listen to book audio and save reading history across devices.</p>
              {readerUser && <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-3">Signed in as {readerUser.username}</p>}
              <label className="block text-xs font-semibold mb-1">Username</label>
              <input required minLength={2} maxLength={40} value={accountUsername} onChange={(e) => setAccountUsername(e.target.value)} className="w-full mb-3 px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
              <label className="block text-xs font-semibold mb-1">Phone number</label>
              <input required type="tel" value={accountPhone} onChange={(e) => setAccountPhone(e.target.value)} placeholder="+855..." className="w-full mb-3 px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
              {accountMessage && <p role="status" className="text-xs mb-3 text-indigo-600 dark:text-indigo-400">{accountMessage}</p>}
              {showRegisterOffer && <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                <p className="font-semibold">Would you like to create an account with these details?</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => { setAccountMode("register"); setShowRegisterOffer(false); setAccountMessage("Create an account using the username and phone number above."); }} className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white">Yes, register</button>
                  <button type="button" onClick={() => setShowRegisterOffer(false)} className="rounded-lg border border-amber-300 px-3 py-2 font-semibold">No, go back</button>
                </div>
              </div>}
              {readerUser && <button type="button" disabled={historyBusy} onClick={() => void refreshReaderHistory()} className="w-full py-2 text-xs text-indigo-600 dark:text-indigo-400 disabled:opacity-60">{historyBusy ? "Refreshing history…" : "Refresh reading history"}</button>}
              <button disabled={accountBusy} className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-60">{accountBusy ? "Please wait…" : accountMode === "register" ? "Register" : "Sign in"}</button>
              <button type="button" onClick={() => { setAccountMode(accountMode === "register" ? "login" : "register"); setAccountMessage(""); setShowRegisterOffer(false); }} className="w-full py-2 text-xs text-indigo-600 dark:text-indigo-400">{accountMode === "register" ? "Already registered? Sign in" : "New here? Register"}</button>
              {readerUser && <button type="button" onClick={signOutReader} className="w-full py-2 text-xs text-slate-500">Sign out</button>}
              <button type="button" onClick={() => setShowAccountForm(false)} className="w-full py-1 text-xs text-slate-400">Continue as guest</button>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: DUAL-LANGUAGE AUDIO READER                       */}
        {/* ========================================================= */}
        {(currentView === "reader" || currentView === "listen") && (
          <div className="flex-1 flex flex-col h-[calc(100dvh-58px)]">
            {/* Hidden Audio Element */}
            {currentPage?.audioUrl && (
              <audio
                ref={audioRef}
                src={currentPage.audioUrl}
                preload="metadata"
                muted={isMuted}
                onCanPlay={() => {
                  if (!autoAdvanceAudioRef.current || !audioRef.current) return;
                  audioRef.current.play().then(() => {
                    autoAdvanceAudioRef.current = false;
                    setIsPlaying(true);
                    setAudioPlaybackError("");
                  }).catch((err) => {
                    if (err.name === "AbortError") return;
                    autoAdvanceAudioRef.current = false;
                    setIsPlaying(false);
                    setAudioPlaybackError(`Audio could not play: ${err.message || "check the audio file access and format."}`);
                  });
                }}
                onError={() => {
                  autoAdvanceAudioRef.current = false;
                  setIsPlaying(false);
                  const isRawAac = currentPage.audioFileName?.toLowerCase().endsWith(".aac");
                  setAudioPlaybackError(isRawAac
                    ? "This is raw .aac audio, which Chrome cannot play directly. Upload its matching .wav file or convert it to .m4a (AAC in MP4), then save the page."
                    : `Could not play ${currentPage.audioFileName || "this audio file"}. For the most reliable playback, upload an MP3 file in the editor and click Save Page. Also check that the Drive file is accessible.`);
                }}
              />
            )}

            {/* Top Navigation Bar */}
            <div
              className={`px-4 py-3 border-b flex items-center justify-between sticky top-0 z-30 ${currentTheme.card} ${currentTheme.border}`}
            >
              <button
                onClick={() => {
                  if (isPlaying && audioRef.current) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                  }
                  setAudioQueueActive(false);
                  setCurrentView("library");
                }}
                className="p-1.5 -ml-1 rounded-full hover:bg-black/5 active:scale-95 transition"
                title="Back to Library"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Title & Page Counter */}
              <div className="text-center px-2 flex-1">
                <h2 className="text-xs font-semibold uppercase tracking-wider line-clamp-1 opacity-75">
                  {currentBook?.title}
                </h2>
                <form className="mt-0.5 flex items-center justify-center gap-1 text-[11px]" onSubmit={(event) => { event.preventDefault(); const target = Number(pageJump); if (Number.isInteger(target) && target >= 1 && target <= (currentBook?.pages.length || 0)) setCurrentPageIndex(target - 1); }}>
                  <span className="font-bold text-indigo-500">ទំព័រ</span>
                  <input aria-label="Go to page number" type="number" min="1" max={currentBook?.pages.length || 1} value={pageJump} onChange={(event) => setPageJump(event.target.value)} className="w-12 rounded border border-slate-200 bg-transparent px-1 py-0.5 text-center font-bold text-indigo-600 outline-none focus:border-indigo-500" />
                  <span className="text-slate-500">/ {currentBook?.pages.length}</span>
                  <button type="submit" className="rounded bg-indigo-50 px-1.5 py-0.5 font-semibold text-indigo-600">Go</button>
                </form>
              </div>

              {/* Action Buttons: Edit Book & Reader Settings */}
              <div className="flex items-center space-x-1">
                {currentView === "listen" && <button onClick={() => { setAudioQueueActive(false); setIsPlaying(false); setCurrentView("reader"); }} className="rounded-full bg-indigo-600 px-2.5 py-1.5 text-[10px] font-semibold text-white">Read text</button>}
                <button onClick={() => window.location.reload()} aria-label="Refresh app" title="Refresh app" className="p-2 rounded-full hover:bg-black/5 active:scale-95 transition"><RotateCcw className="w-4 h-4" /></button>
                <button
                  onClick={() => {
                    if (isPlaying && audioRef.current) {
                      audioRef.current.pause();
                      setIsPlaying(false);
                    }
                    if (currentBook) void requireAdmin("edit books").then((allowed) => { if (allowed) openEditBook(currentBook, currentPageIndex); });
                  }}
                  className="p-2 rounded-full hover:bg-black/5 active:scale-95 transition text-indigo-600"
                  title="Edit Book or Insert Pages"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="p-2 rounded-full hover:bg-black/5 active:scale-95 transition"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Language Mode Selector (Original | Both | Khmer) */}
            {currentView === "reader" && <div
              className={`px-4 py-2 border-b flex items-center justify-between gap-1 text-xs font-medium ${currentTheme.card} ${currentTheme.border}`}
            >
              <button
                onClick={() => setDisplayMode("original")}
                className={`flex-1 py-1.5 rounded-lg text-center transition ${
                  displayMode === "original"
                    ? "bg-indigo-600 text-white font-semibold shadow-sm"
                    : "hover:bg-black/5 opacity-80"
                }`}
              >
                Original
              </button>
              <button
                onClick={() => setDisplayMode("both")}
                className={`flex-1 py-1.5 rounded-lg text-center transition ${
                  displayMode === "both"
                    ? "bg-indigo-600 text-white font-semibold shadow-sm"
                    : "hover:bg-black/5 opacity-80"
                }`}
              >
                ទាំងពីរ (Both)
              </button>
              <button
                onClick={() => setDisplayMode("khmer")}
                className={`flex-1 py-1.5 rounded-lg text-center transition ${
                  displayMode === "khmer"
                    ? "bg-indigo-600 text-white font-semibold shadow-sm"
                    : "hover:bg-black/5 opacity-80"
                }`}
              >
                ភាសាខ្មែរ
              </button>
            </div>}

            {/* Page Reading Canvas */}
            {currentView === "listen" ? <div className={`flex-1 flex flex-col items-center justify-center gap-4 px-7 text-center ${currentTheme.card}`}>
              <img src={bookCoverImage(currentBook || {})} alt={`${currentBook?.title} cover`} className="h-[min(42vh,360px)] max-w-[75vw] rounded-lg object-contain shadow-2xl" />
              <div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-indigo-500">Audiobook</p><h2 className="mt-1 text-lg font-bold">{currentBook?.title}</h2><p className="text-xs opacity-70">{currentBook?.author}</p></div>
              <label className="flex w-full max-w-xs flex-col gap-1 text-left text-xs font-semibold">
                Start from page
                <select
                  value={currentPage?.audioUrl ? currentPageIndex : ""}
                  onChange={(event) => {
                    setAudioQueueActive(false);
                    setIsPlaying(false);
                    setCurrentPageIndex(Number(event.target.value));
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                >
                  {(currentBook?.pages || []).map((page, index) => page.audioUrl ? (
                    <option key={page.id || index} value={index}>Page {index + 1}{readingProgress[currentBook.id] === index ? " · Listening history" : ""}</option>
                  ) : null)}
                </select>
              </label>
              <p className="text-xs opacity-70">Page {currentPageIndex + 1} of {currentBook?.pages.length} · Track {(currentBook?.pages.slice(0, currentPageIndex + 1).filter((page) => page.audioUrl).length || 1)} of {currentBook?.pages.filter((page) => page.audioUrl).length}</p>
              <button onClick={startAudioBook} disabled={isPlaying} className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg disabled:opacity-60">{isPlaying ? "Playing audiobook…" : "Play audiobook from selected page"}</button>
              <button onClick={() => { setAudioQueueActive(false); setIsPlaying(false); setCurrentView("reader"); }} className="text-xs font-semibold text-indigo-600">Open text reader (Original · Both · Khmer)</button>
            </div> : <div
              className="flex-1 overflow-y-auto px-5 py-6 space-y-6"
              style={{ fontSize: `${fontSize}px`, lineHeight: 1.7 }}
            >
              {currentPage ? (
                <>
                  {/* Original Text Section */}
                  {(displayMode === "original" || displayMode === "both") && (
                    <div className="relative group">
                      {displayMode === "both" && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-200/60 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 mb-2 inline-block">
                          Original Text
                        </span>
                      )}
                      <p className="whitespace-pre-line font-serif leading-relaxed text-justify">
                        {currentPage.originalText || (
                          <span className="italic text-slate-400">
                            No original text provided for this page.
                          </span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Divider in dual mode */}
                  {displayMode === "both" && (
                    <div className="relative py-2">
                      <div className="border-t border-dashed border-slate-300 dark:border-zinc-700"></div>
                      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-inherit px-2 text-[11px] text-slate-400">
                        ✦
                      </span>
                    </div>
                  )}

                  {/* Khmer Text Section */}
                  {(displayMode === "khmer" || displayMode === "both") && (
                    <div
                      className={`p-3.5 rounded-xl ${
                        displayMode === "both" ? currentTheme.highlight : ""
                      }`}
                    >
                      {displayMode === "both" && (
                        <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 mb-2 inline-block">
                          ការបកប្រែជាភាសាខ្មែរ
                        </span>
                      )}
                      <p
                        className="whitespace-pre-line leading-loose text-justify font-sans"
                        style={{ fontFamily: "'Kantumruy Pro', 'Battambang', sans-serif" }}
                      >
                        {currentPage.khmerText || (
                          <span className="italic text-slate-400">
                            មិនមានអត្ថបទបកប្រែសម្រាប់ទំព័រនេះទេ។
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-20 text-slate-400">
                  <p>ទំព័រទទេ / Page not found</p>
                </div>
              )}
            </div>}

            {/* Bottom Floating Audio Player & Pagination Controller */}
            <div
              className={`p-3.5 border-t shadow-lg ${currentTheme.card} ${currentTheme.border} rounded-t-2xl flex flex-col space-y-2`}
            >
              {/* Progress Bar (Scrubber) */}
              <div className="flex items-center space-x-2 text-xs">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={playbackProgress}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-slate-300 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              {/* Audio Controls and Page Navigators */}
              <div className="flex items-center justify-between pt-1">
                {/* Previous Page */}
                <button
                  disabled={currentPageIndex === 0}
                  onClick={() => setCurrentPageIndex((prev) => Math.max(0, prev - 1))}
                  className="p-2 rounded-full border border-slate-200 dark:border-zinc-700 hover:bg-black/5 disabled:opacity-30 disabled:pointer-events-none transition"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Main Audio Player Controls */}
                <div className="flex items-center space-x-3">
                  <button
                    onClick={changeSpeed}
                    className="text-[11px] font-bold px-2 py-1 rounded-md bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 active:scale-95 transition"
                  >
                    {playbackSpeed}x
                  </button>

                  {/* Play / Pause Button */}
                  <button
                    onClick={togglePlayAudio}
                    disabled={!currentPage?.audioUrl}
                    className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                    title={isPlaying ? "Pause Narration" : currentPage?.audioUrl ? "Listen to Narration" : "Audio is not available yet"}
                    aria-label={isPlaying ? "Pause narration" : currentPage?.audioUrl ? "Listen to narration" : "Audio is not available yet"}
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6 fill-current" />
                    ) : (
                      <Play className="w-6 h-6 fill-current ml-0.5" />
                    )}
                  </button>

                  {/* Audio source notice or mute button */}
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 transition"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? (
                      <VolumeX className="w-5 h-5 text-red-500" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* Next Page */}
                <button
                  disabled={currentPageIndex >= (currentBook?.pages.length || 0) - 1}
                  onClick={() =>
                    setCurrentPageIndex((prev) =>
                      Math.min((currentBook?.pages.length || 1) - 1, prev + 1)
                    )
                  }
                  className="p-2 rounded-full border border-slate-200 dark:border-zinc-700 hover:bg-black/5 disabled:opacity-30 disabled:pointer-events-none transition"
                  title="Next Page"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Status Indicator */}
              <div className="text-[10px] text-center text-slate-400 font-medium">
                {audioPlaybackError ? (
                  <span className="text-rose-600" role="status">{audioPlaybackError}</span>
                ) : currentPage?.audioUrl
                  ? `🎙️ ${currentPage.audioFileName || "Page voice track ready"}`
                  : "🎙️ Audio is not available for this page yet."}
              </div>
            </div>

            {/* Reading Customization Bottom Sheet / Modal */}
            {showSettingsModal && (
              <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center">
                <div
                  className={`w-full max-w-md ${currentTheme.card} rounded-t-3xl p-5 border-t ${currentTheme.border} shadow-2xl animate-in slide-in-from-bottom duration-200`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
                    <h3 className="font-bold text-sm">កំណត់ការអាន (Reading Options)</h3>
                    <button
                      onClick={() => setShowSettingsModal(false)}
                      className="p-1 rounded-full hover:bg-black/10"
                    >
                      <Check className="w-5 h-5 text-indigo-600" />
                    </button>
                  </div>

                  {/* Theme Switcher */}
                  <div className="mt-4">
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      ស្បែកពណ៌ (Theme)
                    </label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <button
                        onClick={() => setTheme("light")}
                        className={`py-2 px-3 rounded-xl border flex items-center justify-center space-x-1.5 text-xs font-semibold ${
                          theme === "light"
                            ? "border-indigo-600 bg-white text-indigo-600 shadow-sm"
                            : "border-slate-200 bg-slate-100 text-slate-700"
                        }`}
                      >
                        <Sun className="w-4 h-4" />
                        <span>Light</span>
                      </button>
                      <button
                        onClick={() => setTheme("dark")}
                        className={`py-2 px-3 rounded-xl border flex items-center justify-center space-x-1.5 text-xs font-semibold ${
                          theme === "dark"
                            ? "border-indigo-500 bg-zinc-900 text-white shadow-sm"
                            : "border-zinc-800 bg-zinc-950 text-zinc-400"
                        }`}
                      >
                        <Moon className="w-4 h-4" />
                        <span>Dark</span>
                      </button>
                      <button
                        onClick={() => setTheme("reading")}
                        className={`py-2 px-2 rounded-xl border flex items-center justify-center space-x-1.5 text-xs font-semibold ${
                          theme === "reading"
                            ? "border-amber-600 bg-[#fff8e8] text-amber-900 shadow-sm"
                            : "border-amber-200 bg-amber-50 text-amber-800"
                        }`}
                      >
                        <Coffee className="w-4 h-4" />
                        <span>Reading</span>
                      </button>
                    </div>
                  </div>

                  {/* Font Size Adjuster */}
                  <div className="mt-5 mb-2">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-500 uppercase">
                      <span>ទំហំអក្សរ (Font Size)</span>
                      <span className="text-indigo-600">{fontSize}px</span>
                    </div>
                    <div className="flex items-center space-x-3 mt-2">
                      <span className="text-xs font-bold">A</span>
                      <input
                        type="range"
                        min="14"
                        max="26"
                        value={fontSize}
                        onChange={(e) => setFontSize(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-300 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                      <span className="text-lg font-bold">A</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 3: BOOK & PAGE CREATOR / UPLOADER                    */}
        {/* ========================================================= */}
        {currentView === "create" && (
          <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 min-h-screen">
            {/* Top Bar */}
            <div className="sticky top-0 z-20 backdrop-blur-md bg-white/90 dark:bg-zinc-900/90 border-b border-slate-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
              <button
                onClick={() => setCurrentView(editingBookId ? "reader" : "library")}
                className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="text-center">
                <h2 className="text-sm font-bold">
                  {editingBookId ? "កែសម្រួលសៀវភៅ (Edit Book)" : "បង្កើតសៀវភៅថ្មី (New Book)"}
                </h2>
                {editingBookId && (
                  <p className="text-[10px] text-indigo-600 font-medium">{newBook.pages.filter((page) => page.audioUrl).length} of {newBook.pages.length} pages have audio · pages without audio are unavailable to listen to yet. Open a page to edit it.</p>
                )}
                {saveStatus && <p className="text-[10px] text-indigo-600" role="status" aria-live="polite">{saveStatus}</p>}
              </div>
              <button
                onClick={handleSaveBook}
                disabled={isSavingBook}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-xs font-semibold shadow-md active:scale-95 transition disabled:opacity-60 disabled:pointer-events-none"
              >
                {isSavingBook ? "Saving…" : editingBookId ? "Save Book Info" : "រក្សាទុក (Save)"}
              </button>
              <button type="button" onClick={() => window.location.reload()} aria-label="Refresh app" title="Refresh app" className="ml-2 rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"><RotateCcw className="h-4 w-4" /></button>
            </div>

            {/* Form Scroll Area */}
            <form onSubmit={handleSaveBook} className="p-4 space-y-6 flex-1 pb-24">
              {/* SECTION: Book Info */}
              <div className="space-y-4 bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  ពត៌មានសៀវភៅ (Book Metadata)
                </h3>

                {/* Cover Image Upload */}
                <div>
                  <label className="text-xs font-semibold mb-1.5 block">
                    រូបក្របទំព័រមុខ (Book Cover)
                  </label>
                  <div className="flex items-center space-x-3">
                    <div className="w-20 h-28 rounded-xl bg-slate-200 dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 overflow-hidden flex items-center justify-center relative flex-shrink-0">
                      {newBook.coverImage ? (
                        <img
                          src={newBook.coverImage}
                          alt="Cover"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-7 h-7 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="inline-flex items-center px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded-xl text-xs font-semibold cursor-pointer shadow-sm hover:bg-slate-50 transition">
                        <Upload className="w-4 h-4 mr-1.5 text-indigo-600" />
                        <span>ជ្រើសរើសរូបភាព (Upload)</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCoverUpload}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="text"
                        placeholder="ឬ បិទភ្ជាប់ Image URL..."
                        value={newBook.coverImage}
                        onChange={(e) =>
                          setNewBook({ ...newBook, coverImage: e.target.value })
                        }
                        className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Title (Original) */}
                <div>
                  <label className="text-xs font-semibold mb-1 block">
                    ចំណងជើងដើម (Original Title) *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. The Little Prince"
                    value={newBook.title}
                    onChange={(e) =>
                      setNewBook({ ...newBook, title: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl text-sm outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Title (Khmer) */}
                <div>
                  <label className="text-xs font-semibold mb-1 block">
                    ចំណងជើងជាភាសាខ្មែរ (Khmer Title)
                  </label>
                  <input
                    type="text"
                    placeholder="ឧទាហរណ៍៖ ព្រះអង្គម្ចាស់តូច"
                    value={newBook.titleKhmer}
                    onChange={(e) =>
                      setNewBook({ ...newBook, titleKhmer: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl text-sm outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Author */}
                <div>
                  <label className="text-xs font-semibold mb-1 block">
                    អ្នកនិពន្ធ (Author)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Antoine de Saint-Exupéry"
                    value={newBook.author}
                    onChange={(e) =>
                      setNewBook({ ...newBook, author: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl text-sm outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block">Book types *</label>
                  <input required type="text" maxLength={160} value={newBook.customBookType ?? newBook.bookType} onChange={(e) => setNewBook((prev) => ({ ...prev, bookType: e.target.value, customBookType: e.target.value }))} placeholder="Business parable / Management / Non-fiction / Self-help" className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl text-sm outline-none focus:border-indigo-500" />
                  <p className="mt-1 text-[10px] text-slate-500">Separate multiple types with /, comma, or semicolon. Each becomes a filter and label.</p>
                </div>
                <label className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-900"><input type="checkbox" checked={Boolean(newBook.isComingSoon)} onChange={(event) => setNewBook((prev) => ({ ...prev, isComingSoon: event.target.checked }))} className="h-4 w-4 accent-amber-600" />Show this book to readers as Coming soon</label>
              </div>

              {/* SECTION: Page By Page Content */}
              <div className="space-y-4">
                {!editingBookId && (
                  <div
                    className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/30 p-4"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleExcelDrop}
                  >
                    <label className="text-xs font-semibold mb-2 block">Import pages from Excel</label>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">Drop an Excel workbook here, or choose one. First worksheet, columns A–C: page number, English text, Khmer text. A header row is optional.</p>
                    <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold ${isImportingExcel ? "opacity-60 cursor-wait" : "cursor-pointer hover:bg-indigo-700"}`}>
                      <Upload className="w-4 h-4" />
                      <span>{isImportingExcel ? "Reading workbook…" : "Choose Excel file (.xlsx, .xls)"}</span>
                      <input type="file" accept=".xlsx,.xls,.xlsm,.xlsb" onChange={handleExcelUpload} disabled={isImportingExcel} className="sr-only" />
                    </label>
                    {excelUploadName && <p className="text-xs text-green-700 dark:text-green-400 mt-2">{excelUploadName}</p>}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    មាតិកាតាមទំព័រ (Pages: {newBook.pages.length})
                  </h3>
                  <button
                    type="button"
                    onClick={addNewPageToForm}
                    className="flex items-center space-x-1 text-xs font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 active:scale-95 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ថែមទំព័រ (Append)</span>
                  </button>
                </div>

                {newBook.pages.map((page, idx) => (
                  <React.Fragment key={page.id}>
                    <div className="bg-slate-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 relative space-y-3">
                      {/* Header of Page Box with Reordering and Delete */}
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setExpandedPageId(expandedPageId === page.id ? null : page.id)}
                          aria-expanded={expandedPageId === page.id}
                          className="flex items-center space-x-2 text-left"
                        >
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white">
                            Page {idx + 1}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {expandedPageId === page.id ? "Editing" : "Click to edit"} · {idx + 1} of {newBook.pages.length}
                          </span>
                        </button>

                        {/* Page management tools: Move up, Move down, Delete */}
                        <div className="flex items-center space-x-1">
                          {!editingBookId && <>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => movePage(idx, "up")}
                            className="p-1 text-slate-500 hover:text-indigo-600 disabled:opacity-30 disabled:pointer-events-none rounded hover:bg-slate-200 dark:hover:bg-zinc-700 transition"
                            title="Move Page Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === newBook.pages.length - 1}
                            onClick={() => movePage(idx, "down")}
                            className="p-1 text-slate-500 hover:text-indigo-600 disabled:opacity-30 disabled:pointer-events-none rounded hover:bg-slate-200 dark:hover:bg-zinc-700 transition"
                            title="Move Page Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          </>}

                          {newBook.pages.length > 1 && (
                          <button
                              type="button"
                            onClick={() => handleDeletePage(idx)}
                              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition ml-1"
                              title="Delete Page"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {expandedPageId === page.id && <>
                      {/* Original Text Field */}
                      <div>
                        <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300 block mb-1">
                          អត្ថបទដើម (Original Text)
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Type or paste the original text of this page..."
                          value={page.originalText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewBook((prev) => {
                              const updated = [...prev.pages];
                              updated[idx].originalText = val;
                              return { ...prev, pages: updated };
                            });
                          }}
                          className="w-full p-2.5 text-xs bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Khmer Text Field */}
                      <div>
                        <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300 block mb-1">
                          ការបកប្រែជាភាសាខ្មែរ (Khmer Translation)
                        </label>
                        <textarea
                          rows={3}
                          placeholder="បញ្ចូលការបកប្រែជាភាសាខ្មែរ..."
                          value={page.khmerText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewBook((prev) => {
                              const updated = [...prev.pages];
                              updated[idx].khmerText = val;
                              return { ...prev, pages: updated };
                            });
                          }}
                          className="w-full p-2.5 text-xs bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 font-sans"
                        />
                      </div>

                      {/* Page Voice Audio File Upload */}
                      <div className="pt-1">
                        <p className={`mb-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${page.audioUrl ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                          {page.audioUrl ? "Audio narration attached · readers can listen" : "Audio not available yet · readers cannot listen to this page"}
                        </p>
                        <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300 block mb-1.5">
                          សំឡេងអានសម្រាប់ទំព័រនេះ (Page Audio Narration)
                        </label>
                        <div className="flex items-center space-x-2">
                          <label className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl text-xs font-medium cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition">
                            <FileAudio className="w-4 h-4 text-indigo-600" />
                            <span className="truncate max-w-[190px]">
                              {page.audioFileName ||
                                (page.audioUrl ? "Audio track attached" : "បញ្ចូលសំឡេង (.mp3, .wav, .m4a)")}
                            </span>
                            <input
                              type="file"
                              accept=".mp3,audio/mpeg,.wav,audio/wav,audio/x-wav,.m4a,audio/mp4"
                              onChange={(e) => {
                                handlePageAudioUpload(idx, e.target.files[0]);
                                e.target.value = "";
                              }}
                              className="hidden"
                            />
                          </label>
                          {page.audioUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                const audio = new Audio(page.audioUrl);
                                audio.play();
                              }}
                              className="p-2 bg-indigo-50 dark:bg-zinc-800 text-indigo-600 rounded-xl border border-indigo-200 dark:border-zinc-700"
                              title="Preview Audio"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {editingBookId && (
                        <button
                          type="button"
                          onClick={() => handleSavePage(idx)}
                          disabled={isSavingBook}
                          className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold disabled:opacity-60 disabled:pointer-events-none"
                        >
                          <Check className="w-4 h-4" />
                          {isSavingBook ? "Saving…" : `Save Page ${idx + 1}`}
                        </button>
                      )}
                      </>}
                    </div>

                    {/* Insert Page Button between pages */}
                    {!editingBookId && <div className="flex justify-center my-1">
                      <button
                        type="button"
                        onClick={() => insertPageAt(idx)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white dark:bg-zinc-800 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-zinc-700 border border-dashed border-indigo-300 dark:border-indigo-800 rounded-full text-[11px] font-semibold transition shadow-sm active:scale-95"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>បញ្ចូលទំព័របន្ថែមនៅទីនេះ (Insert Page Here)</span>
                      </button>
                    </div>}
                  </React.Fragment>
                ))}

                {/* Add Another Page to End Button */}
                <button
                  type="button"
                  onClick={addNewPageToForm}
                  className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-indigo-500 rounded-2xl flex items-center justify-center space-x-2 text-xs font-bold text-slate-500 dark:text-zinc-400 hover:text-indigo-600 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>ថែមទំព័រចុងក្រោយ (Add Page at End)</span>
                </button>
              </div>

              {/* New books publish all pages together; existing books save each page separately. */}
              {!editingBookId && <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSavingBook}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-[0.99] text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-600/30 transition flex items-center justify-center space-x-2 disabled:opacity-60 disabled:pointer-events-none"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>
                    {isSavingBook ? "Saving book…" : editingBookId ? "រក្សាទុកការកែប្រែ (Save Changes)" : "បង្កើតសៀវភៅ (Publish Book)"}
                  </span>
                </button>
              </div>}
            </form>
          </div>
        )}

      </div>
    </div>
  );
}

