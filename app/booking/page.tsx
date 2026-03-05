"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

// --- INTERFACES (TypeScript Estricto) ---
interface Barber {
  id: string;
  name: string;
  bio: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
}

// --- DATOS DE PRUEBA (Luego se pueden traer de Firebase) ---
const DUMMY_BARBERS: Barber[] = [
  { id: "1", name: "Carlos El Bravo", bio: "Experto en navaja clásica" },
  { id: "2", name: "Dra. Cortes", bio: "Estilista moderna y color" },
  { id: "3", name: "Juan Fade", bio: "El rey del degradado perfecto" },
];

const DUMMY_SERVICES: Service[] = [
  { id: "1", name: "Corte Clásico", price: 15, durationMinutes: 30 },
  { id: "2", name: "Barba y Toalla Caliente", price: 12, durationMinutes: 20 },
  { id: "3", name: "Servicio Completo VIP", price: 25, durationMinutes: 50 },
];

const TIME_SLOTS = ["09:00", "09:30", "10:00", "10:30", "11:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

export default function BookingScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Estados del flujo de reserva
  const [step, setStep] = useState(1);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [minDate, setMinDate] = useState<string>("");

  useEffect(() => {
    // Para evitar errores de hidratación SSR, la fecha mínima se establece en el cliente
    setMinDate(new Date().toISOString().split("T")[0]);
  }, []);

  // Verificar sesión
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push("/");
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Función para volver atrás en los pasos o al Home
  const handleBack = () => {
    if (step > 1 && step < 4) {
      setStep(step - 1);
    } else {
      router.push("/home");
    }
  };

  // Función final: Guardar en Firestore
  const handleConfirmBooking = async () => {
    if (!user || !selectedBarber || !selectedService || !selectedDate || !selectedTime) return;
    
    setIsSaving(true);
    try {
      await addDoc(collection(db, "appointments"), {
        customerId: user.uid,
        customerName: user.displayName || "Cliente",
        customerEmail: user.email,
        barberId: selectedBarber.id,
        barberName: selectedBarber.name,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        price: selectedService.price,
        date: selectedDate, // Formato YYYY-MM-DD
        time: selectedTime,
        status: "confirmed",
        createdAt: new Date().toISOString()
      });
      setStep(4); // Pantalla de éxito
    } catch (error) {
      console.error("Error al guardar la cita:", error);
      alert("Hubo un error al confirmar tu reserva. Inténtalo de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-barbas-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-barbas-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-barbas-black p-6 text-white flex flex-col items-center">
      <div className="w-full max-w-md flex flex-col h-full min-h-[90vh]">
        
        {/* --- HEADER --- */}
        {step < 4 && (
          <header className="flex items-center mb-8 mt-2">
            <button onClick={handleBack} className="text-barbas-gold p-2 hover:bg-white/10 rounded-full mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-xl font-bold">
              {step === 1 && "Elige a tu Barbero"}
              {step === 2 && "Elige el Servicio"}
              {step === 3 && "Fecha y Hora"}
            </h1>
          </header>
        )}

        {/* --- CONTENIDO DINÁMICO --- */}
        <div className="flex-1">
          
          {/* PASO 1: BARBEROS */}
          {step === 1 && (
            <div key="step-1" className="flex flex-col gap-4">
              {DUMMY_BARBERS.map((barber) => (
                <button
                  key={barber.id}
                  onClick={() => { setSelectedBarber(barber); setStep(2); }}
                  className="bg-barbas-dark border border-white/5 hover:border-barbas-gold rounded-xl p-4 flex items-center text-left transition-colors"
                >
                  <div className="w-12 h-12 bg-gray-600 rounded-full mr-4 flex-shrink-0"></div>
                  <div>
                    <h2 className="font-bold text-lg">{barber.name}</h2>
                    <p className="text-gray-400 text-sm">{barber.bio}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* PASO 2: SERVICIOS */}
          {step === 2 && (
            <div key="step-2" className="flex flex-col gap-4">
              {DUMMY_SERVICES.map((service) => (
                <button
                  key={service.id}
                  onClick={() => { setSelectedService(service); setStep(3); }}
                  className="bg-barbas-dark border border-white/5 hover:border-barbas-gold rounded-xl p-4 flex justify-between items-center text-left transition-colors"
                >
                  <div>
                    <h2 className="font-bold text-lg">{service.name}</h2>
                    <p className="text-gray-400 text-sm">{service.durationMinutes} minutos</p>
                  </div>
                  <span className="text-barbas-gold font-bold text-xl">{service.price}€</span>
                </button>
              ))}
            </div>
          )}

          {/* PASO 3: FECHA Y HORA */}
          {step === 3 && (
            <div key="step-3" className="flex flex-col gap-6">
              
              {/* Resumen Selección */}
              <div className="bg-barbas-dark p-4 rounded-xl border border-barbas-gold/30">
                <p className="text-sm text-gray-400">Barbero: <span className="text-white font-semibold">{selectedBarber?.name}</span></p>
                <p className="text-sm text-gray-400">Servicio: <span className="text-white font-semibold">{selectedService?.name}</span></p>
              </div>

              {/* Selector de Fecha Nativo */}
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Día de la cita</label>
                <input 
                  type="date"
                  value={selectedDate}
                  onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime(""); }}
                  // Evita seleccionar fechas pasadas (hoy en adelante)
                  min={minDate} 
                  className="w-full bg-barbas-dark border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:border-barbas-gold appearance-none"
                />
              </div>

              {/* Selector de Horas */}
              {selectedDate && (
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Horarios disponibles</label>
                  <div className="grid grid-cols-3 gap-3">
                    {TIME_SLOTS.map((time) => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`py-2 rounded-lg font-bold border transition-colors ${
                          selectedTime === time 
                          ? "bg-barbas-gold text-barbas-black border-barbas-gold" 
                          : "bg-transparent text-barbas-gold border-barbas-gold hover:bg-barbas-gold/10"
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PASO 4: ÉXITO */}
          {step === 4 && (
            <div key="step-4" className="flex flex-col items-center justify-center h-full text-center mt-20">
              <div className="w-24 h-24 bg-barbas-gold rounded-full flex items-center justify-center mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-barbas-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-barbas-gold mb-2">¡Reserva Confirmada!</h1>
              <p className="text-gray-400 mb-8">Te esperamos en la barbería el {selectedDate} a las {selectedTime}.</p>
              
              <button
                onClick={() => router.push("/home")}
                className="bg-barbas-gold text-barbas-black font-bold py-3 px-8 rounded-lg hover:bg-yellow-500 transition-colors w-full"
              >
                VOLVER AL INICIO
              </button>
            </div>
          )}

        </div>

        {/* --- BOTÓN DE CONFIRMAR (Solo visible en Paso 3) --- */}
        {step === 3 && (
          <button
            onClick={handleConfirmBooking}
            disabled={!selectedDate || !selectedTime || isSaving}
            className="w-full bg-barbas-gold text-barbas-black font-bold text-lg py-4 rounded-xl mt-6 hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "CONFIRMANDO..." : "CONFIRMAR RESERVA"}
          </button>
        )}

      </div>
    </main>
  );
}