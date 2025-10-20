import { Logo } from "./logo";
import { Sparkles, MessageSquare, Zap } from "lucide-react";

export const ProjectOverview = () => {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12">
      <div className="flex flex-col items-center space-y-6 max-w-2xl text-center">
        {/* Logo */}
        <Logo size={64} showText={false} />
        
        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">
            EcoSemantic MCP Chat
          </h1>
          <p className="text-muted-foreground text-lg">
            AI-powered environmental impact analysis with Model Context Protocol
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-8">
          <div className="flex flex-col items-center p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <MessageSquare className="h-8 w-8 text-green-600 mb-2" />
            <h3 className="font-semibold mb-1">Multi-Model Support</h3>
            <p className="text-sm text-muted-foreground">
              Choose from multiple AI models via OpenRouter
            </p>
          </div>
          
          <div className="flex flex-col items-center p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <Zap className="h-8 w-8 text-teal-600 mb-2" />
            <h3 className="font-semibold mb-1">MCP Integration</h3>
            <p className="text-sm text-muted-foreground">
              Connect custom tools via Model Context Protocol
            </p>
          </div>
          
          <div className="flex flex-col items-center p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <Sparkles className="h-8 w-8 text-green-500 mb-2" />
            <h3 className="font-semibold mb-1">LCA Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Life Cycle Assessment tools and data access
            </p>
          </div>
        </div>

        {/* Call to action */}
        <p className="text-sm text-muted-foreground mt-6">
          Start a conversation by typing a message below
        </p>
      </div>
    </div>
  );
};
