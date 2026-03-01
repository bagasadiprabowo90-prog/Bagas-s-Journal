import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Save } from 'lucide-react'
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

  // Auto-save effect
  useEffect(() => {
    const saved = localStorage.getItem('silent_script_note');
    if (saved) setText(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('silent_script_note', text);
  }, [text]);

  // Init Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'id-ID';

      recognition.onresult = (event) => {
        let finalTranscripts = '';
        let interimTranscripts = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscripts += transcript + ' ';
          } else {
            interimTranscripts += transcript;
          }
        }

        setInterimText(interimTranscripts);
        if (finalTranscripts) {
          processAI(finalTranscripts);
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        setInterimText("");
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("Speech recognition not supported in this browser.");
    }

    return () => {
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
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error(e);
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

  const displayText = text + (interimText ? (text ? " " : "") + interimText : "");

  return (
    <div className="app-container">
      <div className="notebook" id="notebook-canvas">
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
    </div>
  )
}

export default App
