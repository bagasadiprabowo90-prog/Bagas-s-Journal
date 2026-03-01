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

      // Background — warm aged paper
      ctx.fillStyle = '#ede8d8';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Paper fiber/grain texture
      for (let i = 0; i < canvasWidth * canvasHeight * 0.06; i++) {
        const x = Math.random() * canvasWidth;
        const y = Math.random() * canvasHeight;
        const size = Math.random() * 1.5 + 0.5;
        const alpha = Math.random() * 0.06;
        const shade = Math.floor(Math.random() * 60 + 140);
        ctx.fillStyle = `rgba(${shade},${shade - 20},${shade - 40},${alpha})`;
        ctx.fillRect(x, y, size, 0.5);
      }

      // Subtle coffee/age stain spots
      for (let i = 0; i < 3; i++) {
        const sx = Math.random() * canvasWidth;
        const sy = Math.random() * canvasHeight;
        const sr = 30 + Math.random() * 50;
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
        grad.addColorStop(0, 'rgba(180, 155, 110, 0.04)');
        grad.addColorStop(1, 'rgba(180, 155, 110, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
      }

      // Wave function per line — simulates paper not being flat
      const waveAtX = (x, lineIndex) => {
        return Math.sin(x * 0.015 + lineIndex * 1.7) * 1.5 +
          Math.sin(x * 0.04 + lineIndex * 0.8) * 0.8;
      };

      // Draw horizontal lines — wavy like real paper
      for (let lineIdx = 1; lineIdx * LINE_H < canvasHeight; lineIdx++) {
        const baseY = lineIdx * LINE_H;
        const alpha = 0.35 + Math.random() * 0.15;
        ctx.strokeStyle = `rgba(140, 175, 210, ${alpha})`;
        ctx.lineWidth = 0.7 + Math.random() * 0.3;
        ctx.beginPath();
        for (let x = 0; x <= canvasWidth; x += 2) {
          const wy = baseY + waveAtX(x, lineIdx);
          if (x === 0) ctx.moveTo(x, wy);
          else ctx.lineTo(x, wy);
        }
        ctx.stroke();
      }

      // Draw margin line — slightly wavy
      ctx.strokeStyle = 'rgba(200, 140, 140, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let y = 0; y <= canvasHeight; y += 2) {
        const wx = MARGIN_LEFT + Math.sin(y * 0.02) * 0.5;
        if (y === 0) ctx.moveTo(wx, y);
        else ctx.lineTo(wx, y);
      }
      ctx.stroke();

      // --- Realistic pen rendering: char by char with ink bleed ---
      const drawPenChar = (char, x, y, fontSize, inkR, inkG, inkB) => {
        // Jitter per character
        const sz = fontSize + (Math.random() - 0.5) * 3;
        const yOff = (Math.random() - 0.5) * 2.5;
        const rot = (Math.random() - 0.5) * 0.06;
        const pressure = 0.7 + Math.random() * 0.3;

        ctx.save();
        ctx.translate(x, y + yOff);
        ctx.rotate(rot);
        ctx.font = `500 ${sz}px Caveat, cursive`;

        // Ink bleed layer (shadow behind text)
        ctx.fillStyle = `rgba(${inkR},${inkG},${inkB},${pressure * 0.15})`;
        ctx.fillText(char, 0.5, 0.5);
        ctx.fillText(char, -0.3, 0.3);

        // Main ink stroke
        ctx.fillStyle = `rgba(${inkR},${inkG},${inkB},${pressure})`;
        ctx.fillText(char, 0, 0);

        // Slight double-pass for ink density variation
        if (Math.random() > 0.6) {
          ctx.fillStyle = `rgba(${inkR},${inkG},${inkB},${pressure * 0.2})`;
          ctx.fillText(char, 0.2, -0.2);
        }

        const w = ctx.measureText(char).width;
        ctx.restore();
        return w;
      };

      const drawPenLine = (str, startX, lineBaseY, lineIndex, fontSize, r, g, b) => {
        let cx = startX;
        for (let i = 0; i < str.length; i++) {
          const char = str[i];
          const wave = waveAtX(cx, lineIndex);
          const w = drawPenChar(char, cx, lineBaseY + wave, fontSize, r, g, b);
          cx += w + (Math.random() - 0.5) * 1.2;
        }
      };

      // Draw Date header
      drawPenLine(dateStr, TEXT_LEFT, LINE_H - 4, 0, 24, 40, 80, 160);

      // Draw text lines
      textLines.forEach((line, i) => {
        const lineIndex = i + 3;
        const y = lineIndex * LINE_H - 4;
        drawPenLine(line, TEXT_LEFT, y, lineIndex, 24, 25, 25, 30);
      });

      // Camera vignette effect (darker corners like phone photo)
      const vigGrad = ctx.createRadialGradient(
        canvasWidth / 2, canvasHeight / 2, canvasHeight * 0.3,
        canvasWidth / 2, canvasHeight / 2, canvasHeight * 0.8
      );
      vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vigGrad.addColorStop(1, 'rgba(0,0,0,0.12)');
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Slight warm color overlay (camera white balance)
      ctx.fillStyle = 'rgba(255, 248, 230, 0.08)';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

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
