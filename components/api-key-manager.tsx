import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ApiKeyManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiKeyManager({ open, onOpenChange }: ApiKeyManagerProps) {
  const [apiKey, setApiKey] = useState<string>("");

  // Load API key from localStorage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem("OPENROUTER_API_KEY");
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, [open]);

  // Save API key to localStorage
  const handleSaveApiKey = () => {
    try {
      if (apiKey && apiKey.trim()) {
        localStorage.setItem("OPENROUTER_API_KEY", apiKey.trim());
        toast.success("OpenRouter API key saved successfully");
        onOpenChange(false);
      } else {
        toast.error("Please enter a valid API key");
      }
    } catch (error) {
      console.error("Error saving API key:", error);
      toast.error("Failed to save API key");
    }
  };

  // Clear API key
  const handleClearApiKey = () => {
    try {
      localStorage.removeItem("OPENROUTER_API_KEY");
      setApiKey("");
      toast.success("API key cleared");
    } catch (error) {
      console.error("Error clearing API key:", error);
      toast.error("Failed to clear API key");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>OpenRouter API Key</DialogTitle>
          <DialogDescription>
            Enter your OpenRouter API key to use different AI models. 
            Get your key at{" "}
            <a 
              href="https://openrouter.ai/keys" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-primary hover:underline"
            >
              openrouter.ai/keys
            </a>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="openrouter-key">API Key</Label>
            <Input
              id="openrouter-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-v1-..."
            />
            <p className="text-xs text-muted-foreground">
              Your key is stored securely in your browser&apos;s local storage.
            </p>
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button 
            variant="destructive" 
            onClick={handleClearApiKey}
            disabled={!apiKey}
          >
            Clear Key
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveApiKey} disabled={!apiKey.trim()}>
              Save Key
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
