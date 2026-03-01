import { useState } from 'react'
import { Moon, Send, Loader2, Sparkles } from 'lucide-react'
import './DreamInterpreter.css'

function DreamInterpreter() {
    const [dreamText, setDreamText] = useState('')
    const [result, setResult] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const analyzeDream = async () => {
        if (!dreamText.trim()) {
            setError('Silakan masukkan deskripsi mimpi Anda terlebih dahulu.')
            return
        }

        setIsLoading(true)
        setError('')
        setResult('')

        try {
            const response = await fetch('/api/tafsir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dream: dreamText.trim() })
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error || 'Terjadi kesalahan.')
                return
            }

            setResult(data.result)
        } catch (err) {
            console.error(err)
            setError('Gagal menghubungi server. Periksa koneksi internet Anda.')
        } finally {
            setIsLoading(false)
        }
    }

    // Simple markdown-like formatting
    const formatResult = (text) => {
        return text
            .split('\n')
            .map((line, i) => {
                // Headers with emoji
                if (line.startsWith('🌙') || line.startsWith('🧠') || line.startsWith('💡')) {
                    return <h3 key={i} className="tafsir-heading">{line}</h3>
                }
                // Bold text
                if (line.includes('**')) {
                    const parts = line.split(/\*\*(.*?)\*\*/g)
                    return (
                        <p key={i}>
                            {parts.map((part, j) =>
                                j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                            )}
                        </p>
                    )
                }
                // Empty line
                if (line.trim() === '') return <br key={i} />
                // Normal text
                return <p key={i}>{line}</p>
            })
    }

    return (
        <div className="dream-container">
            <div className="dream-header">
                <Moon size={24} className="dream-icon" />
                <h2>Tafsir Mimpi</h2>
                <p className="dream-subtitle">
                    Analisis mimpi Anda dari sudut pandang Ibnu Sirin & Ibnu Sina
                </p>
            </div>

            <div className="dream-input-area">
                <textarea
                    className="dream-textarea"
                    value={dreamText}
                    onChange={(e) => setDreamText(e.target.value)}
                    placeholder="Ceritakan mimpi Anda di sini... Contoh: Saya bermimpi terbang di atas lautan yang sangat luas, lalu melihat bulan purnama yang sangat besar di hadapan saya..."
                    rows={5}
                    disabled={isLoading}
                />
                <button
                    className="dream-submit-btn"
                    onClick={analyzeDream}
                    disabled={isLoading || !dreamText.trim()}
                >
                    {isLoading ? (
                        <>
                            <Loader2 size={18} className="spin-icon" />
                            Sedang Menafsirkan...
                        </>
                    ) : (
                        <>
                            <Sparkles size={18} />
                            Tafsirkan Mimpi
                        </>
                    )}
                </button>
            </div>

            {error && (
                <div className="dream-error">
                    {error}
                </div>
            )}

            {result && (
                <div className="dream-result animate-fade-in">
                    <div className="result-content">
                        {formatResult(result)}
                    </div>
                </div>
            )}
        </div>
    )
}

export default DreamInterpreter
