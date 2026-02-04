/**
 * 🧭 ATLAS Design Tokens
 * Source of Truth: design_system_tokens.yaml
 */

export const AtlasTokens = {
    typography: {
        fontFamily: {
            sans: "'Inter', sans-serif",
            serif: "'EB Garamond', serif",
        },
        weight: {
            regular: 400,
            medium: 500,
            semibold: 600,
        },
        letterSpacing: {
            tight: "-0.02em",
            wide: "0.02em",
        }
    },
    colors: {
        primary: "#0f172a", // Slate 900
        primaryForeground: "#f8fafc", // Slate 50
        muted: "#64748b", // Slate 500
        border: "#e2e8f0", // Slate 200
        bg: "#ffffff",
        bgAlt: "#f8fafc", // Slate 50
        surface: "#ffffff",
        blue: "#1e3a8a", // Blue 900 (Executive)
    },
    spacing: {
        unit: "4px",
        container: "600px",
    }
} as const;

export const GoogleFontsURL = "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500;600&display=swap";

export function getBaseStyles(): string {
    return `
    @import url('${GoogleFontsURL}');
    
    :root {
      --font-sans: ${AtlasTokens.typography.fontFamily.sans};
      --font-serif: ${AtlasTokens.typography.fontFamily.serif};
      --color-primary: ${AtlasTokens.colors.primary};
      --color-primary-foreground: ${AtlasTokens.colors.primaryForeground};
      --color-muted: ${AtlasTokens.colors.muted};
      --color-border: ${AtlasTokens.colors.border};
      --color-bg: ${AtlasTokens.colors.bg};
      --color-bg-alt: ${AtlasTokens.colors.bgAlt};
      --color-surface: ${AtlasTokens.colors.surface};
    }

    body { 
      font-family: var(--font-sans); 
      color: var(--color-primary); 
      margin: 0; 
      padding: 0;
      line-height: 1.6; 
      background-color: var(--color-bg);
    }
    
    h1, h2, h3, h4, h5, h6 {
      font-family: var(--font-serif);
      font-weight: ${AtlasTokens.typography.weight.semibold};
      color: var(--color-primary);
    }
  `;
}
