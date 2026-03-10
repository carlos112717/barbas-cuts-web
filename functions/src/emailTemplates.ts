interface EmailField {
  label: string;
  value: string;
}

interface ReminderEmailInput {
  customerName: string;
  barberName: string;
  serviceName: string;
  date: string;
  time: string;
}

const BRAND_NAME = "Barbas Cut's";
const DEFAULT_APP_URL = "https://barbas-cuts-web.vercel.app";
const APP_URL =
  typeof process.env.APP_PUBLIC_URL === "string" && process.env.APP_PUBLIC_URL.trim()
    ? process.env.APP_PUBLIC_URL.trim()
    : DEFAULT_APP_URL;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderFields = (fields: EmailField[]) =>
  fields
    .map(
      (field) => `
      <tr>
        <td style="padding: 8px 0; color: #A3A3A3; font-size: 13px; width: 34%;">${escapeHtml(field.label)}</td>
        <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${escapeHtml(field.value)}</td>
      </tr>
    `
    )
    .join("");

const buildLayout = (
  preheader: string,
  title: string,
  intro: string,
  fields: EmailField[],
  highlight: string
) => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin: 0; padding: 24px; background: #0B0B0B; font-family: Arial, Helvetica, sans-serif;">
    <span style="display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; overflow: hidden;">
      ${escapeHtml(preheader)}
    </span>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid #E5E7EB;">
      <tr>
        <td style="background: linear-gradient(135deg, #111827 0%, #1F2937 60%, #111827 100%); padding: 20px 24px; text-align: center;">
          <div style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #FCD34D; font-weight: 700;">${escapeHtml(BRAND_NAME)}</div>
          <div style="margin-top: 8px; font-size: 22px; color: #FFFFFF; font-weight: 700;">${escapeHtml(title)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding: 24px;">
          <p style="margin: 0 0 18px; color: #374151; font-size: 15px; line-height: 1.6;">${escapeHtml(intro)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
            ${renderFields(fields)}
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 14px;">
            <tr>
              <td style="padding: 14px 16px; background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 8px; color: #7C2D12; font-size: 13px; line-height: 1.5;">
                ${escapeHtml(highlight)}
              </td>
            </tr>
            <tr>
              <td style="padding-top: 20px; text-align: center;">
                <a href="${escapeHtml(`${APP_URL}/appointments`)}" style="display: inline-block; background: #D4AF37; color: #111827; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 18px; border-radius: 8px;">
                  Ver mis citas
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 18px 24px; background: #F9FAFB; color: #6B7280; font-size: 12px; line-height: 1.5; border-top: 1px solid #E5E7EB;">
          Gracias por preferir Barbas Cut's.
        </td>
      </tr>
    </table>
  </body>
</html>
`;

export const buildReminderEmail = (input: ReminderEmailInput) => {
  return {
    subject: "Recordatorio de cita | Barbas Cut's",
    html: buildLayout(
      "Tu cita se acerca. Te esperamos.",
      "Recordatorio de tu cita",
      `Hola ${input.customerName || "cliente"}, te recordamos que tu cita se acerca.`,
      [
        { label: "Servicio", value: input.serviceName },
        { label: "Barbero", value: input.barberName },
        { label: "Fecha", value: input.date },
        { label: "Hora", value: input.time },
      ],
      "Si necesitas reprogramar, por favor hazlo con al menos 8 horas de anticipacion."
    ),
  };
};
