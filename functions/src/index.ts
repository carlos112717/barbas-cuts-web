import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { buildReminderEmail } from "./emailTemplates.js";

admin.initializeApp();
const db = admin.firestore();
const DEFAULT_SERVICE_ACCOUNT = "560366801052-compute@developer.gserviceaccount.com";
const serviceAccount =
  typeof process.env.FUNCTIONS_SERVICE_ACCOUNT === "string" &&
  process.env.FUNCTIONS_SERVICE_ACCOUNT.trim()
    ? process.env.FUNCTIONS_SERVICE_ACCOUNT.trim()
    : DEFAULT_SERVICE_ACCOUNT;

setGlobalOptions({
  region: "us-central1",
  serviceAccount,
});

const isValidEmail = (email: unknown) => {
  if (typeof email !== "string") return false;
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};

const computeReminderSlot = (now: Date, timeZone: string) => {
  const targetDate = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone });
  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });

  const date = dateFormatter.format(targetDate);
  const rawTime = timeFormatter.format(targetDate);
  const [hourStr, minuteStr] = rawTime.split(":");

  const minutes = parseInt(minuteStr, 10);
  let roundedMinutes = "00";
  let finalHour = parseInt(hourStr, 10);

  if (minutes >= 15 && minutes < 45) {
    roundedMinutes = "30";
  } else if (minutes >= 45) {
    roundedMinutes = "00";
    finalHour += 1;
  }

  const time = `${finalHour.toString().padStart(2, "0")}:${roundedMinutes}`;
  return { date, time };
};

export const enviarRecordatorios = onSchedule("every 30 minutes", async () => {
  const timeZone = "Europe/Madrid";
  const { date, time } = computeReminderSlot(new Date(), timeZone);

  console.log(`Buscando recordatorios para ${date} a las ${time}`);

  try {
    const snapshot = await db
      .collection("appointments")
      .where("date", "==", date)
      .where("time", "==", time)
      .where("status", "==", "confirmed")
      .get();

    if (snapshot.empty) {
      console.log("No hay citas para recordar en este ciclo.");
      return;
    }

    const batch = db.batch();
    let queued = 0;

    snapshot.docs.forEach((docSnap) => {
      const appointment = docSnap.data();
      if (!isValidEmail(appointment.customerEmail)) return;

      const reminderEmail = buildReminderEmail({
        customerName:
          typeof appointment.customerName === "string"
            ? appointment.customerName
            : "cliente",
        barberName:
          typeof appointment.barberName === "string"
            ? appointment.barberName
            : "barbero",
        serviceName:
          typeof appointment.serviceName === "string"
            ? appointment.serviceName
            : "servicio",
        date: typeof appointment.date === "string" ? appointment.date : date,
        time: typeof appointment.time === "string" ? appointment.time : time,
      });

      const mailRef = db.collection("mail").doc();
      batch.set(mailRef, {
        to: appointment.customerEmail.trim(),
        message: reminderEmail,
      });
      queued += 1;
    });

    if (queued === 0) {
      console.log("No hubo correos validos para enviar en este ciclo.");
      return;
    }

    await batch.commit();
    console.log(`Recordatorios enviados al motor de correo: ${queued}.`);
  } catch (error) {
    console.error("Error enviando recordatorios:", error);
  }
});
