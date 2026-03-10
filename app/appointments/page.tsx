"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import {
  deleteAppointmentAndLock,
  queueAppointmentCancellationEmail,
} from "../../lib/appointments";

interface Appointment {
  id: string;
  customerName?: string;
  customerEmail?: string;
  barberId?: string;
  barberName: string;
  serviceName: string;
  price: number;
  date: string;
  time: string;
  status: string;
  lockId?: string;
}

export default function AppointmentsScreen() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        void fetchAppointments(currentUser.uid);
      } else {
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchAppointments = async (userId: string) => {
    try {
      const q = query(collection(db, "appointments"), where("customerId", "==", userId));
      const querySnapshot = await getDocs(q);

      const apps: Appointment[] = [];
      querySnapshot.forEach((document) => {
        apps.push({ id: document.id, ...document.data() } as Appointment);
      });

      apps.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}:00`).getTime();
        const dateB = new Date(`${b.date}T${b.time}:00`).getTime();
        return dateB - dateA;
      });

      setAppointments(apps);
    } catch (error) {
      console.error("Error al obtener citas:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (appointment: Appointment) => {
    const appointmentDate = new Date(`${appointment.date}T${appointment.time}:00`);
    const now = new Date();
    const diffInHours = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 0) {
      alert("No puedes cancelar una cita que ya ocurrio o esta ocurriendo.");
      return;
    }

    if (diffInHours < 8) {
      alert("No puedes cancelar una cita con menos de 8 horas de antelacion. Contactanos por WhatsApp.");
      return;
    }

    if (!window.confirm("Estas seguro de que deseas cancelar esta cita?")) return;

    setCancelingId(appointment.id);
    try {
      await deleteAppointmentAndLock(db, {
        appointmentId: appointment.id,
        lockId: appointment.lockId,
        date: appointment.date,
        time: appointment.time,
        barberId: appointment.barberId,
      });

      await queueAppointmentCancellationEmail(db, {
        customerEmail: appointment.customerEmail || "",
        customerName: appointment.customerName || "cliente",
        barberName: appointment.barberName || "barbero",
        serviceName: appointment.serviceName || "servicio",
        date: appointment.date,
        time: appointment.time,
        canceledBy: "customer",
      });

      setAppointments((prev) => prev.filter((app) => app.id !== appointment.id));
      alert("Cita cancelada correctamente.");
    } catch (error) {
      console.error("Error al cancelar:", error);
      alert("Hubo un error al cancelar. Intentalo de nuevo.");
    } finally {
      setCancelingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-barbas-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-barbas-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-barbas-black p-6">
      <div className="max-w-md mx-auto">
        <header className="flex items-center mb-8 mt-2">
          <button
            onClick={() => router.push("/home")}
            className="text-barbas-gold p-2 hover:bg-white/10 rounded-full mr-3 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-white">Mis Citas</h1>
        </header>

        {appointments.length === 0 ? (
          <div className="text-center mt-20 flex flex-col items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 text-gray-600 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-gray-400 text-lg">No tienes citas programadas.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {appointments.map((app) => (
              <div key={app.id} className="bg-barbas-dark border border-white/10 rounded-xl p-5 shadow-lg">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-white font-bold text-lg">{app.serviceName}</h2>
                    <p className="text-gray-400 text-sm">Con {app.barberName}</p>
                  </div>
                  <span className="text-barbas-gold font-bold text-lg">{app.price} EUR</span>
                </div>

                <hr className="border-white/5 mb-4" />

                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center text-gray-300">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2 text-barbas-gold"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="font-medium">{app.date}</span>
                  </div>
                  <div className="flex items-center text-gray-300">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2 text-barbas-gold"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">{app.time}</span>
                  </div>
                </div>

                <button
                  onClick={() => void handleCancel(app)}
                  disabled={cancelingId === app.id}
                  className="w-full border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white font-semibold py-2 rounded-lg transition-colors flex justify-center items-center disabled:opacity-50"
                >
                  {cancelingId === app.id ? <span className="animate-pulse">Cancelando...</span> : "Cancelar Cita"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
