import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type ThemeStyle = "cartoon" | "minimal";

interface ThemeContextType {
  style: ThemeStyle;
  toggleStyle: () => void;
  setStyle: (style: ThemeStyle) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [style, setStyle] = useState<ThemeStyle>(() => {
    const saved = localStorage.getItem("theme-style");
    return (saved as ThemeStyle) || "cartoon";
  });

  useEffect(() => {
    localStorage.setItem("theme-style", style);
    
    // Update CSS variables based on style
    if (style === "minimal") {
      document.documentElement.style.setProperty("--radius", "0.5rem");
    } else {
      document.documentElement.style.setProperty("--radius", "1.5rem");
    }
  }, [style]);

  const toggleStyle = () => {
    setStyle((prev) => (prev === "cartoon" ? "minimal" : "cartoon"));
  };

  return (
    <ThemeContext.Provider value={{ style, toggleStyle, setStyle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

// Style configurations
export const themeStyles = {
  cartoon: {
    // Background
    background: "bg-gradient-to-br from-[#fff9f0] via-[#ffe5d9] to-[#ffd9e8]",
    cardBg: "bg-white/90",
    cardBorder: "border-4 border-[#ffe5d9]",
    cardRounded: "rounded-3xl",
    
    // Buttons
    buttonRounded: "rounded-2xl",
    buttonShadow: "shadow-xl",
    buttonPrimary: "bg-gradient-to-r from-[#4ecdc4] to-[#95e1d3] hover:from-[#95e1d3] hover:to-[#4ecdc4]",
    buttonSecondary: "bg-gradient-to-r from-[#ff6b9d] to-[#ff8fab] hover:from-[#ff8fab] hover:to-[#ff6b9d]",
    
    // Inputs
    inputRounded: "rounded-2xl",
    inputBg: "bg-[#fff9f0]",
    inputBorder: "border-2 border-[#ffe5d9]",
    
    // Headers
    headerBorder: "border-b-4 border-[#4ecdc4]",
    headerShadow: "shadow-xl",
    
    // Text
    titleGradient: "bg-gradient-to-r from-[#4ecdc4] to-[#ff6b9d] bg-clip-text text-transparent",
    
    // Badges
    badgeRounded: "rounded-full",
    
    // Animations
    enableDecorations: true,
    enableEmojis: true,
  },
  minimal: {
    // Background
    background: "bg-gray-50",
    cardBg: "bg-white",
    cardBorder: "border border-gray-200",
    cardRounded: "rounded-lg",
    
    // Buttons
    buttonRounded: "rounded-md",
    buttonShadow: "shadow-sm",
    buttonPrimary: "bg-[#4ecdc4] hover:bg-[#3db8af]",
    buttonSecondary: "bg-[#ff6b9d] hover:bg-[#ff5589]",
    
    // Inputs
    inputRounded: "rounded-md",
    inputBg: "bg-white",
    inputBorder: "border border-gray-300",
    
    // Headers
    headerBorder: "border-b border-gray-200",
    headerShadow: "shadow-sm",
    
    // Text
    titleGradient: "text-gray-900",
    
    // Badges
    badgeRounded: "rounded-md",
    
    // Animations
    enableDecorations: false,
    enableEmojis: false,
  },
};
