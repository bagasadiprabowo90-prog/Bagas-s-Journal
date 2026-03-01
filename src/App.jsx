import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Save, Feather, Trash2, Download, X } from 'lucide-react'
import html2canvas from 'html2canvas'
import './App.css'

// Mock AI Refiner
const refineTextMock = async (rawText) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      let refined = rawText
        .replace(/\b(umm|uh|hmm|anu|apa ya|eee)\b/gi, "") // Remove fillers
        .replace(/\s+/g, " ") // Fix extra spaces
        .trim();

      // Capitalize first letter of sentences
      refined = refined.replace(/(^\s*\w|[.!?]\s*\w)/g, c => c.toUpperCase());

      resolve(refined);
    }, 1500); // Simulate API delay
  });
}

function App() {
  const [isRecording, setIsRecording] = useState(false)
  const [text, setText] = useState("")
  const [interimText, setInterimText] = useState("")
  const [isRefining, setIsRefining] = useState(false)

  const recognitionRef = useRef(null)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  // PWA Install Prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Only show if not dismissed before
      const dismissed = localStorage.getItem('pwa_install_dismissed');
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa_install_dismissed', 'true');
  };

  // Auto-save effect
  useEffect(() => {
    const saved = localStorage.getItem('silent_script_note');
    if (saved) setText(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('silent_script_note', text);
  }, [text]);

  // Init Speech Recognition
  const processedIndexRef = useRef(0);
  const shouldRestartRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;  // Use non-continuous to avoid mobile duplication
      recognition.interimResults = true;
      recognition.lang = 'id-ID';

      recognition.onresult = (event) => {
        let currentInterim = '';
        let currentFinal = '';

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            currentFinal += result[0].transcript + ' ';
          } else {
            currentInterim += result[0].transcript;
          }
        }

        setInterimText(currentInterim);

        if (currentFinal.trim().length > 0) {
          setInterimText('');
          processAI(currentFinal.trim());
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setIsRecording(false);
          shouldRestartRef.current = false;
        }
      };

      recognition.onend = () => {
        // Auto-restart if user hasn't pressed stop
        if (shouldRestartRef.current) {
          try {
            recognition.start();
          } catch (e) {
            console.error(e);
            setIsRecording(false);
            shouldRestartRef.current = false;
          }
        } else {
          setIsRecording(false);
          setInterimText('');
        }
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("Speech recognition not supported in this browser.");
    }

    return () => {
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const processAI = async (newRawText) => {
    setIsRefining(true);
    try {
      const refined = await refineTextMock(newRawText);
      setText(prev => {
        const p = prev.trim();
        const spacer = p && !p.endsWith('\n') ? ' ' : '';
        return p + spacer + refined;
      });
    } catch (error) {
      console.error("Error refining text:", error);
      setText(prev => prev + ' ' + newRawText);
    } finally {
      setIsRefining(false);
    }
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Browser Anda tidak mendukung fitur Speech-to-Text.");
      return;
    }

    if (isRecording) {
      shouldRestartRef.current = false;
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        shouldRestartRef.current = true;
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error(e);
        shouldRestartRef.current = false;
      }
    }
  }

  // Save to image function using html2canvas
  const saveImage = async () => {
    const notebookElement = document.getElementById('notebook-canvas');
    if (!notebookElement) {
      alert("Area tulisan tidak ditemukan.");
      return;
    }

    try {
      const canvas = await html2canvas(notebookElement, {
        scale: 2, // Higher quality
        useCORS: true,
        backgroundColor: '#fdfdfd', // Ensure background isn't transparent
      });

      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `SilentScript_${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error saving image", err);
      alert("Gagal menyimpan gambar.");
    }
  }

  // Clear text function
  const clearText = () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus semua catatan ini?")) {
      setText("");
      setInterimText("");
    }
  }

  const displayText = text + (interimText ? (text ? " " : "") + interimText : "");

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon-wrapper">
            <Feather className="logo-icon" size={28} />
          </div>
          <h1 className="logo-text">Bagas Journal</h1>
        </div>
        <div className="app-subtitle">Powered by Silent Script</div>
      </header>

      {showInstallBanner && (
        <div className="install-banner">
          <div className="install-banner-content">
            <Download size={20} />
            <span>Install <strong>Bagas Journal</strong> di HP Anda!</span>
          </div>
          <div className="install-banner-actions">
            <button className="install-btn" onClick={handleInstallClick}>Install</button>
            <button className="dismiss-btn" onClick={dismissInstallBanner}><X size={16} /></button>
          </div>
        </div>
      )}

      <div className="notebook animate-fade-in" id="notebook-canvas">
        <div className="date-header">
          Date: {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        <div className="handwriting-text">
          {displayText ? (
            displayText
          ) : (
            <span className="empty-state">Mulai bicara untuk menulis di jurnal Anda...</span>
          )}
        </div>
      </div>

      <div className={`refiner-status ${isRefining ? 'visible' : ''}`}>
        <div className="spinner"></div>
        <span>AI sedang merapikan teks...</span>
      </div>

      <button
        className={`fab ${isRecording ? 'recording' : ''}`}
        onClick={toggleRecording}
        title={isRecording ? "Stop Recording" : "Start Recording"}
        style={{ zIndex: 11 }}
      >
        {isRecording ? <MicOff size={28} /> : <Mic size={28} />}
      </button>

      <button
        className="fab save-fab"
        onClick={saveImage}
        style={{
          bottom: '7rem',
          backgroundColor: '#10b981',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
        }}
        title="Simpan sebagai Gambar"
      >
        <Save size={24} />
      </button>

      <button
        className="fab clear-fab"
        onClick={clearText}
        style={{
          bottom: '12rem',
          backgroundColor: '#ef4444',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
        }}
        title="Hapus Catatan"
      >
        <Trash2 size={24} />
      </button>
    </div>
  )
}

export default App
