import Image from "next/image";

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export function Logo({ className = '', size = 32, showText = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image 
        src="/logo.svg" 
        alt="EcoSemantic Logo" 
        width={size}
        height={size}
        className="object-contain"
        priority
      />
      
      {showText && (
        <div className="flex items-center gap-1.5">
          <span className="text-xl font-bold">
            EcoSemantic
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            MCP
          </span>
        </div>
      )}
    </div>
  );
}
