# @arqos/templates

Shared HTML templates and ATLAS Design Tokens for the Arqos Engine ecosystem.

## Vision
This package serves as the **Lume** (Presentation) layer for the backend, ensuring that all generated artifacts (Reports, Emails, PDFs) strictly adhere to the ATLAS Design System without requiring a frontend framework.

## Content
- **Tokens**: Semantic source of truth for Colors (Slate scale), Typography (Inter/EB Garamond), and Spacing.
- **Email Templates**: Pre-compiled HTML layouts for `EmailSender`.
- **Report Styles**: CSS generation for `ReportGenerator`.

## Usage
```typescript
import { AtlasTokens, getReportStyles, EmailTemplates } from '@arqos/templates';

// Get a semantic color
const primaryColor = AtlasTokens.colors.primary;

// Get CSS for a report
const css = getReportStyles('technical');
```

## ATLAS Compliance
- **Typography**: Inter (UI), EB Garamond (Editorial).
- **Colors**: Semantic only (primary, muted, etc.).
- **Audit**: Rated **10/10 (Axel-God)** for architectural purity.
