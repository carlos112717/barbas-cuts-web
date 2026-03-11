import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  runTransaction,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import {
  buildTimeSlots,
  DEFAULT_BUSINESS_HOURS,
  getSlotLockId,
  normalizeBusinessHours,
  type BusinessHours,
} from "./scheduling";
import { buildCancellationEmail } from "./emailTemplates";

export interface AppointmentInput {
  customerId: string;
  customerName: string;
  customerEmail: string;
  barberId: string;
  barberName: string;
  serviceId: string;
  serviceName: string;
  price: number;
  date: string;
  time: string;
  status?: string;
}

export interface AppointmentRecord extends AppointmentInput {
  id: string;
  lockId?: string;
}

export const isActiveAppointmentStatus = (status: unknown) => {
  const normalized = typeof status === "string" ? status.toLowerCase() : "confirmed";
  return normalized !== "cancelled" && normalized !== "canceled" && normalized !== "cancelado";
};

export const createAppointmentWithLock = async (db: Firestore, appointment: AppointmentInput) => {
  const lockId = getSlotLockId(appointment.date, appointment.time, appointment.barberId);
  const lockRef = doc(db, "appointmentLocks", lockId);
  const appointmentRef = doc(collection(db, "appointments"));
  const closureRef = doc(db, "closures", appointment.date);
  const businessHoursRef = doc(db, "settings", "businessHours");
  const createdAt = new Date().toISOString();

  await runTransaction(db, async (transaction) => {
    const [lockSnap, closureSnap, businessHoursSnap] = await Promise.all([
      transaction.get(lockRef),
      transaction.get(closureRef),
      transaction.get(businessHoursRef),
    ]);

    if (lockSnap.exists()) {
      throw new Error("SLOT_TAKEN");
    }

    const configuredHours = normalizeBusinessHours(
      businessHoursSnap.exists() ? (businessHoursSnap.data() as Partial<BusinessHours>) : DEFAULT_BUSINESS_HOURS
    );
    const allowedSlots = new Set(buildTimeSlots({ ...configuredHours, slotMinutes: 60 }));
    if (!allowedSlots.has(appointment.time)) {
      throw new Error("SLOT_CLOSED");
    }

    if (closureSnap.exists()) {
      const closureData = closureSnap.data();
      const closedAllDay = closureData.closedAllDay === true;
      const blockedTimes = Array.isArray(closureData.blockedTimes)
        ? closureData.blockedTimes.filter((slot): slot is string => typeof slot === "string")
        : [];

      if (closedAllDay || blockedTimes.includes(appointment.time)) {
        throw new Error("SLOT_CLOSED");
      }
    }

    transaction.set(appointmentRef, {
      ...appointment,
      status: appointment.status ?? "confirmed",
      lockId,
      createdAt,
    });

    transaction.set(lockRef, {
      appointmentId: appointmentRef.id,
      customerId: appointment.customerId,
      barberId: appointment.barberId,
      date: appointment.date,
      time: appointment.time,
      createdAt,
    });
  });

  return { appointmentId: appointmentRef.id, lockId };
};

export const getBookedTimesForBarber = async (db: Firestore, date: string, barberId: string) => {
  const occupied = new Set<string>();
  const locksSnapshot = await getDocs(
    query(
      collection(db, "appointmentLocks"),
      where("date", "==", date),
      where("barberId", "==", barberId)
    )
  );

  locksSnapshot.forEach((lockDoc) => {
    const data = lockDoc.data();
    if (typeof data.time === "string" && data.time) {
      occupied.add(data.time);
    }
  });

  // Intento de respaldo para entornos con datos legacy sin lock.
  // Si el cliente no tiene permiso de lectura de "appointments",
  // seguimos funcionando con "appointmentLocks".
  try {
    const appointmentsSnapshot = await getDocs(
      query(
        collection(db, "appointments"),
        where("date", "==", date),
        where("barberId", "==", barberId)
      )
    );

    appointmentsSnapshot.forEach((appointmentDoc) => {
      const data = appointmentDoc.data();
      if (typeof data.time === "string" && data.time && isActiveAppointmentStatus(data.status)) {
        occupied.add(data.time);
      }
    });
  } catch {
    // No-op intencional: para clientes puede ser esperado por reglas.
  }

  return occupied;
};

interface DeleteAppointmentInput {
  appointmentId: string;
  lockId?: string;
  date?: string;
  time?: string;
  barberId?: string;
}

interface CancellationEmailInput {
  customerEmail: string;
  customerName: string;
  barberName: string;
  serviceName: string;
  date: string;
  time: string;
  canceledBy: "admin" | "customer";
}

const isValidEmail = (email: string) => {
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};

export const queueAppointmentCancellationEmail = async (
  db: Firestore,
  input: CancellationEmailInput
) => {
  if (!isValidEmail(input.customerEmail)) return false;
  const cancellationEmail = buildCancellationEmail({
    customerName: input.customerName,
    barberName: input.barberName,
    serviceName: input.serviceName,
    date: input.date,
    time: input.time,
    canceledBy: input.canceledBy,
  });

  await addDoc(collection(db, "mail"), {
    to: input.customerEmail.trim(),
    message: cancellationEmail,
  });

  return true;
};

export const deleteAppointmentAndLock = async (db: Firestore, input: DeleteAppointmentInput) => {
  const batch = writeBatch(db);
  batch.delete(doc(db, "appointments", input.appointmentId));

  const lockIds = new Set<string>();

  if (input.lockId) {
    lockIds.add(input.lockId);
  }

  if (!input.lockId && input.date && input.time && input.barberId) {
    lockIds.add(getSlotLockId(input.date, input.time, input.barberId));
  }

  if (lockIds.size === 0) {
    const locksByAppointment = await getDocs(
      query(collection(db, "appointmentLocks"), where("appointmentId", "==", input.appointmentId))
    );
    locksByAppointment.forEach((lockDoc) => lockIds.add(lockDoc.id));
  }

  lockIds.forEach((lockId) => {
    batch.delete(doc(db, "appointmentLocks", lockId));
  });

  await batch.commit();
};

export const deleteOnlyLockIfExists = async (db: Firestore, lockId: string) => {
  await deleteDoc(doc(db, "appointmentLocks", lockId));
};
