// Build-time operator details for the imprint and privacy policy (see .env.example).
interface ImportMetaEnv {
    readonly VITE_OPERATOR_NAME?: string;
    readonly VITE_OPERATOR_BUSINESS?: string;
    readonly VITE_OPERATOR_STREET?: string;
    readonly VITE_OPERATOR_CITY?: string;
    readonly VITE_OPERATOR_EMAIL?: string;
    readonly VITE_OPERATOR_PHONE?: string;
    readonly VITE_OPERATOR_VAT_ID?: string;
}
