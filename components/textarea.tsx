import { modelID } from "@/ai/providers";
import { Textarea as ShadcnTextarea } from "@/components/ui/textarea";
import { ArrowUp, Loader2 } from "lucide-react";
import { ModelPicker } from "./model-picker";

interface InputProps {
  input: string;
  handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  isLoading: boolean;
  status: string;
  stop: () => void;
  selectedModel: modelID;
  setSelectedModel: (model: modelID) => void;
  compact?: boolean;
}

export const Textarea = ({
  input,
  handleInputChange,
  isLoading,
  status,
  stop,
  selectedModel,
  setSelectedModel,
  compact = false,
}: InputProps) => {
  const isStreaming = status === "streaming" || status === "submitted";

  return (
    <div className="relative w-full">
      <ShadcnTextarea
        className={`resize-none bg-background border-border w-full rounded-2xl pr-12 ${
          compact 
            ? 'pt-2 pb-10 text-sm' 
            : 'pt-3 sm:pt-4 pb-12 sm:pb-14 md:pb-16 text-sm sm:text-base'
        } border focus-visible:ring-ring placeholder:text-muted-foreground`}
        value={input}
        autoFocus
        placeholder="Send a message..."
        onChange={handleInputChange}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !isLoading && input.trim()) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <ModelPicker
        setSelectedModel={setSelectedModel}
        selectedModel={selectedModel}
      />

      <button
        type={isStreaming ? "button" : "submit"}
        onClick={isStreaming ? stop : undefined}
        disabled={
          (!isStreaming && !input.trim()) ||
          (isStreaming && status === "submitted")
        }
        className={`absolute right-2 bottom-2 rounded-full ${
          compact ? 'p-1.5' : 'p-1.5 sm:p-2'
        } bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed transition-all duration-200`}
      >
        {isStreaming ? (
          <Loader2 className={`${compact ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5 sm:h-4 sm:w-4'} text-primary-foreground animate-spin`} />
        ) : (
          <ArrowUp className={`${compact ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5 sm:h-4 sm:w-4'} text-primary-foreground`} />
        )}
      </button>
    </div>
  );
};
