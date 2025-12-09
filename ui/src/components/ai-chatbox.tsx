
import {
    PromptInput,
    PromptInputTextarea,
    PromptInputToolbar,
    PromptInputTools,
    PromptInputButton,
    PromptInputSubmit,
    PromptInputModelSelect,
    PromptInputModelSelectTrigger,
    PromptInputModelSelectContent,
    PromptInputModelSelectItem,
    PromptInputModelSelectValue,
  } from "@/components/ui/shadcn-io/ai/prompt-input";
  import {
    Conversation,
    ConversationContent,
  } from "@/components/ui/shadcn-io/ai/conversation";
  import { Message, MessageContent } from "@/components/ui/shadcn-io/ai/message";
  import { useChat } from "@ai-sdk/react";
  import { DefaultChatTransport } from "ai";
  import { useState } from "react";
  import { MicIcon, PaperclipIcon } from "lucide-react";
  const models = [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
  ];

export function AiChatbox() {

    const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(models[0].id);
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { model: selectedModel },
    }),
  });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage({ text: input });
      setInput("");
    }
  };
  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <Conversation>
        <ConversationContent>
          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                {message.parts
                  .filter((part) => part.type === "text")
                  .map((part, index) => (
                    <span key={index}>{part.text}</span>
                  ))}
              </MessageContent>
            </Message>
          ))}
        </ConversationContent>
      </Conversation>
      <PromptInput onSubmit={handleSubmit}>
        <PromptInputTextarea
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          placeholder="Type your message..."
        />
        <PromptInputToolbar>
          <PromptInputTools>
            <PromptInputButton>
              <PaperclipIcon size={16} />
            </PromptInputButton>
            <PromptInputButton>
              <MicIcon size={16} />
              <span>Voice</span>
            </PromptInputButton>
            <PromptInputModelSelect
              value={selectedModel}
              onValueChange={setSelectedModel}
            >
              <PromptInputModelSelectTrigger>
                <PromptInputModelSelectValue />
              </PromptInputModelSelectTrigger>
              <PromptInputModelSelectContent>
                {models.map((model) => (
                  <PromptInputModelSelectItem key={model.id} value={model.id}>
                    {model.name}
                  </PromptInputModelSelectItem>
                ))}
              </PromptInputModelSelectContent>
            </PromptInputModelSelect>
          </PromptInputTools>
          <PromptInputSubmit disabled={!input.trim()} status={status} />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}