"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { addDoc, collection, doc, getDoc, getDocs } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { createAppointmentWithLock, getBookedTimesForBarber } from "../../lib/appointments";
import { buildBookingConfirmationEmail } from "../../lib/emailTemplates";
import {
  buildTimeSlots,
  DEFAULT_BUSINESS_HOURS,
  normalizeBusinessHours,
  type BusinessHours,
} from "../../lib/scheduling";

interface Barber {
  id: string;
  name: string;
  bio: string;
  active?: boolean;
  photoURL?: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  active?: boolean;
}

interface ClosureDay {
  closedAllDay: boolean;
  blockedTimes: string[];
}

const getTodayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export default function BookingScreen() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [currentUserName, setCurrentUserName] = useState("Cliente");
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [catalogError, setCatalogError] = useState("");

  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHours>(DEFAULT_BUSINESS_HOURS);

  const [step, setStep] = useState(1);
  const [selectedBarberId, setSelectedBarberId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingClosure, setLoadingClosure] = useState(false);
  const [closureConfig, setClosureConfig] = useState<ClosureDay>({ closedAllDay: false, blockedTimes: [] });
  const [isSaving, setIsSaving] = useState(false);

  const activeBarbers = useMemo(() => barbers.filter((barber) => barber.active !== false), [barbers]);
  const activeServices = useMemo(() => services.filter((service) => service.active !== false), [services]);
  const selectedBarber = useMemo(
    () => activeBarbers.find((barber) => barber.id === selectedBarberId) ?? null,
    [activeBarbers, selectedBarberId]
  );
  const selectedService = useMemo(
    () => activeServices.find((service) => service.id === selectedServiceId) ?? null,
    [activeServices, selectedServiceId]
  );
  const timeSlots = useMemo(() => buildTimeSlots(businessHours), [businessHours]);

  const loadCatalog = async () => {
    const [barbersSnap, servicesSnap, settingsSnap] = await Promise.all([
      getDocs(collection(db, "barbers")),
      getDocs(collection(db, "services")),
      getDoc(doc(db, "settings", "businessHours")),
    ]);

    const nextBarbers: Barber[] = barbersSnap.docs
      .map((barberDoc) => {
        const data = barberDoc.data();
        return {
          id: barberDoc.id,
          name: typeof data.name === "string" ? data.name : "Barbero",
          bio: typeof data.bio === "string" ? data.bio : "",
          active: data.active !== false,
          photoURL: typeof data.photoURL === "string" ? data.photoURL : "",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const nextServices: Service[] = servicesSnap.docs
      .map((serviceDoc) => {
        const data = serviceDoc.data();
        return {
          id: serviceDoc.id,
          name: typeof data.name === "string" ? data.name : "Servicio",
          price: typeof data.price === "number" ? data.price : 0,
          durationMinutes: typeof data.durationMinutes === "number" ? data.durationMinutes : 60,
          active: data.active !== false,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const nextBusinessHours = normalizeBusinessHours(settingsSnap.exists() ? (settingsSnap.data() as Partial<BusinessHours>) : undefined);

    setBarbers(nextBarbers);
    setServices(nextServices);
    setBusinessHours({ ...nextBusinessHours, slotMinutes: 60 });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/");
        setLoadingAuth(false);
        return;
      }

      setUser(currentUser);
      try {
        const [userDoc] = await Promise.all([getDoc(doc(db, "users", currentUser.uid)), loadCatalog()]);
        if (userDoc.exists() && typeof userDoc.data().name === "string") {
          setCurrentUserName(userDoc.data().name);
        }
        setCatalogError("");
      } catch (error) {
        console.error("Error loading booking catalog:", error);
        setCatalogError("No se pudo cargar la disponibilidad. Recarga la pagina.");
      } finally {
        setLoadingAuth(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (selectedBarberId && activeBarbers.some((barber) => barber.id === selectedBarberId)) {
      return;
    }
    setSelectedBarberId(activeBarbers[0]?.id ?? "");
  }, [activeBarbers, selectedBarberId]);

  useEffect(() => {
    if (selectedServiceId && activeServices.some((service) => service.id === selectedServiceId)) {
      return;
    }
    setSelectedServiceId(activeServices[0]?.id ?? "");
  }, [activeServices, selectedServiceId]);

  useEffect(() => {
    let isMounted = true;

    const loadClosure = async () => {
      if (!selectedDate) {
        setClosureConfig({ closedAllDay: false, blockedTimes: [] });
        return;
      }

      setLoadingClosure(true);
      try {
        const closureSnap = await getDoc(doc(db, "closures", selectedDate));
        if (!isMounted) return;

        if (!closureSnap.exists()) {
          setClosureConfig({ closedAllDay: false, blockedTimes: [] });
          return;
        }

        const data = closureSnap.data();
        setClosureConfig({
          closedAllDay: data.closedAllDay === true,
          blockedTimes: Array.isArray(data.blockedTimes)
            ? data.blockedTimes.filter((slot): slot is string => typeof slot === "string")
            : [],
        });
      } catch (error) {
        if (!isMounted) return;
        console.error("Error loading closure config:", error);
        setClosureConfig({ closedAllDay: false, blockedTimes: [] });
      } finally {
        if (isMounted) {
          setLoadingClosure(false);
        }
      }
    };

    loadClosure();

    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  useEffect(() => {
    let isMounted = true;

    const loadBookedTimes = async () => {
      if (!selectedDate || !selectedBarberId) {
        setBookedTimes([]);
        setSelectedTime("");
        return;
      }

      setLoadingSlots(true);
      try {
        const occupied = await getBookedTimesForBarber(db, selectedDate, selectedBarberId);
        if (!isMounted) return;

        setBookedTimes(Array.from(occupied));
        setSelectedTime((prev) => (occupied.has(prev) ? "" : prev));
      } catch (error) {
        if (!isMounted) return;
        console.error("Error loading occupied slots:", error);
        setBookedTimes([]);
      } finally {
        if (isMounted) {
          setLoadingSlots(false);
        }
      }
    };

    loadBookedTimes();

    return () => {
      isMounted = false;
    };
  }, [selectedDate, selectedBarberId]);

  const slotStates = useMemo(() => {
    if (!selectedDate) return [];

    const now = new Date();
    const blockedByClosure = new Set(closureConfig.blockedTimes);

    return timeSlots.map((slot) => {
      const [hourStr, minuteStr] = slot.split(":");
      const slotDate = new Date(selectedDate);
      slotDate.setHours(parseInt(hourStr, 10), parseInt(minuteStr, 10), 0, 0);

      const isPast = selectedDate === getTodayString() && slotDate.getTime() <= now.getTime();
      const isUnavailable =
        closureConfig.closedAllDay ||
        blockedByClosure.has(slot) ||
        bookedTimes.includes(slot) ||
        isPast;

      return { slot, isUnavailable };
    });
  }, [bookedTimes, closureConfig, selectedDate, timeSlots]);

  const availableTimeSlots = useMemo(
    () => slotStates.filter((slotState) => !slotState.isUnavailable).map((slotState) => slotState.slot),
    [slotStates]
  );

  useEffect(() => {
    if (!selectedTime) return;
    const selectedState = slotStates.find((slotState) => slotState.slot === selectedTime);
    if (selectedState?.isUnavailable) {
      setSelectedTime("");
    }
  }, [selectedTime, slotStates]);

  const handleBack = () => {
    if (step > 1 && step < 4) {
      setStep(step - 1);
      return;
    }
    router.push("/home");
  };

  const handleConfirmBooking = async () => {
    if (!user || !selectedBarber || !selectedService || !selectedDate || !selectedTime) return;
    const selectedSlotState = slotStates.find((slotState) => slotState.slot === selectedTime);
    if (!selectedSlotState || selectedSlotState.isUnavailable) {
      alert("Ese horario no esta disponible.");
      setSelectedTime("");
      return;
    }

    const customerEmail = user.email?.trim();
    if (!customerEmail) {
      alert("No hay un correo valido en tu cuenta.");
      return;
    }

    const appointmentDateTime = new Date(`${selectedDate}T${selectedTime}:00`);
    if (appointmentDateTime.getTime() <= Date.now()) {
      alert("La fecha y hora seleccionadas ya pasaron.");
      return;
    }

    setIsSaving(true);
    try {
      await createAppointmentWithLock(db, {
        customerId: user.uid,
        customerName: currentUserName,
        customerEmail,
        barberId: selectedBarber.id,
        barberName: selectedBarber.name,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        price: selectedService.price,
        date: selectedDate,
        time: selectedTime,
        status: "confirmed",
      });

      const confirmationEmail = buildBookingConfirmationEmail({
        customerName: currentUserName,
        barberName: selectedBarber.name,
        serviceName: selectedService.name,
        date: selectedDate,
        time: selectedTime,
        price: selectedService.price,
      });

      await addDoc(collection(db, "mail"), {
        to: customerEmail,
        message: confirmationEmail,
      });

      setBookedTimes((prev) => (prev.includes(selectedTime) ? prev : [...prev, selectedTime]));
      setStep(4);
    } catch (error) {
      if (error instanceof Error && error.message === "SLOT_TAKEN") {
        alert("Ese horario ya fue reservado por otro cliente. Elige otro.");
        setSelectedTime("");
      } else if (error instanceof Error && error.message === "SLOT_CLOSED") {
        alert("Ese horario fue bloqueado por la barberia. Elige otro.");
        setSelectedTime("");
      } else {
        console.error("Error creating appointment:", error);
        alert("Hubo un error al confirmar la reserva.");
      }
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
        <header className={`flex items-center mb-8 mt-2 ${step >= 4 ? "hidden" : ""}`}>
          <button onClick={handleBack} className="text-barbas-gold p-2 hover:bg-white/10 rounded-full mr-3 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <h1 className="text-xl font-bold">
            {step === 1 && "Elige a tu barbero"}
            {step === 2 && "Elige el servicio"}
            {step === 3 && "Fecha y hora"}
          </h1>
        </header>

        {catalogError && <p className="text-red-400 text-sm mb-4">{catalogError}</p>}

        <div className="flex-1">
          <div className={step === 1 ? "flex flex-col gap-4" : "hidden"}>
            {activeBarbers.length === 0 ? (
              <p className="text-gray-400">No hay barberos activos. Contacta al administrador.</p>
            ) : (
              activeBarbers.map((barber) => (
                <button
                  key={barber.id}
                  onClick={() => {
                    setSelectedBarberId(barber.id);
                    setStep(2);
                  }}
                  className="bg-barbas-dark border border-white/5 hover:border-barbas-gold rounded-xl p-4 flex items-center text-left transition-colors"
                >
                  <div className="w-12 h-12 bg-gray-600 rounded-full mr-4 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {barber.photoURL ? (
                      <img src={barber.photoURL} alt={barber.name} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div>
                    <h2 className="font-bold text-lg">{barber.name}</h2>
                    <p className="text-gray-400 text-sm">{barber.bio || "Barbero profesional"}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className={step === 2 ? "flex flex-col gap-4" : "hidden"}>
            {activeServices.length === 0 ? (
              <p className="text-gray-400">No hay servicios activos. Contacta al administrador.</p>
            ) : (
              activeServices.map((service) => (
                <button
                  key={service.id}
                  onClick={() => {
                    setSelectedServiceId(service.id);
                    setStep(3);
                  }}
                  className="bg-barbas-dark border border-white/5 hover:border-barbas-gold rounded-xl p-4 flex justify-between items-center text-left transition-colors"
                >
                  <div>
                    <h2 className="font-bold text-lg">{service.name}</h2>
                    <p className="text-gray-400 text-sm">{service.durationMinutes} minutos</p>
                  </div>
                  <span className="text-barbas-gold font-bold text-xl">{service.price} EUR</span>
                </button>
              ))
            )}
          </div>

          <div className={step === 3 ? "flex flex-col gap-6" : "hidden"}>
            <div className="bg-barbas-dark p-4 rounded-xl border border-barbas-gold/30 shadow-inner">
              <p className="text-sm text-gray-400">Barbero: <span className="text-white font-semibold">{selectedBarber?.name}</span></p>
              <p className="text-sm text-gray-400">Servicio: <span className="text-white font-semibold">{selectedService?.name}</span></p>
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-2 block">Dia de la cita</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  setSelectedDate(event.target.value);
                  setSelectedTime("");
                }}
                min={getTodayString()}
                className="w-full bg-barbas-dark border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:border-barbas-gold appearance-none [color-scheme:dark]"
              />
            </div>

            {selectedDate && (
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Horarios disponibles</label>
                {(loadingSlots || loadingClosure) && <p className="text-gray-400 text-sm text-center mt-4">Cargando disponibilidad...</p>}

                <div className="flex items-center gap-4 text-xs text-gray-300 mb-3">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded border border-barbas-gold"></span>
                    Disponible
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-barbas-gold border border-barbas-gold"></span>
                    No disponible
                  </span>
                </div>

                {closureConfig.closedAllDay && (
                  <p className="text-red-300 text-sm mb-3 border border-red-500/30 p-2 rounded-lg bg-red-950/20">
                    La barberia estara cerrada este dia.
                  </p>
                )}

                {slotStates.length === 0 ? (
                  <p className="text-red-400 text-sm text-center mt-4 border border-red-500/30 p-3 rounded-lg bg-red-950/20">No hay horarios cargados.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {slotStates.map(({ slot, isUnavailable }) => {
                      const isSelected = selectedTime === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => {
                            if (!isUnavailable) setSelectedTime(slot);
                          }}
                          disabled={isUnavailable}
                          className={`py-2 rounded-lg font-bold border transition-colors ${
                            isUnavailable
                              ? "bg-barbas-gold text-barbas-black border-barbas-gold cursor-not-allowed opacity-80"
                              : isSelected
                                ? "bg-barbas-dark text-barbas-gold border-barbas-gold ring-1 ring-barbas-gold"
                                : "bg-transparent text-barbas-gold border-barbas-gold hover:bg-barbas-gold/10"
                          }`}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                )}
                {availableTimeSlots.length === 0 && (
                  <p className="text-red-300 text-sm mt-3">No quedan horas disponibles para esta fecha.</p>
                )}
              </div>
            )}
          </div>

          <div className={step === 4 ? "flex flex-col items-center justify-center h-full text-center mt-20" : "hidden"}>
            <div className="w-24 h-24 bg-barbas-gold rounded-full flex items-center justify-center mb-6 shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-barbas-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h1 className="text-3xl font-bold text-barbas-gold mb-2">Reserva confirmada</h1>
            <p className="text-gray-400 mb-8">Te esperamos el {selectedDate} a las {selectedTime}.</p>
            <button onClick={() => router.push("/home")} className="bg-barbas-gold text-barbas-black font-bold py-3 px-8 rounded-lg hover:bg-yellow-500 transition-colors w-full shadow-md">VOLVER AL INICIO</button>
          </div>
        </div>

        <div className={step === 3 ? "w-full mt-6" : "hidden"}>
          <button
            onClick={handleConfirmBooking}
            disabled={!selectedDate || !selectedTime || isSaving || loadingSlots || loadingClosure || !selectedBarber || !selectedService}
            className="w-full bg-barbas-gold text-barbas-black font-bold text-lg py-4 rounded-xl hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isSaving ? "CONFIRMANDO..." : "CONFIRMAR RESERVA"}
          </button>
        </div>
      </div>
    </main>
  );
}
