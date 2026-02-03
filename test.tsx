import puter from '@heyputer/puter.js'
import { useState } from 'react'

type ChatTurn = {
  user: string
  ai: string
}

const extractText = (response: unknown): string => {
  // Extrait rapidement le texte sans traitement lourd
  if (!response || typeof response !== 'object') return 'No response received.'
  const maybe = response as { message?: { content?: unknown } }
  const content = maybe.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const first = content.find(part => typeof part === 'string')
    if (typeof first === 'string') return first
  }
  return JSON.stringify(content ?? response, null, 2)
}

export const AIExample = () => {
  // États de gestion du chat
  const [input, setInput] = useState<string>('What can you do?')
  const [status, setStatus] = useState<string>('Idle')
  const [history, setHistory] = useState<ChatTurn[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)

  // Pour accélérer la réponse :
  // 1. Afficher le message utilisateur IMMÉDIATEMENT (ne pas attendre l'API)
  // 2. Utiliser un état de chargement "Loading..." dans le chat
  // 3. Remplacer par la vraie réponse une fois reçue
  const sendChat = async () => {
    if (!input.trim()) return
    
    // OPTIMISATION: Ajouter le message utilisateur tout de suite
    const userMessage = input.trim()
    setHistory(prev => [...prev, { user: userMessage, ai: 'Loading...' }])
    setInput('') // Réinitialiser l'input immédiatement
    setIsLoading(true)
    setStatus('Sending to Puter AI...')
    
    try {
      const response = await puter.ai.chat(userMessage)
      const text = extractText(response)
      // OPTIMISATION: Mettre à jour seulement le dernier message avec la réponse réelle
      setHistory(prev => {
        const updated = [...prev]
        updated[updated.length - 1].ai = text
        return updated
      })
      setStatus('Reply received')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // OPTIMISATION: Afficher l'erreur dans le chat
      setHistory(prev => {
        const updated = [...prev]
        updated[updated.length - 1].ai = `Error: ${message}`
        return updated
      })
      setStatus(`Error: ${message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="card stack">
      <div className="stack">
        <h2>Puter AI Chat</h2>
        <p>Send a short prompt to <code>puter.ai.chat</code> and see the reply.</p>
      </div>

      <div className="chat-box">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          rows={3}
          placeholder="Ask Puter AI anything..."
        />
        <div className="actions">
          <button onClick={sendChat} disabled={isLoading || !input.trim()}>
            {isLoading ? 'Sending...' : 'Send message'}
          </button>
          <span className="status">Status: {status}</span>
        </div>
      </div>

      {history.length > 0 ? (
        <div className="callout">
          <strong>Conversation</strong>
          <div className="chat-history">
            {history.map((turn, idx) => (
              <div key={idx} className="chat-turn">
                <div className="chat-label">You</div>
                <div className="chat-bubble">{turn.user}</div>
                <div className="chat-label">Puter AI</div>
                <div className="chat-bubble alt">{turn.ai}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
