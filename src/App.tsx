import { useEffect, useRef, useState } from "react"

declare global {
  interface Window {
    puter?: any
  }
}

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

type ChatSession = {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
}

/**
 * Extraction du texte depuis la réponse Puter
 */
const extractText = (res: any): string => {
  if (!res) return "Réponse vide."
  
  // Essayer le chemin le plus probable
  if (res.message && res.message.content) {
    return res.message.content
  }
  
  // Fallback
  if (typeof res === "string") return res
  if (res.response) return res.response
  if (res.result) return res.result
  
  try {
    return JSON.stringify(res)
  } catch {
    return "Réponse dans un format non reconnu"
  }
}

const App: React.FC = () => {
  const sdk = window.puter
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // États
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('chatSessions')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return parsed.map((session: any) => ({
          ...session,
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(session.updatedAt),
          messages: session.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }))
      } catch {
        // En cas d'erreur, on crée une session par défaut
      }
    }
    // Session par défaut
    const defaultSession: ChatSession = {
      id: '1',
      title: 'Nouvelle conversation',
      messages: [
        { 
          id: '1',
          role: "assistant", 
          content: "👋 Salut ! Je suis votre assistant IA. Posez-moi n'importe quelle question et je ferai de mon mieux pour vous aider !",
          timestamp: new Date()
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    }
    return [defaultSession]
  })

  const [currentSessionId, setCurrentSessionId] = useState<string>('1')
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Récupérer la session courante
  const currentSession = sessions.find(s => s.id === currentSessionId)
  const messages = currentSession?.messages || []

  // Sauvegarder les sessions dans localStorage
  useEffect(() => {
    localStorage.setItem('chatSessions', JSON.stringify(sessions))
  }, [sessions])

  // Vérifier la connexion Puter
  useEffect(() => {
    if (sdk?.ai?.chat) {
      setIsConnected(true)
      console.log("✅ Puter AI est connecté")
    }
  }, [sdk])

  // Scroll auto vers le dernier message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  // Auto-resize du textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px'
    }
  }, [inputValue])

  // Créer une nouvelle session
  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'Nouvelle conversation',
      messages: [
        { 
          id: '1',
          role: "assistant", 
          content: "👋 Salut ! Je suis votre assistant IA. Posez-moi n'importe quelle question et je ferai de mon mieux pour vous aider !",
          timestamp: new Date()
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    setSessions(prev => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
    setSidebarOpen(true)
  }

  // Supprimer une session
  const deleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (sessions.length <= 1) {
      alert("Vous devez garder au moins une conversation.")
      return
    }
    
    if (confirm("Voulez-vous vraiment supprimer cette conversation ?")) {
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      
      // Si on supprime la session courante, on bascule sur la première disponible
      if (sessionId === currentSessionId) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId)
        if (remainingSessions.length > 0) {
          setCurrentSessionId(remainingSessions[0].id)
        }
      }
    }
  }

  // Mettre à jour le titre de la session (basé sur le premier message)
  const updateSessionTitle = (sessionId: string, firstMessage: string) => {
    const newTitle = firstMessage.length > 30 
      ? firstMessage.substring(0, 30) + '...' 
      : firstMessage
    
    setSessions(prev => prev.map(session => {
      if (session.id === sessionId) {
        return { ...session, title: newTitle, updatedAt: new Date() }
      }
      return session
    }))
  }

  // Envoyer un message
  const sendMessage = async () => {
    const text = inputValue.trim()
    if (!text || isLoading) return

    // Ajouter le message utilisateur
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date()
    }
    
    // Mettre à jour les messages
    setSessions(prev => prev.map(session => {
      if (session.id === currentSessionId) {
        const newMessages = [...session.messages, userMessage]
        // Mettre à jour le titre si c'est le premier message utilisateur
        if (session.messages.length === 1) { // Seulement le message de bienvenue
          updateSessionTitle(session.id, text)
        }
        return { 
          ...session, 
          messages: newMessages,
          updatedAt: new Date()
        }
      }
      return session
    }))
    
    setInputValue("")
    setIsLoading(true)

    try {
      let reply = ""

      if (sdk?.ai?.chat) {
        const res = await sdk.ai.chat(text)
        console.log("📥 Réponse Puter:", res)
        reply = extractText(res)
      } else {
        // Fallback local pour le développement
        await new Promise(r => setTimeout(r, 800))
        reply = `C'est une réponse simulée pour : "${text}". Activez Puter SDK pour une vraie réponse IA.`
      }

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: reply,
        timestamp: new Date()
      }
      
      // Ajouter la réponse de l'IA
      setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          return { 
            ...session, 
            messages: [...session.messages, aiMessage],
            updatedAt: new Date()
          }
        }
        return session
      }))
    } catch (err) {
      console.error("❌ Erreur:", err)
      
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: `❌ Désolé, une erreur s'est produite: ${err instanceof Error ? err.message : 'Erreur inconnue'}`,
        timestamp: new Date()
      }
      
      setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          return { 
            ...session, 
            messages: [...session.messages, errorMessage],
            updatedAt: new Date()
          }
        }
        return session
      }))
    } finally {
      setIsLoading(false)
    }
  }

  // Copier le texte
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // Vous pourriez ajouter une notification toast ici
      console.log("✅ Texte copié")
    } catch (err) {
      console.error('Erreur lors de la copie:', err)
    }
  }

  // Effacer la conversation courante
  const clearCurrentChat = () => {
    if (confirm("Voulez-vous vraiment effacer cette conversation ?")) {
      setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            title: 'Nouvelle conversation',
            messages: [{
              id: '1',
              role: "assistant", 
              content: "👋 Conversation réinitialisée. Posez-moi une nouvelle question !",
              timestamp: new Date()
            }],
            updatedAt: new Date()
          }
        }
        return session
      }))
    }
  }

  // Effacer toutes les conversations
  const clearAllChats = () => {
    if (confirm("Voulez-vous vraiment effacer TOUTES les conversations ? Cette action est irréversible.")) {
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: 'Nouvelle conversation',
        messages: [
          { 
            id: '1',
            role: "assistant", 
            content: "👋 Toutes les conversations ont été effacées. Posez-moi une nouvelle question !",
            timestamp: new Date()
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      }
      setSessions([newSession])
      setCurrentSessionId(newSession.id)
    }
  }

  // Gestion des touches
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Formater la date
  const formatDate = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'À l\'instant'
    if (diffMins < 60) return `Il y a ${diffMins} min`
    if (diffHours < 24) return `Il y a ${diffHours} h`
    if (diffDays < 7) return `Il y a ${diffDays} j`
    
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    })
  }

  // Trier les sessions par date (la plus récente en premier)
  const sortedSessions = [...sessions].sort((a, b) => 
    b.updatedAt.getTime() - a.updatedAt.getTime()
  )

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      {/* Sidebar - Historique des conversations */}
      <div 
        ref={sidebarRef}
        className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 flex-shrink-0 overflow-hidden border-r border-gray-700 bg-gray-900/80 backdrop-blur-lg flex flex-col`}
      >
        {/* En-tête de la sidebar */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Conversations</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 hover:bg-gray-800 rounded"
            >
              <span>←</span>
            </button>
          </div>
          
          <button
            onClick={createNewSession}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg font-medium flex items-center justify-center gap-2"
          >
            <span>+</span>
            Nouvelle conversation
          </button>
        </div>

        {/* Liste des conversations */}
        <div className="flex-1 overflow-y-auto">
          {sortedSessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setCurrentSessionId(session.id)}
              className={`p-4 border-b border-gray-700 cursor-pointer hover:bg-gray-800/50 transition-colors ${
                currentSessionId === session.id ? 'bg-gray-800' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{session.title}</h3>
                  {session.messages.length > 1 && (
                    <p className="text-sm text-gray-400 truncate mt-1">
                      {session.messages[session.messages.length - 2]?.content}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    {formatDate(session.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => deleteSession(session.id, e)}
                  className="ml-2 p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
                  title="Supprimer"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pied de la sidebar */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-amber-500'}`} />
            <span>{isConnected ? "Puter AI connecté" : "Mode développement"}</span>
          </div>
          <button
            onClick={clearAllChats}
            className="w-full py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg"
          >
            Effacer tout l'historique
          </button>
        </div>
      </div>

      {/* Zone de chat principale */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-gray-900/90 backdrop-blur-lg border-b border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 hover:bg-gray-800 rounded"
                  title="Ouvrir l'historique"
                >
                  <span>☰</span>
                </button>
              )}
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                  <span className="text-lg">✨</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    {currentSession?.title || 'AI Assistant'}
                  </h1>
                  <p className="text-sm text-gray-400">
                    {messages.length} message{messages.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={clearCurrentChat}
                className="px-4 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <span>🗑️</span>
                Effacer
              </button>
            </div>
          </div>
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-4 ${message.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  message.role === "user" 
                    ? "bg-gradient-to-br from-blue-600 to-blue-500" 
                    : "bg-gradient-to-br from-purple-600 to-purple-500"
                }`}>
                  {message.role === "user" ? (
                    <span className="text-sm">👤</span>
                  ) : (
                    <span className="text-sm">🤖</span>
                  )}
                </div>

                {/* Message Bubble */}
                <div className={`flex-1 ${message.role === "user" ? "items-end" : ""}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {message.role === "user" ? "Vous" : "Assistant IA"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  <div className={`relative group rounded-2xl px-5 py-4 max-w-xl ${
                    message.role === "user"
                      ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-br-none"
                      : "bg-gray-800/70 border border-gray-700 rounded-bl-none"
                  }`}>
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </div>
                    
                    {/* Actions */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => copyToClipboard(message.content)}
                        className="p-2 rounded-lg bg-gray-900/50 hover:bg-gray-800 transition-colors"
                        title="Copier le message"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Indicateur de chargement */}
            {isLoading && (
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-purple-500">
                  <span className="text-sm">🤖</span>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm mb-1">Assistant IA</div>
                  <div className="bg-gray-800/70 border border-gray-700 rounded-2xl rounded-bl-none px-5 py-4 max-w-xl inline-flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    <span className="text-gray-300">Réflexion en cours...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Zone de saisie */}
        <footer className="sticky bottom-0 bg-gray-900/90 backdrop-blur-lg border-t border-gray-700 px-4 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isConnected ? "Posez votre question..." : "Mode développement - Activez Puter SDK"}
                rows={1}
                className="flex-1 px-5 py-4 bg-gray-800 border border-gray-700 rounded-2xl placeholder-gray-500 text-gray-100 resize-none outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                disabled={isLoading}
              />
              
              <button
                onClick={sendMessage}
                disabled={isLoading || !inputValue.trim()}
                className="self-end px-6 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 font-medium"
              >
                {isLoading ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <>
                    <span>➤</span>
                    <span className="hidden sm:inline">Envoyer</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="mt-3 text-center">
              <p className="text-xs text-gray-500">
                {isConnected 
                  ? "Appuyez sur Entrée pour envoyer, Shift+Entrée pour un saut de ligne" 
                  : "⚠️ Pour utiliser l'IA réelle, configurez Puter SDK dans votre projet"
                }
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default App