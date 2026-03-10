interface EmailField {
  label: string;
  value: string;
}

interface EmailLayoutInput {
  preheader: string;
  title: string;
  intro: string;
  fields: EmailField[];
  highlight?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}

interface ConfirmationEmailInput {
  customerName: string;
  barberName: string;
  serviceName: string;
  date: string;
  time: string;
  price: number;
}

interface CancellationEmailInput {
  customerName: string;
  barberName: string;
  serviceName: string;
  date: string;
  time: string;
  canceledBy: "admin" | "customer";
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
  typeof process.env.NEXT_PUBLIC_APP_URL === "string" && process.env.NEXT_PUBLIC_APP_URL.trim()
    ? process.env.NEXT_PUBLIC_APP_URL.trim()
    : DEFAULT_APP_URL;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatPrice = (price: number) => `${price.toFixed(2)} EUR`;

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

const buildLayout = (input: EmailLayoutInput) => {
  const ctaHtml =
    input.ctaLabel && input.ctaUrl
      ? `
      <tr>
        <td style="padding-top: 20px; text-align: center;">
          <a href="${escapeHtml(input.ctaUrl)}" style="display: inline-block; background: #D4AF37; color: #111827; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 18px; border-radius: 8px;">
            ${escapeHtml(input.ctaLabel)}
          </a>
        </td>
      </tr>
    `
      : "";

  const highlightHtml = input.highlight
    ? `
      <tr>
        <td style="padding: 14px 16px; background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 8px; color: #7C2D12; font-size: 13px; line-height: 1.5;">
          ${escapeHtml(input.highlight)}
        </td>
      </tr>
      <tr><td style="height: 14px;"></td></tr>
    `
    : "";

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin: 0; padding: 24px; background: #0B0B0B; font-family: Arial, Helvetica, sans-serif;">
    <span style="display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; overflow: hidden;">
      ${escapeHtml(input.preheader)}
    </span>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid #E5E7EB;">
      <tr>
        <td style="background: linear-gradient(135deg, #111827 0%, #1F2937 60%, #111827 100%); padding: 20px 24px; text-align: center;">
          <div style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #FCD34D; font-weight: 700;">${escapeHtml(BRAND_NAME)}</div>
          <div style="margin-top: 8px; font-size: 22px; color: #FFFFFF; font-weight: 700;">${escapeHtml(input.title)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding: 24px;">
          <p style="margin: 0 0 18px; color: #374151; font-size: 15px; line-height: 1.6;">${escapeHtml(input.intro)}</p>
          ${highlightHtml}
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
            ${renderFields(input.fields)}
          </table>
          ${ctaHtml}
        </td>
      </tr>
      <tr>
        <td style="padding: 18px 24px; background: #F9FAFB; color: #6B7280; font-size: 12px; line-height: 1.5; border-top: 1px solid #E5E7EB;">
          ${escapeHtml(input.footerNote || "Si necesitas ayuda, responde a este correo o contactanos por WhatsApp.")}
        </td>
      </tr>
    </table>
  </body>
</html>
`;
};

export const buildBookingConfirmationEmail = (input: ConfirmationEmailInput) => {
  return {
    subject: "Confirmacion de cita | Barbas Cut's",
    html: buildLayout({
      preheader: "Tu cita fue confirmada correctamente.",
      title: "Reserva confirmada",
      intro: `Hola ${input.customerName || "cliente"}, tu cita ha sido confirmada. Te compartimos los detalles:`,
      fields: [
        { label: "Servicio", value: input.serviceName },
        { label: "Barbero", value: input.barberName },
        { label: "Fecha", value: input.date },
        { label: "Hora", value: input.time },
        { label: "Precio", value: formatPrice(input.price) },
      ],
      ctaLabel: "Ver mis citas",
      ctaUrl: `${APP_URL}/appointments`,
      footerNote: "Gracias por preferir Barbas Cut's. Te esperamos puntual para darte el mejor servicio.",
    }),
  };
};

export const buildCancellationEmail = (input: CancellationEmailInput) => {
  const canceledByText =
    input.canceledBy === "admin" ? "nuestro equipo de administracion" : "tu solicitud";

  return {
    subject: "Cita cancelada | Barbas Cut's",
    html: buildLayout({
      preheader: "Tu cita ha sido cancelada.",
      title: "Actualizacion de tu cita",
      intro: `Hola ${input.customerName || "cliente"}, te informamos que tu cita fue cancelada por ${canceledByText}.`,
      fields: [
        { label: "Servicio", value: input.serviceName },
        { label: "Barbero", value: input.barberName },
        { label: "Fecha", value: input.date },
        { label: "Hora", value: input.time },
      ],
      highlight:
        "Puedes reservar una nueva cita cuando quieras desde la app. Si necesitas ayuda para reprogramar, escribenos.",
      ctaLabel: "Reservar nueva cita",
      ctaUrl: `${APP_URL}/booking`,
      footerNote: "Lamentamos el inconveniente. Gracias por confiar en Barbas Cut's.",
    }),
  };
};

export const buildReminderEmail = (input: ReminderEmailInput) => {
  return {
    subject: "Recordatorio de cita | Barbas Cut's",
    html: buildLayout({
      preheader: "Tu cita se acerca. Te esperamos.",
      title: "Recordatorio de tu cita",
      intro: `Hola ${input.customerName || "cliente"}, este es un recordatorio de tu cita programada para hoy.`,
      fields: [
        { label: "Servicio", value: input.serviceName },
        { label: "Barbero", value: input.barberName },
        { label: "Fecha", value: input.date },
        { label: "Hora", value: input.time },
      ],
      highlight: "Si necesitas reprogramar, recuerda hacerlo con al menos 8 horas de anticipacion.",
      ctaLabel: "Gestionar mis citas",
      ctaUrl: `${APP_URL}/appointments`,
      footerNote: "Nos vemos pronto en Barbas Cut's.",
    }),
  };
};
