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
const LOGO_URL = `${APP_URL}/LOGO_BARBER.png`;

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
        <td style="padding: 10px 0; color: #D1D5DB; font-size: 13px; width: 34%;">${escapeHtml(field.label)}</td>
        <td style="padding: 10px 0; color: #FFFFFF; font-size: 14px; font-weight: 700;">${escapeHtml(field.value)}</td>
      </tr>
    `
    )
    .join("");

const buildLayout = (input: EmailLayoutInput) => {
  const ctaHtml =
    input.ctaLabel && input.ctaUrl
      ? `
      <tr>
        <td style="padding: 22px 28px 28px; text-align: center;">
          <a href="${escapeHtml(input.ctaUrl)}" style="display: inline-block; background: #D4AF37; color: #0B0B0B; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 18px; border-radius: 8px;">
            ${escapeHtml(input.ctaLabel)}
          </a>
        </td>
      </tr>
    `
      : "";

  const highlightHtml = input.highlight
    ? `
      <tr>
        <td style="padding: 6px 28px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 14px 16px; background: #FFF8E1; border: 1px solid #E0BF55; border-radius: 10px; color: #5C4300; font-size: 13px; line-height: 1.55;">
                ${escapeHtml(input.highlight)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
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
  <body style="margin: 0; padding: 24px 12px; background: #F3F4F6; font-family: Arial, Helvetica, sans-serif;">
    <span style="display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; overflow: hidden;">
      ${escapeHtml(input.preheader)}
    </span>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; margin: 0 auto;">
      <tr>
        <td>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: #FFFFFF; border-radius: 14px; overflow: hidden; border: 1px solid #E0BF55;">
            <tr>
              <td style="background: linear-gradient(135deg, #0B0B0B 0%, #171717 60%, #0B0B0B 100%); padding: 28px 24px; text-align: center; border-bottom: 1px solid rgba(212, 175, 55, 0.35);">
                <img src="${escapeHtml(LOGO_URL)}" alt="${escapeHtml(BRAND_NAME)}" width="96" height="96" style="display: block; margin: 0 auto 10px; width: 96px; height: 96px; object-fit: contain;" />
                <div style="font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; color: #D4AF37; font-weight: 700;">${escapeHtml(BRAND_NAME)}</div>
                <div style="margin-top: 8px; font-size: 36px; color: #FFFFFF; font-weight: 700; line-height: 1.25;">${escapeHtml(input.title)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 28px 8px;">
                <p style="margin: 0; color: #1F2937; font-size: 15px; line-height: 1.7;">${escapeHtml(input.intro)}</p>
              </td>
            </tr>
            ${highlightHtml}
            <tr>
              <td style="padding: 14px 28px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; background: #111827; border-radius: 10px;">
                  <tr>
                    <td style="padding: 6px 16px 8px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                        ${renderFields(input.fields)}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${ctaHtml}
            <tr>
              <td style="padding: 18px 28px; background: #FAFAFA; color: #6B7280; font-size: 12px; line-height: 1.6; border-top: 1px solid #E5E7EB;">
                ${escapeHtml(input.footerNote || "Si necesitas ayuda, responde a este correo o contactanos por WhatsApp.")}
              </td>
            </tr>
          </table>
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
      highlight:
        "Recuerda nuestra politica de cancelacion: para cambios o cancelaciones, hazlo con al menos 8 horas de anticipacion.",
      ctaLabel: "Ver mis citas",
      ctaUrl: `${APP_URL}/appointments`,
      footerNote:
        "Gracias por preferir Barbas Cut's. Si necesitas ayuda, tambien puedes escribirnos por WhatsApp.",
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
        "Politica de cancelacion: las citas deben cancelarse con minimo 8 horas de anticipacion. Si faltan menos de 8 horas, comunicate por WhatsApp con el administrador para ayudarte a cancelar y reprogramar tu nueva cita.",
      ctaLabel: "Reservar nueva cita",
      ctaUrl: `${APP_URL}/booking`,
      footerNote:
        "Queremos darte la mejor experiencia posible. Si necesitas apoyo inmediato, contacta al equipo por WhatsApp.",
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
      highlight:
        "Si necesitas reprogramar o cancelar, hazlo con al menos 8 horas de anticipacion. Si ya falta menos tiempo, escribe por WhatsApp para ayudarte.",
      ctaLabel: "Gestionar mis citas",
      ctaUrl: `${APP_URL}/appointments`,
      footerNote: "Nos vemos pronto en Barbas Cut's. Gracias por tu confianza.",
    }),
  };
};
