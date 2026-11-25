// The provider named by the imprint (§ 5 DDG) and the controller named by the privacy policy
// (Art. 13 GDPR), as on shiftbloom.studio. It must be
// a person or legal entity: an Open Collective is neither, and its fiscal host doesn't run the
// site. The address decides the supervisory authority named in the privacy policy.
const env = (value: string | undefined) => value?.trim() || undefined;

// Read at build time from VITE_OPERATOR_* variables (Workers Builds build variables or a local
// .env, see .env.example), so the repository holds no personal data. `scripts/check-operator.ts`
// stops a production build when the required ones are missing.
export const operator = {
    name: env(import.meta.env.VITE_OPERATOR_NAME) ?? "",
    business: env(import.meta.env.VITE_OPERATOR_BUSINESS),
    street: env(import.meta.env.VITE_OPERATOR_STREET) ?? "",
    city: env(import.meta.env.VITE_OPERATOR_CITY) ?? "",
    email: env(import.meta.env.VITE_OPERATOR_EMAIL) ?? "",
    /** Optional. Shown on the imprint only when set. */
    phone: env(import.meta.env.VITE_OPERATOR_PHONE),
    /** USt-IdNr. (§ 27a UStG); the imprint must show it once one has been issued. */
    vatId: env(import.meta.env.VITE_OPERATOR_VAT_ID),
};

export default function OperatorAddress(props: { lang: "en" | "de" }) {
    return (
        <address>
            {operator.name}
            <br />
            {operator.business && (
                <>
                    {operator.business}
                    <br />
                </>
            )}
            {operator.street}
            <br />
            {operator.city}
            <br />
            {props.lang === "de" ? "Deutschland" : "Germany"}
        </address>
    );
}
