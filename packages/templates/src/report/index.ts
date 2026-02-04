import { AtlasTokens, getBaseStyles } from '../tokens';

export function getReportStyles(template: string): string {
    const baseStyles = `
      ${getBaseStyles()}

      body { 
        margin: 40px; 
      }
      
      h1 { 
        border-bottom: 2px solid ${AtlasTokens.colors.primary}; 
        padding-bottom: 12px; 
        font-size: 2.5rem;
        letter-spacing: ${AtlasTokens.typography.letterSpacing.tight};
      }

      h2 { 
        color: ${AtlasTokens.colors.muted}; 
        font-size: 1.75rem;
        margin-top: 2rem;
      }
      
      h3 { 
        color: ${AtlasTokens.colors.primary}; 
        margin-top: 1.5rem;
        font-size: 1.25rem;
      }

      section { margin: 32px 0; }
      
      table { 
        border-collapse: collapse; 
        width: 100%; 
        margin: 24px 0; 
        font-size: 0.95rem;
      }
      
      th, td { 
        border: 1px solid ${AtlasTokens.colors.border}; 
        padding: 12px 16px; 
        text-align: left; 
      }
      
      th { 
        background-color: ${AtlasTokens.colors.primary}; 
        color: ${AtlasTokens.colors.primaryForeground}; 
        font-weight: 500;
        letter-spacing: 0.02em;
      }
      
      tr:nth-child(even) { background-color: ${AtlasTokens.colors.bgAlt}; }
      
      .metadata { 
        background-color: ${AtlasTokens.colors.bgAlt}; 
        padding: 24px; 
        margin: 32px 0; 
        border-left: 4px solid ${AtlasTokens.colors.primary}; 
        border-radius: 0 4px 4px 0;
      }
      
      footer { 
        margin-top: 64px; 
        padding-top: 24px; 
        border-top: 1px solid ${AtlasTokens.colors.border}; 
        color: ${AtlasTokens.colors.muted}; 
        font-size: 0.875rem; 
      }
    `;

    if (template === "executive") {
        return baseStyles + `
        :root {
          --color-primary: ${AtlasTokens.colors.blue};
          --color-primary-foreground: #ffffff;
        }
      `;
    } else if (template === "technical") {
        return baseStyles + `
        :root {
          --font-sans: 'JetBrains Mono', 'Fira Code', monospace;
          --font-serif: 'JetBrains Mono', 'Fira Code', monospace;
        }
        body { background-color: ${AtlasTokens.colors.bgAlt}; }
        .metadata { background-color: #ffffff; border: 1px solid ${AtlasTokens.colors.border}; border-left-width: 1px; }
      `;
    }

    return baseStyles;
}
