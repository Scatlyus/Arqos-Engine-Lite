import { AtlasTokens, getBaseStyles } from '../tokens';

export type EmailFormat = "text" | "html" | "markdown";

export const EmailTemplates: Record<string, { subject: string; body: string; format: EmailFormat }> = {
    welcome: {
        subject: "Bem-vindo ao {{appName}}!",
        body: `
<!DOCTYPE html>
<html>
<head>
<style>
${getBaseStyles()}
.container { max-width: ${AtlasTokens.spacing.container}; margin: 40px auto; background-color: ${AtlasTokens.colors.surface}; border: 1px solid ${AtlasTokens.colors.border}; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
.header { background: ${AtlasTokens.colors.surface}; color: ${AtlasTokens.colors.primary}; padding: 32px 40px; text-align: center; border-bottom: 2px solid ${AtlasTokens.colors.primary}; }
.header h1 { font-size: 28px; margin: 0; letter-spacing: ${AtlasTokens.typography.letterSpacing.tight}; }
.content { padding: 40px; background: ${AtlasTokens.colors.surface}; }
.footer { text-align: center; padding: 24px; color: ${AtlasTokens.colors.muted}; font-size: 13px; background-color: ${AtlasTokens.colors.bg}; border-top: 1px solid ${AtlasTokens.colors.border}; }
a { color: ${AtlasTokens.colors.primary}; font-weight: 500; text-decoration: underline; text-underline-offset: 4px; }
</style>
</head>
<body>
<div class="container">
<div class="header"><h1>Bem-vindo, {{userName}}!</h1></div>
<div class="content">
<p>Obrigado por se cadastrar no <strong>{{appName}}</strong>.</p>
<p>Estamos felizes em tê-lo conosco! Sua jornada começa agora.</p>
<p>Para acessar sua conta: <a href="{{loginUrl}}">{{loginUrl}}</a></p>
</div>
<div class="footer">© {{year}} {{appName}}. Design System by ATLAS.</div>
</div>
</body>
</html>`,
        format: "html",
    },
    password_reset: {
        subject: "Redefinição de Senha - {{appName}}",
        body: `
<!DOCTYPE html>
<html>
<head>
<style>
${getBaseStyles()}
.container { max-width: ${AtlasTokens.spacing.container}; margin: 40px auto; background-color: ${AtlasTokens.colors.surface}; border: 1px solid ${AtlasTokens.colors.border}; border-radius: 8px; overflow: hidden; }
.header { background: ${AtlasTokens.colors.surface}; padding: 32px; text-align: center; border-bottom: 1px solid ${AtlasTokens.colors.border}; }
.header h1 { font-size: 24px; margin: 0; }
.content { padding: 40px; background: ${AtlasTokens.colors.surface}; text-align: center; }
.button { display: inline-block; padding: 12px 32px; background: ${AtlasTokens.colors.primary}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 24px 0; transition: opacity 0.2s; }
.button:hover { opacity: 0.9; }
.footer { text-align: center; padding: 24px; color: ${AtlasTokens.colors.muted}; font-size: 13px; background-color: ${AtlasTokens.colors.bg}; border-top: 1px solid ${AtlasTokens.colors.border}; }
</style>
</head>
<body>
<div class="container">
<div class="header"><h1>Redefinição de Senha</h1></div>
<div class="content">
<p style="text-align: left">Olá {{userName}},</p>
<p style="text-align: left">Recebemos uma solicitação para redefinir sua senha.</p>
<a href="{{resetUrl}}" class="button">Redefinir Senha</a>
<p style="text-align: left"><small>Este link expira em {{expiryHours}} horas.</small></p>
</div>
<div class="footer">© {{year}} {{appName}}. Design System by ATLAS.</div>
</div>
</body>
</html>`,
        format: "html",
    },
    notification: {
        subject: "{{title}} - {{appName}}",
        body: `
<!DOCTYPE html>
<html>
<head>
<style>
${getBaseStyles()}
.container { max-width: ${AtlasTokens.spacing.container}; margin: 40px auto; background-color: ${AtlasTokens.colors.surface}; border: 1px solid ${AtlasTokens.colors.border}; border-radius: 8px; overflow: hidden; }
.header { background: ${AtlasTokens.colors.surface}; padding: 24px; text-align: left; border-bottom: 4px solid ${AtlasTokens.colors.primary}; }
.header h1 { font-size: 20px; margin: 0; }
.content { padding: 32px; background: ${AtlasTokens.colors.surface}; }
.footer { padding: 24px; color: ${AtlasTokens.colors.muted}; font-size: 13px; background-color: ${AtlasTokens.colors.bg}; border-top: 1px solid ${AtlasTokens.colors.border}; }
</style>
</head>
<body>
<div class="container">
<div class="header"><h1>{{title}}</h1></div>
<div class="content">
<p>{{message}}</p>
{{#if actionUrl}}<p style="margin-top: 24px;"><a href="{{actionUrl}}" style="display:inline-block;padding:10px 24px;background:${AtlasTokens.colors.primary};color:white;text-decoration:none;border-radius:4px;font-weight:500;">{{actionText}}</a></p>{{/if}}
</div>
<div class="footer">© {{year}} {{appName}}.</div>
</div>
</body>
</html>`,
        format: "html",
    },
    invoice: {
        subject: "Fatura #{{invoiceNumber}} - {{appName}}",
        body: `
<!DOCTYPE html>
<html>
<head>
<style>
${getBaseStyles()}
.container { max-width: ${AtlasTokens.spacing.container}; margin: 40px auto; background-color: ${AtlasTokens.colors.surface}; border: 1px solid ${AtlasTokens.colors.border}; border-radius: 8px; overflow: hidden; }
.header { background: ${AtlasTokens.colors.primary}; color: #ffffff; padding: 40px; text-align: right; }
.header h1 { font-size: 32px; margin: 0; opacity: 0.9; color: #ffffff; }
.content { padding: 40px; background: ${AtlasTokens.colors.surface}; }
table { width: 100%; border-collapse: collapse; margin: 24px 0; }
th { text-align: left; color: ${AtlasTokens.colors.muted}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 12px; border-bottom: 2px solid ${AtlasTokens.colors.primary}; }
td { padding: 16px 0; border-bottom: 1px solid ${AtlasTokens.colors.border}; }
.total td { font-weight: 600; font-size: 18px; border-bottom: none; padding-top: 24px; }
.footer { text-align: center; padding: 24px; color: ${AtlasTokens.colors.muted}; font-size: 13px; background-color: ${AtlasTokens.colors.bg}; border-top: 1px solid ${AtlasTokens.colors.border}; }
</style>
</head>
<body>
<div class="container">
<div class="header"><h1>Fatura #{{invoiceNumber}}</h1></div>
<div class="content">
<p>Olá <strong>{{userName}}</strong>,</p>
<p>Referência: {{period}}</p>
<table>
<tr><th>Descrição</th><th>Valor</th></tr>
<tr><td>{{itemDescription}}</td><td>{{itemValue}}</td></tr>
<tr class="total"><td>Total</td><td>{{totalValue}}</td></tr>
</table>
<p style="margin-top: 24px; font-size: 14px; color: var(--color-muted);">Vencimento: {{dueDate}}</p>
</div>
<div class="footer">© {{year}} {{appName}}.</div>
</div>
</body>
</html>`,
        format: "html",
    },
    simple: {
        subject: "{{subject}}",
        body: "{{body}}",
        format: "text",
    },
};
