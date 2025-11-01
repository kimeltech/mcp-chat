import { Logo } from "./logo";
import { Sparkles, MessageSquare, Zap } from "lucide-react";

interface ProjectOverviewProps {
  compact?: boolean;
}

export const ProjectOverview = ({ compact = false }: ProjectOverviewProps) => {
  // Debug log
  console.log('[ProjectOverview] Rendering with compact =', compact);
  
  return (
    <div className={`flex flex-col items-center justify-center ${compact ? 'px-2 py-2' : 'px-4 py-6 sm:py-8 md:py-12'}`}>
      <div className={`flex flex-col items-center ${compact ? 'space-y-1.5' : 'space-y-3 sm:space-y-4 md:space-y-6'} max-w-2xl text-center`}>
        {/* Logo - Responsive sizing */}
        <div className="flex items-center justify-center">
          {compact ? (
            <Logo size={32} showText={false} />
          ) : (
            <>
              <Logo size={48} showText={false} className="sm:hidden" />
              <Logo size={56} showText={false} className="hidden sm:block md:hidden" />
              <Logo size={64} showText={false} className="hidden md:block" />
            </>
          )}
        </div>
        
        {/* Title - Responsive typography */}
        <div className={compact ? 'space-y-0' : 'space-y-1 sm:space-y-1.5 md:space-y-2'}>
          <h1 className={compact ? 'text-lg font-bold' : 'text-2xl sm:text-3xl md:text-4xl font-bold'}>
            EcoSemantic MCP Chat
          </h1>
          {!compact && (
            <p className="text-muted-foreground text-sm sm:text-base md:text-lg">
              AI-powered environmental impact analysis with Model Context Protocol
            </p>
          )}
        </div>

        {/* Features - Hide in compact mode or show simplified */}
        {!compact && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4 w-full mt-4 sm:mt-6 md:mt-8">
            <div className="flex flex-col items-center p-3 sm:p-3.5 md:p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <MessageSquare className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-green-600 mb-1.5 sm:mb-2" />
              <h3 className="font-semibold mb-0.5 sm:mb-1 text-sm sm:text-base">Multi-Model Support</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Choose from multiple AI models via OpenRouter
              </p>
            </div>
            
            <div className="flex flex-col items-center p-3 sm:p-3.5 md:p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <Zap className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-teal-600 mb-1.5 sm:mb-2" />
              <h3 className="font-semibold mb-0.5 sm:mb-1 text-sm sm:text-base">MCP Integration</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Connect custom tools via Model Context Protocol
              </p>
            </div>
            
            <div className="flex flex-col items-center p-3 sm:p-3.5 md:p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-green-500 mb-1.5 sm:mb-2" />
              <h3 className="font-semibold mb-0.5 sm:mb-1 text-sm sm:text-base">LCA Analysis</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Life Cycle Assessment tools and data access
              </p>
            </div>
          </div>
        )}

        {/* Compact feature badges - shown only in compact mode */}
        {compact && (
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded-full">
              <MessageSquare className="h-2.5 w-2.5 text-green-600" />
              <span>Models</span>
            </div>
            <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded-full">
              <Zap className="h-2.5 w-2.5 text-teal-600" />
              <span>MCP</span>
            </div>
            <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded-full">
              <Sparkles className="h-2.5 w-2.5 text-green-500" />
              <span>LCA</span>
            </div>
          </div>
        )}

        {/* Call to action - Hidden in compact, responsive spacing otherwise */}
        {!compact && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-3 sm:mt-4 md:mt-6">
            Start a conversation by typing a message below
          </p>
        )}
      </div>
    </div>
  );
};
