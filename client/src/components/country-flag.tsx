import { Globe } from "lucide-react";

interface CountryFlagProps {
  code: string;
  className?: string;
}

const flagColors: Record<string, { bg: string; text: string }> = {
  KE: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" },
  EC: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400" },
  CO: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400" },
  IT: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" },
  NL: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400" },
  CL: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400" },
};

export function CountryFlag({ code, className = "" }: CountryFlagProps) {
  const colors = flagColors[code] || { bg: "bg-muted", text: "text-muted-foreground" };
  
  if (!code || code.length !== 2) {
    return <Globe className={`h-4 w-4 text-muted-foreground ${className}`} />;
  }
  
  return (
    <span 
      className={`inline-flex items-center justify-center h-6 w-8 rounded text-xs font-bold ${colors.bg} ${colors.text} ${className}`}
      title={code}
    >
      {code}
    </span>
  );
}
