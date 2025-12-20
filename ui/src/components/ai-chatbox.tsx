import { generateText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
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
  import { Suggestions, Suggestion } from "@/components/ui/shadcn-io/ai/suggestion";
  import { useLatest } from "react-use";
  import {
    Task,
    TaskTrigger,
    TaskContent,
    TaskItem,
  } from "@/components/ui/shadcn-io/ai/task";
  import {
    Conversation,
    ConversationContent,
  } from "@/components/ui/shadcn-io/ai/conversation";
  import { Message, MessageContent } from "@/components/ui/shadcn-io/ai/message";
  import { useChat } from "@ai-sdk/react";
  import { DefaultChatTransport, type UIMessagePart, type UIDataTypes, type UITools } from "ai";
  import { useCallback, useState } from "react";
  import { MicIcon, PaperclipIcon } from "lucide-react";
import { Button } from "./ui/button";
import { useMediaMetadata } from "./media-metadata-provider";
import { generateMediaFileMetadatas, templates } from "@/lib/ai";
import { useConfig } from './config-provider';
import type { AI, MediaFileMatchResult, OpenAICompatibleConfig, TMDBTVShowDetails } from '@core/types';

  const models = [
    { id: "deepseek-chat", name: "DeepSeek Chat"},
  ];

function splitAtFirstMatch(str: string, delimiter: string) {
  const index = str.indexOf(delimiter)
  if(index === -1) {
      return [str, undefined]
  }
  return [str.slice(0, index), str.slice(index + 1)]
}

function parseMatchResult(response: string): MediaFileMatchResult[] {
  const lines = response.split("\n")
  const matches: MediaFileMatchResult[] = []
  for(const line of lines) {
      /**
       * S01E01:file1.mp4
       * S01E02:file2.mp4
       */
      const [seasonAndEpisode, filePath] = splitAtFirstMatch(line, ":")
      if(!seasonAndEpisode || !filePath) {
          continue
      }
      const [seasonPart, episodePart] = seasonAndEpisode.split("E")
      const seasonNumber = parseInt(seasonPart.replace('S', ''))
      const episodeNumber = parseInt(episodePart.replace('E', ''))
      matches.push({ path: filePath, seasonNumber: seasonNumber.toString(), episodeNumber: episodeNumber.toString() })
  }
  return matches
}

async function matchFilesToEpisodeByAI(config: OpenAICompatibleConfig, files: string[], tvShow: TMDBTVShowDetails): Promise<MediaFileMatchResult[]> {
  // Validate required config values
  if (!config.baseURL) {
    throw new Error('baseURL is required in OpenAICompatibleConfig');
  }
  if (!config.apiKey) {
    throw new Error('apiKey is required in OpenAICompatibleConfig');
  }
  if (!config.model) {
    throw new Error('model is required in OpenAICompatibleConfig');
  }

  // Create OpenAI-compatible provider from config
  const provider = createOpenAICompatible({
    name: 'Custom',
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });

  // Generate prompt
  const prompt = templates.matchFilesToEpisode(files, tvShow);

  // Generate text using the AI model
  const { text } = await generateText({
    model: provider(config.model),
    prompt: prompt,
  });

  return parseMatchResult(text)
}

function MessageItem(part: UIMessagePart<UIDataTypes, UITools>, index: number) {
  if(part.type === "dynamic-tool") {

    if(part.toolName === "matchFilesToEpisode") {

      if(part.state === "input-streaming") {
        return <Task key={index}>
          <TaskTrigger title={part.title || part.toolName} />
          <TaskContent>
            <TaskItem>正在读取电视剧信息</TaskItem>
            <TaskItem>正在读取本地文件信息</TaskItem>
          </TaskContent>
        </Task>;
      }

      if(part.state === "output-available") {
        return <Task key={index}>
          <TaskTrigger title={`${part.title || part.toolName} - 匹配完成`} />
          <TaskContent>
            <TaskItem></TaskItem>
          </TaskContent>
        </Task>;
      }

    }

  }

  if(part.type === "text") {
    return <span key={index}>{part.text}</span>;
  }

  console.error("Unknown message part type", part);
  return <></>
}

export function AiChatbox() {

  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(models[0].id); // Default to DeepSeek
  const { userConfig } = useConfig();
  const  {selectedMediaMetadata, updateMediaMetadata} = useMediaMetadata();
  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { model: selectedModel },
    }),
    
  });

  const latestMessages = useLatest(messages);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage({ text: input });
      setInput("");
    }
  };

  const handleAIMatchButtonClick = useCallback(() => {
    if (!selectedMediaMetadata || !selectedMediaMetadata.tmdbTvShow || !selectedMediaMetadata.tmdbTvShow.name) {
      return;
    }

    // Get AI config from userConfig
    const selectedAI = (userConfig.selectedAI as AI) || "DeepSeek";
    const providerKeyMap: Record<AI, keyof NonNullable<typeof userConfig.ai>> = {
      'OpenAI': 'openAI',
      'DeepSeek': 'deepseek',
      'OpenRouter': 'openrouter',
      'GLM': 'glm',
      'Other': 'other'
    };
    const providerKey = providerKeyMap[selectedAI];
    const config = userConfig.ai?.[providerKey] || { baseURL: '', apiKey: '', model: '' };

    if (!config.baseURL || !config.apiKey || !config.model) {
      console.error('AI configuration is incomplete');
      return;
    }

    const id = `task-${Date.now()}`

    setMessages([
      ...messages,
      {
        id: id,
        role: "assistant",
        parts: [
          {
            type: "dynamic-tool",
            toolName: "matchFilesToEpisode",
            toolCallId: `task-${Date.now()}`,
            title: "正在匹配媒体文件...",
            providerExecuted: false,
            state: "input-streaming", // Required: one of "input-streaming" | "input-available" | "output-available" | "output-error"
            input: {
              files: selectedMediaMetadata.files ?? [],
              tvShow: selectedMediaMetadata.tmdbTvShow,
            },
          }
        ]
      }
    ])


    matchFilesToEpisodeByAI(config, selectedMediaMetadata.files ?? [], selectedMediaMetadata.tmdbTvShow)
    .then((matches) => {

      console.log(`received match results: `, matches);


      updateMediaMetadata(selectedMediaMetadata.mediaFolderPath!, {
        ...selectedMediaMetadata,
        mediaFiles: generateMediaFileMetadatas(selectedMediaMetadata.tmdbTvShow!, selectedMediaMetadata.files ?? [], matches),
      })

      setMessages(latestMessages.current.map(message => {
        if(message.id === id) {
          return {
            ...message,
            parts: [
              ...message.parts.map(part => {
                return {
                  ...part,
                  state: "output-available", // Required: one of "input-streaming" | "input-available" | "output-available" | "output-error"
                } as UIMessagePart<UIDataTypes, UITools>;
              }),
            ]
          }
        }
        return message;
      }))
    })
    .catch((error) => {
      console.error('Error matching files to episode:', error);
      setMessages(latestMessages.current.map(message => {
        if(message.id === id) {
          return {
            ...message,
            parts: [
              ...message.parts.map(part => {
                return {
                  ...part,
                  state: "output-error", // Required: one of "input-streaming" | "input-available" | "output-available" | "output-error"
                  errorText: error instanceof Error ? error.message : String(error),
                } as UIMessagePart<UIDataTypes, UITools>;
              }),
            ]
          }
        }
        return message;
      }))
    })

  }, [messages, selectedMediaMetadata, setMessages, userConfig, latestMessages]);

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <Button onClick={handleAIMatchButtonClick}>AI Match</Button>
      <Conversation>
        <ConversationContent>
          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                {message.parts
                  .map((part, index) => (
                    MessageItem(part, index)
                  ))}
              </MessageContent>
            </Message>
          ))}
        </ConversationContent>
      </Conversation>
      <div className="p-1">
      <Suggestions>
        <Suggestion suggestion="匹配媒体文件" onClick={handleAIMatchButtonClick}/>
      </Suggestions>
      </div>
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