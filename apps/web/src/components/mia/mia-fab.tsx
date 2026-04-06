"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Bot, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";

interface ChatMessage {
  id: string;
  role: "user" | "mia";
  content: string;
  timestamp: Date;
  action?: "confirm_create" | "confirm_cancel" | "confirm_block";
  actionData?: Record<string, unknown>;
}

interface MiaApiResponse {
  response: string;
  action?: "confirm_create" | "confirm_cancel" | "confirm_block";
  actionData?: Record<string, unknown>;
}

export function MiaFab() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    action: string;
    data: Record<string, unknown>;
  } | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  const { user } = useSession();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll automático al final
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Inicializar con mensaje de bienvenida cuando se abre
  useEffect(() => {
    if (open && !hasInitialized && user?.full_name) {
      const firstName = user.full_name.split(" ")[0];
      const welcomeMessage: ChatMessage = {
        id: `mia-welcome-${Date.now()}`,
        role: "mia",
        content: `¡Hola ${firstName}! Soy MIA, tu asistente inteligente.\n\nPuedo ayudarte a gestionar turnos, bloquear horarios y consultar tu agenda. ¿En qué te puedo ayudar?`,
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
      setHasInitialized(true);
    }
  }, [open, hasInitialized, user?.full_name]);

  // Solo mostrar para profesionales
  if (!user || user.role !== "professional") return null;

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    // Agregar mensaje del usuario
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/mia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          context: pendingAction
            ? {
                pendingAction: pendingAction.action,
                pendingData: pendingAction.data,
              }
            : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al comunicarse con MIA");
      }

      const data = (await response.json()) as MiaApiResponse;

      const miaMessage: ChatMessage = {
        id: `mia-${Date.now()}`,
        role: "mia",
        content: data.response,
        timestamp: new Date(),
        action: data.action as
          | "confirm_create"
          | "confirm_cancel"
          | "confirm_block"
          | undefined,
        actionData: data.actionData,
      };

      setMessages((prev) => [...prev, miaMessage]);

      // Si MIA responde con una acción, guardar como pendiente
      if (data.action && data.actionData) {
        setPendingAction({
          action: data.action,
          data: data.actionData,
        });
      } else {
        // Si no hay acción, limpiar pendiente
        setPendingAction(null);
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "mia",
        content:
          "Disculpa, tuve un problema. Por favor intentá de nuevo en un momento.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      console.error("Error en chat MIA:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (confirmed: boolean) => {
    if (!pendingAction) return;

    const confirmMessage = confirmed ? "sí" : "no";

    // Agregar mensaje de confirmación del usuario
    const userMessage: ChatMessage = {
      id: `user-confirm-${Date.now()}`,
      role: "user",
      content: confirmMessage === "sí" ? "✓ Confirmo" : "✗ Cancelar",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setPendingAction(null);

    try {
      const response = await fetch("/api/mia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: confirmMessage,
          context: {
            pendingAction: pendingAction.action,
            pendingData: pendingAction.data,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Error al procesar confirmación");
      }

      const data = (await response.json()) as MiaApiResponse;

      const miaMessage: ChatMessage = {
        id: `mia-${Date.now()}`,
        role: "mia",
        content: data.response,
        timestamp: new Date(),
        action: data.action as
          | "confirm_create"
          | "confirm_cancel"
          | "confirm_block"
          | undefined,
        actionData: data.actionData,
      };

      setMessages((prev) => [...prev, miaMessage]);

      // Procesar nueva acción si la hay
      if (data.action && data.actionData) {
        setPendingAction({
          action: data.action,
          data: data.actionData,
        });
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "mia",
        content: "Hubo un error al procesar tu confirmación. Intentá de nuevo.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      console.error("Error en confirmación:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Chat panel */}
      <div
        className={cn(
          "fixed bottom-20 right-6 z-50 w-96 h-[500px] rounded-xl border bg-card shadow-2xl flex flex-col overflow-hidden transition-all duration-300 max-lg:right-4 max-lg:w-[calc(100%-2rem)]",
          open
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-bookme-navy to-bookme-navy/80 dark:from-bookme-mint/20 dark:to-bookme-mint/10">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">MIA</p>
              <p className="text-xs text-white/70">Asistente inteligente</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-full p-1 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages area */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-background"
        >
          {messages.map((message) => (
            <div key={message.id}>
              {message.role === "mia" ? (
                <div className="flex gap-2 mb-2">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="rounded-lg bg-muted px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div className="flex justify-end gap-2 mb-2">
                  <div className="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap">
                    {message.content}
                  </div>
                </div>
              )}

              {/* Confirmation buttons */}
              {message.role === "mia" && message.action && pendingAction && (
                <div className="flex gap-2 justify-start mb-3 ml-9">
                  <button
                    onClick={() => handleConfirmAction(true)}
                    disabled={loading}
                    className="rounded-lg bg-green-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => handleConfirmAction(false)}
                    disabled={loading}
                    className="rounded-lg border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-2">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              </div>
              <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-3 bg-card">
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Escribí tu consulta..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={loading}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSendMessage}
              disabled={loading || !input.trim()}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            MIA puede gestionar turnos con tu confirmación
          </p>
        </div>
      </div>

      {/* FAB button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full shadow-lg transition-all duration-200 max-lg:right-4",
          open
            ? "bg-muted text-muted-foreground px-4 py-3 hover:bg-muted/80"
            : "bg-primary text-primary-foreground px-5 py-3.5 hover:bg-primary/90 hover:scale-105"
        )}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <>
            <MessageCircle className="h-5 w-5" />
            <span className="text-sm font-medium">MIA</span>
          </>
        )}
      </button>
    </>
  );
}
