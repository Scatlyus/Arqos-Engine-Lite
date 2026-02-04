import type { ClauseType, Language } from "./clause-types";

/**
 * Templates padrão por tipo de cláusula
 */
export const DEFAULT_TEMPLATES: Record<ClauseType, Record<Language, string>> = {
    legal: {
        pt_BR: "Esta cláusula estabelece os termos legais aplicáveis ao presente documento, em conformidade com a legislação brasileira vigente.",
        en_US: "This clause establishes the legal terms applicable to this document, in accordance with applicable law.",
        es_ES: "Esta cláusula establece los términos legales aplicables al presente documento, de conformidad con la legislación vigente.",
    },
    contractual: {
        pt_BR: "As partes acordam que os termos e condições aqui estabelecidos vinculam ambas as partes de forma irrevogável.",
        en_US: "The parties agree that the terms and conditions set forth herein shall be binding upon both parties.",
        es_ES: "Las partes acuerdan que los términos y condiciones aquí establecidos vinculan a ambas partes de forma irrevocable.",
    },
    privacy: {
        pt_BR: "Em conformidade com a Lei Geral de Proteção de Dados (LGPD), Lei nº 13.709/2018, comprometemo-nos a proteger seus dados pessoais.",
        en_US: "In accordance with applicable privacy laws, we are committed to protecting your personal data.",
        es_ES: "De conformidad con las leyes de protección de datos aplicables, nos comprometemos a proteger sus datos personales.",
    },
    terms_of_service: {
        pt_BR: "Ao utilizar nossos serviços, você concorda com os seguintes termos e condições de uso.",
        en_US: "By using our services, you agree to the following terms and conditions of use.",
        es_ES: "Al utilizar nuestros servicios, usted acepta los siguientes términos y condiciones de uso.",
    },
    disclaimer: {
        pt_BR: "As informações contidas neste documento são fornecidas 'como estão', sem garantias de qualquer natureza.",
        en_US: "The information contained in this document is provided 'as is', without warranties of any kind.",
        es_ES: "La información contenida en este documento se proporciona 'tal cual', sin garantías de ningún tipo.",
    },
    warranty: {
        pt_BR: "O fornecedor garante que o produto/serviço estará livre de defeitos de fabricação pelo período de {{warranty_period}}.",
        en_US: "The provider warrants that the product/service shall be free from manufacturing defects for a period of {{warranty_period}}.",
        es_ES: "El proveedor garantiza que el producto/servicio estará libre de defectos de fabricación durante un período de {{warranty_period}}.",
    },
    liability: {
        pt_BR: "A responsabilidade total do fornecedor, por qualquer causa, não excederá o valor pago pelo cliente nos últimos 12 meses.",
        en_US: "The total liability of the provider, for any cause, shall not exceed the amount paid by the customer in the preceding 12 months.",
        es_ES: "La responsabilidad total del proveedor, por cualquier causa, no excederá el monto pagado por el cliente en los últimos 12 meses.",
    },
    confidentiality: {
        pt_BR: "As partes comprometem-se a manter sigilo sobre todas as informações confidenciais trocadas durante a vigência deste contrato.",
        en_US: "The parties agree to maintain confidentiality regarding all confidential information exchanged during the term of this agreement.",
        es_ES: "Las partes se comprometen a mantener la confidencialidad de toda la información confidencial intercambiada durante la vigencia de este contrato.",
    },
    termination: {
        pt_BR: "Qualquer das partes poderá rescindir este contrato mediante notificação por escrito com {{notice_period}} de antecedência.",
        en_US: "Either party may terminate this agreement by providing written notice with {{notice_period}} advance notice.",
        es_ES: "Cualquiera de las partes podrá rescindir este contrato mediante notificación por escrito con {{notice_period}} de antelación.",
    },
    custom: {
        pt_BR: "",
        en_US: "",
        es_ES: "",
    },
};

/**
 * Títulos padrão por tipo de cláusula
 */
export const DEFAULT_TITLES: Record<ClauseType, Record<Language, string>> = {
    legal: { pt_BR: "Disposições Legais", en_US: "Legal Provisions", es_ES: "Disposiciones Legales" },
    contractual: { pt_BR: "Termos Contratuais", en_US: "Contractual Terms", es_ES: "Términos Contractuales" },
    privacy: { pt_BR: "Política de Privacidade", en_US: "Privacy Policy", es_ES: "Política de Privacidad" },
    terms_of_service: { pt_BR: "Termos de Serviço", en_US: "Terms of Service", es_ES: "Términos de Servicio" },
    disclaimer: { pt_BR: "Aviso Legal", en_US: "Disclaimer", es_ES: "Aviso Legal" },
    warranty: { pt_BR: "Garantia", en_US: "Warranty", es_ES: "Garantía" },
    liability: { pt_BR: "Limitação de Responsabilidade", en_US: "Limitation of Liability", es_ES: "Limitación de Responsabilidad" },
    confidentiality: { pt_BR: "Confidencialidade", en_US: "Confidentiality", es_ES: "Confidencialidad" },
    termination: { pt_BR: "Rescisão", en_US: "Termination", es_ES: "Rescisión" },
    custom: { pt_BR: "Cláusula", en_US: "Clause", es_ES: "Cláusula" },
};
