import React, { useState, useEffect, useRef } from "react";
import { apiConfigured, adminLogin, loadBooks, saveBook as saveBookToApi } from "./src/bookApi.js";
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
  PlusCircle
} from "lucide-react";

// Default Sample Book for immediate testing
const SAMPLE_BOOK = {
  id: "sample-little-prince",
  title: "The Little Prince",
  titleKhmer: "ព្រះអង្គម្ចាស់តូច",
  author: "Antoine de Saint-Exupéry",
  coverImage:
    "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80",
  pages: [
    {
      id: "p1",
      pageNumber: 1,
      originalText:
        "Once when I was six years old I saw a magnificent picture in a book, called True Stories from Nature, about the primeval forest. It was a picture of a boa constrictor in the act of swallowing an animal.",
      khmerText:
        "កាលពីខ្ញុំមានអាយុប្រាំមួយឆ្នាំ ខ្ញុំបានឃើញរូបភាពដ៏អស្ចារ្យមួយនៅក្នុងសៀវភៅមួយក្បាល ដែលមានចំណងជើងថា «រឿងពិតពីធម្មជាតិ» និយាយអំពីព្រៃបុរាណ។ នោះគឺជារូបភាពសត្វពស់ថ្លាន់មួយក្បាល កំពុងតែលេបសត្វព្រៃមួយទាំងមូល។",
      audioUrl: "",
      audioFileName: ""
    },
    {
      id: "p2",
      pageNumber: 2,
      originalText:
        "In the book it said: 'Boa constrictors swallow their prey whole, without chewing it. After that they are not able to move, and they sleep through the six months that they need for digestion.'",
      khmerText:
        "នៅក្នុងសៀវភៅនោះបានរៀបរាប់ថា៖ «ពស់ថ្លាន់លេបរំពារបស់វាទាំងមូលដោយមិនទំពារឡើយ។ បន្ទាប់មក ពួកវាមិនអាចកម្រើកខ្លួនបានទេ ហើយត្រូវដេកលក់អស់រយៈពេលប្រាំមួយខែ ដើម្បីរំលាយអាហារនោះ។»",
      audioUrl: "",
      audioFileName: ""
    },
    {
      id: "p3",
      pageNumber: 3,
      originalText:
        "I pondered deeply, then, over the adventures of the jungle. And after some work with a colored pencil I succeeded in making my first drawing. My Drawing Number One.",
      khmerText:
        "ខ្ញុំបានគិតយ៉ាងស៊ីជម្រៅអំពីការផ្សងព្រេងនៅក្នុងព្រៃជ្រៅ។ បន្ទាប់មក ដោយប្រើខ្មៅដៃពណ៌ ខ្ញុំក៏បានគូររូបគំនូរដំបូងរបស់ខ្ញុំបានជោគជ័យ។ នោះគឺជារូបគំនូរលេខមួយរបស់ខ្ញុំ។",
      audioUrl: "",
      audioFileName: ""
    }
  ]
};

export default function App() {
  // Navigation State: 'library' | 'reader' | 'create'
  const [currentView, setCurrentView] = useState("library");

  // Books List
  const [books, setBooks] = useState([SAMPLE_BOOK]);
  const [activeBookId, setActiveBookId] = useState(SAMPLE_BOOK.id);
  const [storageMessage, setStorageMessage] = useState(apiConfigured ? "Connecting to the book API…" : "Book API is not configured. Set VITE_API_URL to sync books.");

  // Editing state: null when creating new, or book ID string when editing existing
  const [editingBookId, setEditingBookId] = useState(null);
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem("khmer-reader-admin-token") || "");

  const requireAdmin = async (action) => {
    if (!apiConfigured) {
      window.alert("Book API is not configured. Set VITE_API_URL and rebuild the app.");
      return false;
    }
    if (adminToken) return true;
    const entered = window.prompt(`Enter the admin password to ${action}:`);
    if (entered === null) return false;
    try {
      const token = await adminLogin(entered);
      sessionStorage.setItem("khmer-reader-admin-token", token);
      setAdminToken(token);
      return true;
    } catch (error) {
      window.alert(error.message);
      return false;
    }
  };

  // Reader Settings & Preferences
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [displayMode, setDisplayMode] = useState("both"); // 'original' | 'both' | 'khmer'
  const [theme, setTheme] = useState("sepia"); // 'light' | 'dark' | 'sepia'
  const [fontSize, setFontSize] = useState(18); // Base font size in px
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Audio Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!apiConfigured) return;
    let cancelled = false;
    loadBooks()
      .then((remoteBooks) => {
        if (cancelled) return;
        setBooks(remoteBooks);
        setActiveBookId(remoteBooks[0]?.id || "");
        setStorageMessage("Connected to the book API.");
      })
      .catch((error) => {
        if (!cancelled) setStorageMessage(`Google storage: ${error.message}`);
      });
    return () => { cancelled = true; };
  }, []);

  // Active Book Data
  const currentBook = books.find((b) => b.id === activeBookId) || books[0];
  const currentPage = currentBook?.pages[currentPageIndex] || null;

  // New Book Creator Form State
  const [newBook, setNewBook] = useState({
    title: "",
    titleKhmer: "",
    author: "",
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
      setIsPlaying(false);
      setPlaybackProgress(0);
      // Auto advance to next page if available
      if (currentPageIndex < (currentBook?.pages.length || 0) - 1) {
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
  }, [currentPageIndex, currentBook]);

  // Handle Page Change Reset
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setPlaybackProgress(0);
    }
  }, [currentPageIndex]);

  // Audio Play / Pause Toggle
  const togglePlayAudio = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // If no audio file uploaded for this page, provide SpeechSynthesis fallback for original text
      if (!currentPage?.audioUrl) {
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utteranceText =
            displayMode === "khmer"
              ? currentPage?.khmerText
              : currentPage?.originalText;
          const utterance = new SpeechSynthesisUtterance(utteranceText);
          utterance.rate = playbackSpeed;
          utterance.onend = () => setIsPlaying(false);
          utterance.onerror = () => setIsPlaying(false);
          setIsPlaying(true);
          window.speechSynthesis.speak(utterance);
          return;
        }
      }

      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("Audio playback error:", err);
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
    setActiveBookId(bookId);
    setCurrentPageIndex(0);
    setCurrentView("reader");
  };

  // Open Editor for an Existing Book
  const openEditBook = (book, startAtPageIndex = 0) => {
    setEditingBookId(book.id);
    // Deep copy pages to avoid unintended direct mutations
    setNewBook({
      title: book.title || "",
      titleKhmer: book.titleKhmer || "",
      author: book.author || "",
      coverImage: book.coverImage || "",
      pages: book.pages.map((p) => ({ ...p }))
    });
    setCurrentView("create");
  };

  // Open Creator for a Brand New Book
  const openCreateNewBook = () => {
    setEditingBookId(null);
    setNewBook({
      title: "",
      titleKhmer: "",
      author: "",
      coverImage: "",
      pages: [
        {
          id: `page-${Date.now()}`,
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
    const reader = new FileReader();
    reader.onload = () => {
      setNewBook((prev) => {
        const updated = [...prev.pages];
        updated[pageIndex] = { ...updated[pageIndex], audioUrl: reader.result, audioFileName: file.name };
        return { ...prev, pages: updated };
      });
    };
    reader.readAsDataURL(file);
  };

  // Add Page in Creator (Appends at the end)
  const addNewPageToForm = () => {
    setNewBook((prev) => ({
      ...prev,
      pages: [
        ...prev.pages,
        {
          id: `page-${Date.now()}`,
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
    setNewBook((prev) => {
      const newPage = {
        id: `page-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
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
    if (!(await requireAdmin("save books")) || !newBook.title.trim()) return;

    let bookToPersist;

    if (editingBookId) {
      // Update existing book
      const updatedBooks = books.map((b) => {
        if (b.id === editingBookId) {
          return {
            ...b,
            title: newBook.title,
            titleKhmer: newBook.titleKhmer,
            author: newBook.author,
            coverImage:
              newBook.coverImage ||
              "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=600&q=80",
            pages: newBook.pages
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
      setStorageMessage("Saving book to the API…");
      try {
        const remoteBooks = await saveBookToApi(bookToPersist, adminToken || sessionStorage.getItem("khmer-reader-admin-token"));
        setBooks(remoteBooks);
        setStorageMessage("Book saved to the API.");
      } catch (error) {
        setStorageMessage(`API save failed: ${error.message}`);
        return;
      }
    }

    setCurrentView("reader");
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
    sepia: {
      bg: "bg-[#fbf0d9]",
      card: "bg-[#f4e4c1]",
      text: "text-[#433422]",
      subtext: "text-[#795548]",
      accent: "text-[#8d5b4c]",
      border: "border-[#e0ceaa]",
      badge: "bg-[#e8d5b5] text-[#5d4037] border-[#d7be95]",
      highlight: "bg-[#ebd9b7]/80 text-[#3e2723] border-l-4 border-[#8d5b4c]"
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
    }
  };

  const currentTheme = themeStyles[theme];

  return (
    <div
      className={`min-h-screen ${currentTheme.bg} ${currentTheme.text} flex justify-center font-sans transition-colors duration-200 antialiased`}
    >
      {/* Mobile Wrapper with fixed max-width for phone proportions */}
      <div className="w-full max-w-md min-h-screen flex flex-col relative shadow-2xl border-x border-black/5">
        
        {/* ========================================================= */}
        {/* VIEW 1: BOOK LIBRARY                                      */}
        {/* ========================================================= */}
        {currentView === "library" && (
          <div className="flex-1 flex flex-col pb-20">
            {/* Header */}
            <header className="sticky top-0 z-20 backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                  <Languages className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold leading-tight">Khmer Reader</h1>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                    បណ្ណាល័យសៀវភៅពីរភាសា
                  </p>
                </div>
              </div>

              <button
                onClick={async () => { if (await requireAdmin("add books")) openCreateNewBook(); }}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-full text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Upload</span>
              </button>
            </header>

            {/* Content List */}
            <div className="p-4 space-y-4 flex-1">
              <p className="text-[11px] text-slate-500 dark:text-zinc-400" role="status">{storageMessage}</p>
              {/* Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-[11px] font-medium backdrop-blur-sm">
                    Dual Language & Voice
                  </span>
                  <h2 className="text-lg font-bold mt-2">អាន និងស្តាប់ជាភាសាខ្មែរ</h2>
                  <p className="text-xs text-indigo-100 mt-1 max-w-[220px]">
                    Read side-by-side or in Khmer with native page audio narration.
                  </p>
                </div>
                <Sparkles className="absolute right-3 bottom-2 w-20 h-20 text-white/10 pointer-events-none" />
              </div>

              {/* Book List Header */}
              <div className="flex items-center justify-between pt-2">
                <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-500 dark:text-zinc-400">
                  Available Books ({books.length})
                </h2>
              </div>

              {/* Grid of Books */}
              <div className="grid grid-cols-2 gap-3.5">
                {books.map((b) => (
                  <div
                    key={b.id}
                    className="group bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col relative"
                  >
                    {/* Book Cover */}
                    <div
                      onClick={() => openReader(b.id)}
                      className="aspect-[3/4] w-full relative bg-slate-100 dark:bg-zinc-800 overflow-hidden cursor-pointer"
                    >
                      <img
                        src={b.coverImage}
                        alt={b.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        onError={(e) => {
                          e.target.src =
                            "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=600&q=80";
                        }}
                      />
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] text-white flex items-center space-x-1">
                        <BookOpen className="w-3 h-3" />
                        <span>{b.pages.length} pgs</span>
                      </div>
                    </div>

                    {/* Book Details */}
                    <div className="p-3 flex flex-col flex-1 justify-between">
                      <div onClick={() => openReader(b.id)} className="cursor-pointer">
                        <h3 className="text-sm font-bold line-clamp-1 group-hover:text-indigo-600 transition">
                          {b.title}
                        </h3>
                        {b.titleKhmer && (
                          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium line-clamp-1 mt-0.5">
                            {b.titleKhmer}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-1">
                          {b.author || "Unknown Author"}
                        </p>
                      </div>

                      {/* Bottom action bar with Read and Quick Edit */}
                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-[11px] font-medium">
                        <button
                          onClick={() => openReader(b.id)}
                          className="text-indigo-600 hover:text-indigo-700 flex items-center space-x-0.5"
                        >
                          <span>Read</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>

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
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: DUAL-LANGUAGE AUDIO READER                       */}
        {/* ========================================================= */}
        {currentView === "reader" && (
          <div className="flex-1 flex flex-col h-screen">
            {/* Hidden Audio Element */}
            {currentPage?.audioUrl && (
              <audio
                ref={audioRef}
                src={currentPage.audioUrl}
                preload="metadata"
                muted={isMuted}
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
                <div className="text-[11px] font-bold text-indigo-500">
                  ទំព័រ {currentPageIndex + 1} / {currentBook?.pages.length}
                </div>
              </div>

              {/* Action Buttons: Edit Book & Reader Settings */}
              <div className="flex items-center space-x-1">
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
            <div
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
            </div>

            {/* Page Reading Canvas */}
            <div
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
            </div>

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
                    className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition"
                    title={isPlaying ? "Pause Narration" : "Listen to Narration"}
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
                {currentPage?.audioUrl
                  ? `🎙️ ${currentPage.audioFileName || "Page voice track ready"}`
                  : "🎙️ Using text-to-speech fallback"}
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
                        onClick={() => setTheme("sepia")}
                        className={`py-2 px-3 rounded-xl border flex items-center justify-center space-x-1.5 text-xs font-semibold ${
                          theme === "sepia"
                            ? "border-[#8d5b4c] bg-[#f4e4c1] text-[#433422] shadow-sm"
                            : "border-[#e0ceaa] bg-[#fbf0d9] text-[#795548]"
                        }`}
                      >
                        <Coffee className="w-4 h-4" />
                        <span>Sepia</span>
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
                  <p className="text-[10px] text-indigo-600 font-medium">Editing pages & audio</p>
                )}
              </div>
              <button
                onClick={handleSaveBook}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-xs font-semibold shadow-md active:scale-95 transition"
              >
                រក្សាទុក (Save)
              </button>
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
              </div>

              {/* SECTION: Page By Page Content */}
              <div className="space-y-4">
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
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white">
                            ទំព័រទី {idx + 1}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Page {idx + 1} of {newBook.pages.length}
                          </span>
                        </div>

                        {/* Page management tools: Move up, Move down, Delete */}
                        <div className="flex items-center space-x-1">
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

                          {newBook.pages.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removePageFromForm(idx)}
                              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition ml-1"
                              title="Delete Page"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

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
                        <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300 block mb-1.5">
                          សំឡេងអានសម្រាប់ទំព័រនេះ (Page Audio Narration)
                        </label>
                        <div className="flex items-center space-x-2">
                          <label className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl text-xs font-medium cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition">
                            <FileAudio className="w-4 h-4 text-indigo-600" />
                            <span className="truncate max-w-[190px]">
                              {page.audioFileName ||
                                (page.audioUrl ? "Audio track attached" : "បញ្ចូលសំឡេង (.mp3, .wav)")}
                            </span>
                            <input
                              type="file"
                              accept="audio/*"
                              onChange={(e) =>
                                handlePageAudioUpload(idx, e.target.files[0])
                              }
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
                    </div>

                    {/* Insert Page Button between pages */}
                    <div className="flex justify-center my-1">
                      <button
                        type="button"
                        onClick={() => insertPageAt(idx)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white dark:bg-zinc-800 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-zinc-700 border border-dashed border-indigo-300 dark:border-indigo-800 rounded-full text-[11px] font-semibold transition shadow-sm active:scale-95"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>បញ្ចូលទំព័របន្ថែមនៅទីនេះ (Insert Page Here)</span>
                      </button>
                    </div>
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

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-[0.99] text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-600/30 transition flex items-center justify-center space-x-2"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>
                    {editingBookId ? "រក្សាទុកការកែប្រែ (Save Changes)" : "បង្កើតសៀវភៅ (Publish Book)"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
