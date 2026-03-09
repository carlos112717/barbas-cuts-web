"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, addDoc, doc, getDoc } from "firebase/firestore"; // Importamos getDoc y doc
import { auth, db } from "../../lib/firebase";

// --- INTERFACES ---
interface Barber { id: string; name: string; bio: string; }
interface Service { id: string; name: string; price: number; durationMinutes: number; }

// --- DATOS DE PRUEBA (DUMMY) ---
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
  
  // Nuevo estado para guardar el nombre real traído de Firestore
  const [currentUserName, setCurrentUserName] = useState<string>("Cliente"); 
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Estados del flujo de reserva
  const [step, setStep] = useState(1);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Verificamos sesión y BUSCAMOS EL NOMBRE REAL EN FIRESTORE
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        // --- NUEVA LÓGICA: BUSCAR NOMBRE EN LA COLECCIÓN 'users' ---
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists() && userDocSnap.data().name) {
            setCurrentUserName(userDocSnap.data().name); // Guardamos su nombre real
          }
        } catch (error) {
          console.error("Error buscando nombre real en la reserva:", error);
        }
        
      } else {
        router.push("/");
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleBack = () => {
    if (step > 1 && step < 4) setStep(step - 1);
    else router.push("/home");
  };

// Función final: Guardar en Firestore y enviar correo
  const handleConfirmBooking = async () => {
    if (!user || !selectedBarber || !selectedService || !selectedDate || !selectedTime) return;
    
    setIsSaving(true);
    try {
      // 1. Guardamos la cita en la agenda
      await addDoc(collection(db, "appointments"), {
        customerId: user.uid,
        customerName: currentUserName, 
        customerEmail: user.email,
        barberId: selectedBarber.id,
        barberName: selectedBarber.name,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        price: selectedService.price,
        date: selectedDate,
        time: selectedTime,
        status: "confirmed",
        createdAt: new Date().toISOString()
      });

      // 2. DISPARAMOS EL CORREO DE CONFIRMACIÓN INMEDIATA
      await addDoc(collection(db, "mail"), {
        to: user.email,
        message: {
          subject: "Confirmación de tu cita en Barbas Cut's 💈",
          html: `
            <div style="font-family: sans-serif; color: #121212; max-w-md; margin: auto; padding: 20px; border: 1px solid #D4AF37; border-radius: 10px;">
              <h1 style="color: #D4AF37;">¡Hola ${currentUserName}!</h1>
              <p>Tu reserva ha sido confirmada con éxito. Aquí tienes los detalles:</p>
              <ul style="list-style: none; padding: 0;">
                <li>✂️ <strong>Servicio:</strong> ${selectedService.name}</li>
                <li>👨‍🎨 <strong>Barbero:</strong> ${selectedBarber.name}</li>
                <li>📅 <strong>Fecha:</strong> ${selectedDate}</li>
                <li>⏰ <strong>Hora:</strong> ${selectedTime}</li>
                <li>💰 <strong>Precio:</strong> ${selectedService.price}€</li>
              </ul>
              <p>Recuerda que si necesitas cancelar, debes hacerlo con al menos 8 horas de anticipación desde tu perfil.</p>
              <p>¡Te esperamos!</p>
            </div>
          `
        }
      });

      setStep(4);
    } catch (error) {
      console.error("Error al guardar la cita:", error);
      alert("Hubo un error al confirmar tu reserva.");
    } finally {
      setIsSaving(false);
    }
  };

  const getAvailableTimeSlots = () => {
    if (!selectedDate) return [];
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (selectedDate === today) {
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      return TIME_SLOTS.filter(time => {
        const [hourStr, minStr] = time.split(":");
        const hour = parseInt(hourStr, 10);
        const min = parseInt(minStr, 10);
        if (hour > currentHour) return true;
        if (hour === currentHour && min > currentMinute) return true;
        return false;
      });
    }
    return TIME_SLOTS;
  };

  const getTodayString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  if (loadingAuth) return <div className="min-h-screen bg-barbas-black flex items-center justify-center"><div className="w-12 h-12 border-4 border-barbas-gold border-t-transparent rounded-full animate-spin"></div></div>;

  const availableTimeSlots = getAvailableTimeSlots();

  return (
    <main className="min-h-screen bg-barbas-black p-6 text-white flex flex-col items-center">
      <div className="w-full max-w-md flex flex-col h-full min-h-[90vh]">
        <header className={`flex items-center mb-8 mt-2 ${step >= 4 ? 'hidden' : ''}`}>
          <button onClick={handleBack} className="text-barbas-gold p-2 hover:bg-white/10 rounded-full mr-3 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <h1 className="text-xl font-bold">
            {step === 1 && "Elige a tu Barbero"}
            {step === 2 && "Elige el Servicio"}
            {step === 3 && "Fecha y Hora"}
          </h1>
        </header>

        <div className="flex-1">
          <div className={step === 1 ? "flex flex-col gap-4" : "hidden"}>
            {DUMMY_BARBERS.map((barber) => (
              <button key={barber.id} onClick={() => { setSelectedBarber(barber); setStep(2); }} className="bg-barbas-dark border border-white/5 hover:border-barbas-gold rounded-xl p-4 flex items-center text-left transition-colors">
                <div className="w-12 h-12 bg-gray-600 rounded-full mr-4 flex-shrink-0"></div>
                <div><h2 className="font-bold text-lg">{barber.name}</h2><p className="text-gray-400 text-sm">{barber.bio}</p></div>
              </button>
            ))}
          </div>

          <div className={step === 2 ? "flex flex-col gap-4" : "hidden"}>
            {DUMMY_SERVICES.map((service) => (
              <button key={service.id} onClick={() => { setSelectedService(service); setStep(3); }} className="bg-barbas-dark border border-white/5 hover:border-barbas-gold rounded-xl p-4 flex justify-between items-center text-left transition-colors">
                <div><h2 className="font-bold text-lg">{service.name}</h2><p className="text-gray-400 text-sm">{service.durationMinutes} minutos</p></div>
                <span className="text-barbas-gold font-bold text-xl">{service.price}€</span>
              </button>
            ))}
          </div>

          <div className={step === 3 ? "flex flex-col gap-6" : "hidden"}>
            <div className="bg-barbas-dark p-4 rounded-xl border border-barbas-gold/30 shadow-inner">
              <p className="text-sm text-gray-400">Barbero: <span className="text-white font-semibold">{selectedBarber?.name}</span></p>
              <p className="text-sm text-gray-400">Servicio: <span className="text-white font-semibold">{selectedService?.name}</span></p>
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-2 block">Día de la cita</label>
              <input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime(""); }} min={getTodayString()} className="w-full bg-barbas-dark border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:border-barbas-gold appearance-none [color-scheme:dark]" />
            </div>

            {selectedDate && (
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Horarios disponibles</label>
                {availableTimeSlots.length === 0 ? (
                  <p className="text-red-400 text-sm text-center mt-4 border border-red-500/30 p-3 rounded-lg bg-red-950/20">Ya no hay turnos para hoy. Elige otro día.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {availableTimeSlots.map((time) => (
                      <button key={time} onClick={() => setSelectedTime(time)} className={`py-2 rounded-lg font-bold border transition-colors ${selectedTime === time ? "bg-barbas-gold text-barbas-black border-barbas-gold" : "bg-transparent text-barbas-gold border-barbas-gold hover:bg-barbas-gold/10"}`}>
                        {time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={step === 4 ? "flex flex-col items-center justify-center h-full text-center mt-20" : "hidden"}>
            <div className="w-24 h-24 bg-barbas-gold rounded-full flex items-center justify-center mb-6 shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-barbas-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h1 className="text-3xl font-bold text-barbas-gold mb-2">¡Reserva Confirmada!</h1>
            <p className="text-gray-400 mb-8">Te esperamos el {selectedDate} a las {selectedTime}.</p>
            <button onClick={() => router.push("/home")} className="bg-barbas-gold text-barbas-black font-bold py-3 px-8 rounded-lg hover:bg-yellow-500 transition-colors w-full shadow-md">VOLVER AL INICIO</button>
          </div>
        </div>

        <div className={step === 3 ? "w-full mt-6" : "hidden"}>
          <button onClick={handleConfirmBooking} disabled={!selectedDate || !selectedTime || isSaving} className="w-full bg-barbas-gold text-barbas-black font-bold text-lg py-4 rounded-xl hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
            {isSaving ? "CONFIRMANDO..." : "CONFIRMAR RESERVA"}
          </button>
        </div>
      </div>
    </main>
  );
}