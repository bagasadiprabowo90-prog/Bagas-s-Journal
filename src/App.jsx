import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Save, Feather, Trash2, Download, X } from 'lucide-react'
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

  // Save to image function using native Canvas API
  const saveImage = async () => {
    if (!text.trim()) {
      alert("Belum ada catatan untuk disimpan.");
      return;
    }

    try {
      // Wait for font to load
      await document.fonts.ready;

      const LINE_H = 28;
      const MARGIN_LEFT = 50;
      const TEXT_LEFT = MARGIN_LEFT + 15;
      const PADDING_RIGHT = 20;
      const canvasWidth = 440;

      // Prepare text wrapping
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.font = '500 24px Caveat, cursive';

      // Word-wrap the text
      const wrapText = (ctx, str, maxWidth) => {
        const lines = [];
        const paragraphs = str.split('\n');
        for (const para of paragraphs) {
          const words = para.split(' ');
          let currentLine = '';
          for (const word of words) {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            if (ctx.measureText(testLine).width > maxWidth) {
              if (currentLine) lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          lines.push(currentLine);
        }
        return lines;
      };

      const maxTextWidth = canvasWidth - TEXT_LEFT - PADDING_RIGHT;
      const dateStr = 'Date: ' + new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
      const textLines = wrapText(tempCtx, text.trim(), maxTextWidth);

      // Calculate canvas height: date + gap + text lines + padding
      const totalLines = 2 + textLines.length + 2; // date + space + text + bottom padding
      const canvasHeight = totalLines * LINE_H;

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth * 2; // 2x for retina
      canvas.height = canvasHeight * 2;
      const ctx = canvas.getContext('2d');
      ctx.scale(2, 2);

      // Background — slightly warm paper color
      ctx.fillStyle = '#f5f0e8';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Add paper texture noise
      for (let i = 0; i < canvasWidth * canvasHeight * 0.03; i++) {
        const x = Math.random() * canvasWidth;
        const y = Math.random() * canvasHeight;
        const alpha = Math.random() * 0.04;
        ctx.fillStyle = `rgba(0,0,0,${alpha})`;
        ctx.fillRect(x, y, 1, 1);
      }

      // Draw horizontal lines (slightly imperfect like real paper)
      for (let y = LINE_H; y < canvasHeight; y += LINE_H) {
        ctx.strokeStyle = `rgba(160, 190, 215, ${0.5 + Math.random() * 0.15})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, y + (Math.random() - 0.5) * 0.3);
        ctx.lineTo(canvasWidth, y + (Math.random() - 0.5) * 0.3);
        ctx.stroke();
      }

      // Draw margin line
      ctx.strokeStyle = 'rgba(220, 160, 160, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(MARGIN_LEFT, 0);
      ctx.lineTo(MARGIN_LEFT, canvasHeight);
      ctx.stroke();

      // --- Character-by-character pen rendering function ---
      const drawPenText = (str, startX, baseY, baseFontSize, baseColor) => {
        let cursorX = startX;
        const chars = str.split('');

        for (let c = 0; c < chars.length; c++) {
          const char = chars[c];

          // Randomize for natural look
          const sizeJitter = baseFontSize + (Math.random() - 0.5) * 2;
          const yJitter = (Math.random() - 0.5) * 1.8;
          const rotJitter = (Math.random() - 0.5) * 0.04; // radians
          const opacity = 0.75 + Math.random() * 0.25;

          ctx.save();
          ctx.translate(cursorX, baseY + yJitter);
          ctx.rotate(rotJitter);
          ctx.font = `500 ${sizeJitter}px Caveat, cursive`;
          ctx.fillStyle = baseColor.replace(')', `,${opacity})`).replace('rgb', 'rgba');
          ctx.fillText(char, 0, 0);

          // Measure to advance cursor
          const charWidth = ctx.measureText(char).width;
          ctx.restore();

          cursorX += charWidth + (Math.random() - 0.5) * 0.8;
        }
      };

      // Draw Date header with pen effect
      const dateBaseY = LINE_H - 4;
      drawPenText(dateStr, TEXT_LEFT, dateBaseY, 24, 'rgb(50, 100, 180)');

      // Draw text lines with pen effect
      textLines.forEach((line, i) => {
        const y = (i + 3) * LINE_H - 4;
        drawPenText(line, TEXT_LEFT, y, 24, 'rgb(30, 30, 35)');
      });

      // Export
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `BagasJournal_${new Date().toISOString().split('T')[0]}.png`;
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
