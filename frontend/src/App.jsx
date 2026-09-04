import { useRef, useState } from 'react'
import './App.css'

const API_URL = 'http://127.0.0.1:8000/analyser'

function App() {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const inputRef = useRef(null)

  function selectFile(nextFile) {
    if (!nextFile) return
    if (nextFile.type !== 'application/pdf') {
      setError('Sélectionnez un fichier PDF.')
      return
    }
    setFile(nextFile)
    setResult(null)
    setError('')
  }

  function handleDrop(event) {
    event.preventDefault()
    selectFile(event.dataTransfer.files[0])
  }

  async function analyseFile() {
    if (!file) {
      setError('Ajoutez un PDF avant de lancer l’analyse.')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    setLoading(true)
    setError('')

    try {
      const response = await fetch(API_URL, { method: 'POST', body: formData })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'L’analyse a échoué.')
      setResult(data)
    } catch (requestError) {
      setError(requestError.message || 'Impossible de joindre le serveur.')
    } finally {
      setLoading(false)
    }
  }

  const fontFindings = Object.entries(result?.polices || {})
  const fontOccurrences = fontFindings.flatMap(([font, items]) => items
    .filter((item) => item.texte?.trim() && [...item.texte].some((character) => /[\p{L}\p{N}]/u.test(character)))
    .map((item) => ({ ...item, font })))
  const sizeFindings = (result?.tailles || []).filter((item) => item.texte?.trim() && [...item.texte].some((character) => /[\p{L}\p{N}]/u.test(character)))
  const pageFindings = result?.numerotationPage || []

  function renderZonePage(zonePage) {
    const match = zonePage?.match(/^(.*) de la (page \d+)$/)
    if (!match) return zonePage
    return <>{match[1]} de la <strong>{match[2]}</strong></>
  }

  function sendFeedback(event) {
    event.preventDefault()
    const subject = 'Appli Ronéo - ajout fonctionnalité ou problème à résoudre'
    const mailto = `mailto:clement.venooot@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(feedback)}`
    window.location.href = mailto
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <img className="brand-logo" src="/logo.jpeg" alt="Logo Contrôleur de ronéos" />
        <div>
          <p className="eyebrow">Contrôle documentaire</p>
          <h1>Analyse typographique</h1>
        </div>
        <span className="api-status"><i /> API connectée</span>
      </header>

      <main>
        <section className="intro">
          <div>
            <p className="eyebrow accent">RAPPORT DE CONFORMITÉ</p>
            <h2>Vérifiez vos ronéos<br />avant envoi.</h2>
          </div>
          <p className="intro-copy">Déposez un PDF pour contrôler ses polices, tailles, numéros de page et marges.</p>
        </section>
        <p className="disclaimer">Cette analyse est indicative : une vérification humaine reste nécessaire avant l’envoi pour confirmer les éventuelles erreurs à corriger.</p>

        <section className="upload-panel">
          <div
            className={`drop-zone ${file ? 'has-file' : ''}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex="0"
            onKeyDown={(event) => event.key === 'Enter' && inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept="application/pdf" onChange={(event) => selectFile(event.target.files[0])} />
            <span className="upload-icon">↑</span>
            <strong>{file ? file.name : 'Déposez votre PDF ici'}</strong>
            <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} Mo` : 'ou cliquez pour parcourir vos fichiers'}</span>
          </div>
          <button className="analyse-button" type="button" onClick={analyseFile} disabled={loading}>
            {loading ? 'Analyse en cours…' : 'Lancer l’analyse'} <span>→</span>
          </button>
          {error && <p className="error-message">{error}</p>}
        </section>

        {result && (
          <section className="results" aria-live="polite">
            <div className="results-heading">
              <div><p className="eyebrow accent">RÉSULTAT</p><h2>Vue d’ensemble</h2></div>
              <span className="filename">{file.name}</span>
            </div>
            <div className="summary-grid">
              <article className={`summary-card ${fontFindings.length ? 'warning' : 'valid'}`}><span className="card-label">POLICES</span><strong>{fontFindings.length ? 'À vérifier' : 'Conforme'}</strong><small>{fontFindings.length} famille(s) hors Calibri</small></article>
              <article className={`summary-card ${sizeFindings.length ? 'warning' : 'valid'}`}><span className="card-label">TAILLES</span><strong>{sizeFindings.length ? `${sizeFindings.length} écart(s)` : 'Conforme'}</strong><small>Plage attendue : 10.51–11.49 pt</small></article>
              <article className={`summary-card ${pageFindings.length ? 'warning' : 'valid'}`}><span className="card-label">NUMÉROTATION</span><strong>{pageFindings.length ? `${pageFindings.length} page(s)` : 'Conforme'}</strong><small>Numéros positionnés en bas</small></article>
              <article className={`summary-card ${result.marge ? 'valid' : 'warning'}`}><span className="card-label">MARGES</span><strong>{result.marge ? 'Conforme' : 'À vérifier'}</strong><small>2.5 cm avec tolérance de 20 %</small></article>
            </div>

            <div className="detail-grid">
              <article className="detail-panel scrollable-panel"><div className="panel-title"><h3>Polices détectées</h3><span>{fontOccurrences.length}</span></div>{fontOccurrences.length ? fontOccurrences.map((item, index) => <div className="finding finding-detail" key={`font-${item.num_page}-${index}`}><div className="finding-heading"><b>{item.nom_police || item.font}</b></div><div className="finding-expanded"><p>« {item.texte} »</p><small>{renderZonePage(item.zone_page)}</small></div></div>) : <p className="empty-state">Aucune police non conforme.</p>}</article>
              <article className="detail-panel scrollable-panel"><div className="panel-title"><h3>Tailles hors plage</h3><span>{sizeFindings.length}</span></div>{sizeFindings.length ? sizeFindings.map((item, index) => <div className="finding finding-detail" key={`size-${item.num_page}-${index}`}><div className="finding-heading"><b>{item.num_taille.toFixed(2)} pt</b></div><div className="finding-expanded"><p>« {item.texte} »</p><small>{renderZonePage(item.zone_page)}</small></div></div>) : <p className="empty-state">Toutes les tailles sont conformes.</p>}</article>
              <article className="detail-panel"><div className="panel-title"><h3>Pages sans numéro</h3><span>{pageFindings.length}</span></div>{pageFindings.length ? pageFindings.map((item) => <div className="finding" key={item.numPage}><b>Page {item.numPage}</b><span>Numéro absent en bas de page</span></div>) : <p className="empty-state">La numérotation est complète.</p>}</article>
            </div>
          </section>
        )}

        <section className="feedback-section">
          <div>
            <p className="eyebrow accent">UN RETOUR ?</p>
            <h2>Une idée ou un problème technique ?</h2>
            <p className="feedback-copy">Signalez un souci ou proposez une amélioration pour l’application.</p>
          </div>
          <form className="feedback-form" onSubmit={sendFeedback}>
            <label htmlFor="feedback">Votre message</label>
            <textarea
              id="feedback"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder="Décrivez le problème ou l’amélioration souhaitée..."
              required
              rows="5"
            />
            <button className="feedback-button" type="submit">Ouvrir mon email <span>→</span></button>
          </form>
        </section>
      </main>
      <footer>
        <span>© Clément Venot — All rights reserved</span>
        <a href="https://www.linkedin.com/in/clement-venot/" target="_blank" rel="noreferrer">LinkedIn</a>
      </footer>
    </div>
  )
}

export default App
