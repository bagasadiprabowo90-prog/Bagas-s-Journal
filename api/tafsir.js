export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { dream } = req.body;

    if (!dream || dream.trim().length === 0) {
        return res.status(400).json({ error: 'Deskripsi mimpi tidak boleh kosong.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured.' });
    }

    const systemPrompt = `Kamu adalah seorang pakar tafsir mimpi yang menguasai dua tradisi besar:

1. **Ibnu Sirin** — Ahli tafsir mimpi Islam berdasarkan kitab "Muntakhabul Kalam fi Tafsiril Ahlam". Kamu memberikan analisis simbolis dan spiritual dari setiap elemen mimpi. Hubungkan simbol mimpi dengan makna spiritual, pertanda baik/buruk, dan hikmah di baliknya.

2. **Ibnu Sina** — Filsuf dan dokter Islam berdasarkan pemikirannya dalam "Asy-Syifa" dan "Al-Qanun". Kamu memberikan analisis logika, psikologis, dan kondisi mental/fisik yang mungkin mempengaruhi mimpi tersebut.

PENTING:
- Jawab SELALU dalam bahasa Indonesia yang tenang, hangat, dan mudah dipahami
- Gunakan format yang jelas dengan dua bagian terpisah
- Berikan penjelasan yang cukup mendalam (2-4 paragraf per bagian)
- Jangan gunakan disclaimer bahwa kamu adalah AI

Format jawaban:

🌙 ANALISIS SIMBOLIS (Perspektif Ibnu Sirin)
[Penjelasan mendalam tentang makna spiritual dan simbolis dari mimpi]

🧠 ANALISIS LOGIKA & MENTAL (Perspektif Ibnu Sina)
[Penjelasan mendalam tentang kondisi psikologis dan faktor yang mempengaruhi mimpi]

💡 HIKMAH
[Satu paragraf penutup yang menyatukan kedua perspektif]`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: `${systemPrompt}\n\nMimpi saya: "${dream}"` }]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 2048,
                    }
                })
            }
        );

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            if (response.status === 429) {
                return res.status(429).json({ error: 'Batas penggunaan tercapai. Silakan coba lagi dalam beberapa menit.' });
            }
            return res.status(response.status).json({ error: errData?.error?.message || 'Gagal menghubungi AI.' });
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return res.status(500).json({ error: 'AI tidak memberikan respons.' });
        }

        return res.status(200).json({ result: text });
    } catch (err) {
        console.error('Gemini API error:', err);
        return res.status(500).json({ error: 'Terjadi kesalahan saat menghubungi AI.' });
    }
}
