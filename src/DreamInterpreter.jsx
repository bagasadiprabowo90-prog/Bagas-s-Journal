import { useState } from 'react'
import { Moon, Loader2, Sparkles, FileDown } from 'lucide-react'
import { jsPDF } from 'jspdf'
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

    const savePDF = () => {
        if (!result) return

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
        const pageWidth = doc.internal.pageSize.getWidth()
        const pageHeight = doc.internal.pageSize.getHeight()
        const margin = 20
        const maxWidth = pageWidth - margin * 2
        let y = margin

        const addNewPageIfNeeded = (extraSpace = 10) => {
            if (y + extraSpace > pageHeight - margin) {
                doc.addPage()
                y = margin
            }
        }

        // Title
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(18)
        doc.setTextColor(75, 29, 148) // Purple
        doc.text('Tafsir Mimpi', pageWidth / 2, y, { align: 'center' })
        y += 8

        // Subtitle
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(120, 120, 120)
        doc.text('Perspektif Ibnu Sirin & Ibnu Sina', pageWidth / 2, y, { align: 'center' })
        y += 6

        // Date
        const dateStr = new Date().toLocaleDateString('id-ID', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        })
        doc.text(dateStr, pageWidth / 2, y, { align: 'center' })
        y += 8

        // Divider line
        doc.setDrawColor(200, 200, 200)
        doc.setLineWidth(0.5)
        doc.line(margin, y, pageWidth - margin, y)
        y += 8

        // Dream text box
        doc.setFillColor(248, 245, 255) // Light purple bg
        doc.setDrawColor(180, 160, 220)
        const dreamLines = doc.splitTextToSize(`Mimpi: "${dreamText.trim()}"`, maxWidth - 10)
        const boxHeight = dreamLines.length * 5 + 8
        addNewPageIfNeeded(boxHeight + 5)
        doc.roundedRect(margin, y, maxWidth, boxHeight, 3, 3, 'FD')
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(10)
        doc.setTextColor(80, 60, 120)
        doc.text(dreamLines, margin + 5, y + 6)
        y += boxHeight + 10

        // Process result text
        const lines = result.split('\n')

        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) {
                y += 4
                continue
            }

            // Section headers (emoji lines)
            if (trimmed.startsWith('🌙') || trimmed.startsWith('🧠') || trimmed.startsWith('💡')) {
                addNewPageIfNeeded(15)
                y += 4
                // Header background
                doc.setFillColor(
                    trimmed.startsWith('🌙') ? 237 : trimmed.startsWith('🧠') ? 225 : 240,
                    trimmed.startsWith('🌙') ? 233 : trimmed.startsWith('🧠') ? 240 : 253,
                    trimmed.startsWith('🌙') ? 254 : trimmed.startsWith('🧠') ? 255 : 234
                )

                // Clean emoji from text for PDF (emoji don't render well)
                let headerText = trimmed
                    .replace('🌙 ', '')
                    .replace('🧠 ', '')
                    .replace('💡 ', '')

                const headerLines = doc.splitTextToSize(headerText, maxWidth - 10)
                const hBoxH = headerLines.length * 6 + 6
                doc.roundedRect(margin, y, maxWidth, hBoxH, 2, 2, 'F')

                doc.setFont('helvetica', 'bold')
                doc.setFontSize(11)
                doc.setTextColor(
                    trimmed.startsWith('🌙') ? 67 : trimmed.startsWith('🧠') ? 30 : 120,
                    trimmed.startsWith('🌙') ? 56 : trimmed.startsWith('🧠') ? 80 : 100,
                    trimmed.startsWith('🌙') ? 134 : trimmed.startsWith('🧠') ? 130 : 40
                )
                doc.text(headerLines, margin + 5, y + 5.5)
                y += hBoxH + 4
                continue
            }

            // Bold text handling
            addNewPageIfNeeded(8)
            const cleanLine = trimmed.replace(/\*\*/g, '')
            doc.setFont('helvetica', trimmed.includes('**') ? 'bold' : 'normal')
            doc.setFontSize(10)
            doc.setTextColor(50, 50, 50)
            const wrappedLines = doc.splitTextToSize(cleanLine, maxWidth)
            for (const wl of wrappedLines) {
                addNewPageIfNeeded(6)
                doc.text(wl, margin, y)
                y += 5
            }
            y += 1
        }

        // Footer on last page
        doc.setFontSize(8)
        doc.setTextColor(160, 160, 160)
        doc.text('Bagas Journal — Tafsir Mimpi AI', pageWidth / 2, pageHeight - 10, { align: 'center' })

        // Save
        const fileName = `TafsirMimpi_${new Date().toISOString().split('T')[0]}.pdf`
        doc.save(fileName)
    }

    // Simple markdown-like formatting
    const formatResult = (text) => {
        return text
            .split('\n')
            .map((line, i) => {
                if (line.startsWith('🌙') || line.startsWith('🧠') || line.startsWith('💡')) {
                    return <h3 key={i} className="tafsir-heading">{line}</h3>
                }
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
                if (line.trim() === '') return <br key={i} />
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
                    <div className="result-actions">
                        <button className="pdf-download-btn" onClick={savePDF}>
                            <FileDown size={16} />
                            Simpan PDF
                        </button>
                    </div>
                    <div className="result-content">
                        {formatResult(result)}
                    </div>
                </div>
            )}
        </div>
    )
}

export default DreamInterpreter
