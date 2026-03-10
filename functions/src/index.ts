import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

// Encendemos los privilegios de administrador para el robot
admin.initializeApp();
const db = admin.firestore();

// Este robot se despierta cada 30 minutos
export const enviarRecordatorios = onSchedule("every 30 minutes", async () => {
  // Configuramos la zona horaria de España
  const timeZone = 'Europe/Madrid';
  
  // 1. Calculamos qué hora será exactamente dentro de 6 horas
  const targetDate = new Date(Date.now() + 6 * 60 * 60 * 1000);
  
  // Extraemos la fecha en formato "YYYY-MM-DD" y la hora en "HH:mm"
  const formatterDate = new Intl.DateTimeFormat('en-CA', { timeZone }); 
  const formatterTime = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' });

  const dateString = formatterDate.format(targetDate);
  let timeString = formatterTime.format(targetDate); // Ej: "15:14"

  // 2. Redondeamos la hora para que coincida con tus turnos (00 o 30)
  const [hourStr, minuteStr] = timeString.split(":");
  const minutes = parseInt(minuteStr, 10);
  let roundedMinutes = "00";
  let finalHour = parseInt(hourStr, 10);

  if (minutes >= 15 && minutes < 45) {
    roundedMinutes = "30";
  } else if (minutes >= 45) {
    roundedMinutes = "00";
    finalHour += 1;
  }
  
  // Si la hora pasa de 24, se ajusta a formato correcto (ej: 09:30)
  timeString = `${finalHour.toString().padStart(2, '0')}:${roundedMinutes}`;

  console.log(`🤖 Buscando citas para el: ${dateString} a las ${timeString}`);

  try {
    // 3. Buscamos en la base de datos las citas de esa fecha y hora exacta
    const snapshot = await db.collection("appointments")
      .where("date", "==", dateString)
      .where("time", "==", timeString)
      .where("status", "==", "confirmed")
      .get();

    if (snapshot.empty) {
      console.log("No hay citas programadas para dentro de 6 horas.");
      return;
    }

    // 4. Por cada cita encontrada, creamos el correo de recordatorio
    const batch = db.batch();
    
    snapshot.docs.forEach((doc) => {
      const appointment = doc.data();
      
      // Ignoramos a los clientes que el admin agendó en persona (no tienen email real)
      if (appointment.customerId === "manual") return;

      const mailRef = db.collection("mail").doc(); 
      batch.set(mailRef, {
        to: appointment.customerEmail,
        message: {
          subject: "⏰ Recordatorio: Tu cita en Barbas Cut's es en 6 horas",
          html: `
            <div style="font-family: sans-serif; color: #121212; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #D4AF37; border-radius: 10px;">
              <h1 style="color: #D4AF37;">¡Hola ${appointment.customerName}!</h1>
              <p>Este es un recordatorio automático. Tu cita para un nuevo estilo está a solo 6 horas de distancia.</p>
              <ul style="list-style: none; padding: 0;">
                <li>✂️ <strong>Servicio:</strong> ${appointment.serviceName}</li>
                <li>👨‍🎨 <strong>Barbero:</strong> ${appointment.barberName}</li>
                <li>⏰ <strong>Hora:</strong> ${appointment.time}</li>
              </ul>
              <p>¡Te esperamos con las tijeras listas!</p>
              <p><small style="color: #666;">Si surge algún imprevisto, recuerda que el tiempo límite para cancelar es de 8 horas antes de tu turno.</small></p>
            </div>
          `
        }
      });
    });

    // Guardamos todos los correos en la base de datos de un solo golpe
    await batch.commit();
    console.log(`✅ Se enviaron ${snapshot.size} recordatorios al motor de correos.`);

  } catch (error) {
    console.error("Error enviando recordatorios:", error);
  }
});
