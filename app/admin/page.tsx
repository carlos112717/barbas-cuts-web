"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../../lib/firebase";
import {
  createAppointmentWithLock,
  deleteAppointmentAndLock,
  getBookedTimesForBarber,
  queueAppointmentCancellationEmail,
} from "../../lib/appointments";
import { buildTimeSlots, DEFAULT_BUSINESS_HOURS, normalizeBusinessHours, type BusinessHours } from "../../lib/scheduling";

interface Appointment {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerPhotoURL?: string;
  barberId: string;
  barberName: string;
  serviceId: string;
  serviceName: string;
  price: number;
  date: string;
  time: string;
  lockId?: string;
}

interface Barber {
  id: string;
  name: string;
  bio: string;
  active: boolean;
  photoURL?: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  active: boolean;
}

interface ClosureDay {
  date: string;
  closedAllDay: boolean;
  blockedTimes: string[];
}

interface AvailabilitySlot {
  slot: string;
  blockedByClosure: boolean;
  isPast: boolean;
  occupiedCount: number;
  freeCount: number;
  isUnavailable: boolean;
}

const hourOptions = Array.from({ length: 18 }, (_, index) => index + 6);

const getToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const sortAppointments = (items: Appointment[]) => {
  return [...items].sort((a, b) => new Date(`${a.date}T${a.time}:00`).getTime() - new Date(`${b.date}T${b.time}:00`).getTime());
};

const getWhatsAppLink = (phone: string | undefined) => {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("00") ? digits.slice(2) : digits;
  if (normalized.length < 8) return "";
  return `https://wa.me/${normalized}`;
};

export default function AdminDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [closures, setClosures] = useState<ClosureDay[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHours>(DEFAULT_BUSINESS_HOURS);
  const [hoursDraft, setHoursDraft] = useState<BusinessHours>(DEFAULT_BUSINESS_HOURS);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newBarberId, setNewBarberId] = useState("");
  const [newServiceId, setNewServiceId] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [bookedManualTimes, setBookedManualTimes] = useState<string[]>([]);
  const [loadingManualSlots, setLoadingManualSlots] = useState(false);
  const [selectedAppointmentIds, setSelectedAppointmentIds] = useState<string[]>([]);

  const [newBarberName, setNewBarberName] = useState("");
  const [newBarberBio, setNewBarberBio] = useState("");
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("15");
  const [closureDate, setClosureDate] = useState(getToday());
  const [closureClosedAllDay, setClosureClosedAllDay] = useState(false);
  const [closureBlockedTimes, setClosureBlockedTimes] = useState<string[]>([]);
  const [availabilityDate, setAvailabilityDate] = useState(getToday());
  const [availabilityBarberId, setAvailabilityBarberId] = useState("all");
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityRefreshKey, setAvailabilityRefreshKey] = useState(0);

  const [isSaving, setIsSaving] = useState(false);

  const activeBarbers = useMemo(() => barbers.filter((item) => item.active), [barbers]);
  const activeServices = useMemo(() => services.filter((item) => item.active), [services]);
  const manualSlots = useMemo(() => buildTimeSlots({ ...businessHours, slotMinutes: 60 }), [businessHours]);
  const allAppointmentsSelected = appointments.length > 0 && selectedAppointmentIds.length === appointments.length;
  const availabilitySummary = useMemo(() => {
    const available = availabilitySlots.filter((entry) => !entry.isUnavailable).length;
    return {
      total: availabilitySlots.length,
      available,
      unavailable: availabilitySlots.length - available,
    };
  }, [availabilitySlots]);
  const closuresByDate = useMemo(() => {
    const map = new Map<string, ClosureDay>();
    closures.forEach((closure) => map.set(closure.date, closure));
    return map;
  }, [closures]);

  const getBlockedTimesForDate = useCallback((date: string, slots: string[]) => {
    const closure = closuresByDate.get(date);
    if (!closure) return new Set<string>();
    if (closure.closedAllDay) return new Set(slots);
    return new Set(closure.blockedTimes);
  }, [closuresByDate]);

  const loadData = async () => {
    const [appointmentsSnap, barbersSnap, servicesSnap, closuresSnap, settingsSnap] = await Promise.all([
      getDocs(collection(db, "appointments")),
      getDocs(collection(db, "barbers")),
      getDocs(collection(db, "services")),
      getDocs(collection(db, "closures")),
      getDoc(doc(db, "settings", "businessHours")),
    ]);

    const mappedAppointments: Appointment[] = appointmentsSnap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        customerId: typeof data.customerId === "string" ? data.customerId : "",
        customerName: typeof data.customerName === "string" ? data.customerName : "Cliente",
        customerEmail: typeof data.customerEmail === "string" ? data.customerEmail : "",
        customerPhone: typeof data.customerPhone === "string" ? data.customerPhone : "",
        customerPhotoURL: typeof data.customerPhotoURL === "string" ? data.customerPhotoURL : "",
        barberId: typeof data.barberId === "string" ? data.barberId : "",
        barberName: typeof data.barberName === "string" ? data.barberName : "",
        serviceId: typeof data.serviceId === "string" ? data.serviceId : "",
        serviceName: typeof data.serviceName === "string" ? data.serviceName : "",
        price: typeof data.price === "number" ? data.price : 0,
        date: typeof data.date === "string" ? data.date : "",
        time: typeof data.time === "string" ? data.time : "",
        lockId: typeof data.lockId === "string" ? data.lockId : undefined,
      };
    });

    const customerIds = Array.from(
      new Set(mappedAppointments.map((appointment) => appointment.customerId).filter((id) => id && id !== "manual"))
    );
    const customerDataById = new Map<string, { name: string; phone: string; photoURL: string }>();

    if (customerIds.length > 0) {
      const customerSnapshots = await Promise.all(customerIds.map((customerId) => getDoc(doc(db, "users", customerId))));
      customerSnapshots.forEach((snap, index) => {
        if (!snap.exists()) return;
        const data = snap.data();
        customerDataById.set(customerIds[index], {
          name: typeof data.name === "string" ? data.name : "",
          phone: typeof data.phone === "string" ? data.phone : "",
          photoURL: typeof data.photoURL === "string" ? data.photoURL : "",
        });
      });
    }

    const enrichedAppointments = mappedAppointments.map((appointment) => {
      const customerData = customerDataById.get(appointment.customerId);
      return {
        ...appointment,
        customerName: appointment.customerName || customerData?.name || "Cliente",
        customerPhone: appointment.customerPhone || customerData?.phone || "",
        customerPhotoURL: appointment.customerPhotoURL || customerData?.photoURL || "",
      };
    });

    const mappedBarbers: Barber[] = barbersSnap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: String(data.name ?? "Barbero"),
        bio: String(data.bio ?? ""),
        active: data.active !== false,
        photoURL: typeof data.photoURL === "string" ? data.photoURL : "",
      };
    });

    const mappedServices: Service[] = servicesSnap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: String(data.name ?? "Servicio"),
        price: typeof data.price === "number" ? data.price : 0,
        durationMinutes: typeof data.durationMinutes === "number" ? data.durationMinutes : 60,
        active: data.active !== false,
      };
    });

    const mappedClosures: ClosureDay[] = closuresSnap.docs
      .map((docSnap) => {
        const data = docSnap.data();
        return {
          date: typeof data.date === "string" ? data.date : docSnap.id,
          closedAllDay: data.closedAllDay === true,
          blockedTimes: Array.isArray(data.blockedTimes)
            ? data.blockedTimes.filter((slot) => typeof slot === "string")
            : [],
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const normalizedHours = normalizeBusinessHours(settingsSnap.exists() ? (settingsSnap.data() as Partial<BusinessHours>) : undefined);

    setAppointments(sortAppointments(enrichedAppointments));
    setBarbers(mappedBarbers.sort((a, b) => a.name.localeCompare(b.name)));
    setServices(mappedServices.sort((a, b) => a.name.localeCompare(b.name)));
    setClosures(mappedClosures);
    setBusinessHours({ ...normalizedHours, slotMinutes: 60 });
    setHoursDraft({ ...normalizedHours, slotMinutes: 60 });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/");
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (!userDoc.exists() || userDoc.data().role !== "admin") {
          router.push("/home");
          setLoading(false);
          return;
        }

        setIsAdmin(true);
        await loadData();
      } catch (error) {
        console.error(error);
        router.push("/home");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!isModalOpen) return;
    if (!newBarberId) setNewBarberId(activeBarbers[0]?.id ?? "");
    if (!newServiceId) setNewServiceId(activeServices[0]?.id ?? "");
    if (!newTime) setNewTime(manualSlots[0] ?? "");
  }, [isModalOpen, activeBarbers, activeServices, newBarberId, newServiceId, newTime, manualSlots]);

  useEffect(() => {
    if (availabilityBarberId === "all") return;
    if (!activeBarbers.some((barber) => barber.id === availabilityBarberId)) {
      setAvailabilityBarberId("all");
    }
  }, [availabilityBarberId, activeBarbers]);

  useEffect(() => {
    const closure = closuresByDate.get(closureDate);
    if (!closure) {
      setClosureClosedAllDay(false);
      setClosureBlockedTimes([]);
      return;
    }

    setClosureClosedAllDay(closure.closedAllDay);
    setClosureBlockedTimes(closure.blockedTimes.filter((slot) => manualSlots.includes(slot)));
  }, [closureDate, closuresByDate, manualSlots]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!isModalOpen || !newDate || !newBarberId) {
        setBookedManualTimes([]);
        return;
      }

      setLoadingManualSlots(true);
      try {
        const occupied = await getBookedTimesForBarber(db, newDate, newBarberId);
        const blockedByClosure = getBlockedTimesForDate(newDate, manualSlots);
        const unavailable = new Set<string>([...occupied, ...blockedByClosure]);
        if (!mounted) return;
        setBookedManualTimes(Array.from(unavailable));
        setNewTime((prev) => (prev && !unavailable.has(prev) ? prev : manualSlots.find((slot) => !unavailable.has(slot)) ?? ""));
      } catch (error) {
        if (!mounted) return;
        console.error("Error loading manual slot availability:", error);
        setBookedManualTimes([]);
      } finally {
        if (mounted) setLoadingManualSlots(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [getBlockedTimesForDate, isModalOpen, newDate, newBarberId, manualSlots]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!availabilityDate || manualSlots.length === 0) {
        setAvailabilitySlots([]);
        return;
      }

      setLoadingAvailability(true);
      try {
        const blockedByClosure = getBlockedTimesForDate(availabilityDate, manualSlots);
        const now = new Date();
        const isToday = availabilityDate === getToday();

        if (availabilityBarberId === "all") {
          const activeBarberIds = activeBarbers.map((barber) => barber.id);
          const occupiedByBarber = await Promise.all(
            activeBarberIds.map((barberId) => getBookedTimesForBarber(db, availabilityDate, barberId))
          );

          const nextSlots = manualSlots.map((slot) => {
            const [hour, minute] = slot.split(":").map((value) => Number(value));
            const slotDate = new Date(availabilityDate);
            slotDate.setHours(hour, minute, 0, 0);

            let occupiedCount = 0;
            occupiedByBarber.forEach((occupiedSet) => {
              if (occupiedSet.has(slot)) occupiedCount += 1;
            });

            const freeCount = Math.max(activeBarberIds.length - occupiedCount, 0);
            const isPast = isToday && slotDate.getTime() <= now.getTime();
            const blocked = blockedByClosure.has(slot);
            const isUnavailable = blocked || isPast || freeCount === 0;

            return {
              slot,
              blockedByClosure: blocked,
              isPast,
              occupiedCount,
              freeCount,
              isUnavailable,
            };
          });

          if (!mounted) return;
          setAvailabilitySlots(nextSlots);
          return;
        }

        const occupied = await getBookedTimesForBarber(db, availabilityDate, availabilityBarberId);
        if (!mounted) return;

        const nextSlots = manualSlots.map((slot) => {
          const [hour, minute] = slot.split(":").map((value) => Number(value));
          const slotDate = new Date(availabilityDate);
          slotDate.setHours(hour, minute, 0, 0);

          const booked = occupied.has(slot);
          const isPast = isToday && slotDate.getTime() <= now.getTime();
          const blocked = blockedByClosure.has(slot);
          const freeCount = booked ? 0 : 1;

          return {
            slot,
            blockedByClosure: blocked,
            isPast,
            occupiedCount: booked ? 1 : 0,
            freeCount,
            isUnavailable: blocked || isPast || booked,
          };
        });

        setAvailabilitySlots(nextSlots);
      } catch (error) {
        if (!mounted) return;
        console.error("Error loading admin availability:", error);
        setAvailabilitySlots([]);
      } finally {
        if (mounted) {
          setLoadingAvailability(false);
        }
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [
    activeBarbers,
    availabilityBarberId,
    availabilityDate,
    availabilityRefreshKey,
    getBlockedTimesForDate,
    manualSlots,
  ]);

  const notifyCancellationByEmail = async (appointment: Appointment) => {
    try {
      await queueAppointmentCancellationEmail(db, {
        customerEmail: appointment.customerEmail,
        customerName: appointment.customerName,
        barberName: appointment.barberName,
        serviceName: appointment.serviceName,
        date: appointment.date,
        time: appointment.time,
        canceledBy: "admin",
      });
    } catch (error) {
      console.error("Error queuing cancellation email:", error);
    }
  };

  const handleDeleteAppointment = async (item: Appointment) => {
    if (!window.confirm("Eliminar esta cita?")) return;
    await deleteAppointmentAndLock(db, {
      appointmentId: item.id,
      lockId: item.lockId,
      date: item.date,
      time: item.time,
      barberId: item.barberId,
    });
    await notifyCancellationByEmail(item);
    setAppointments((prev) => prev.filter((entry) => entry.id !== item.id));
    setSelectedAppointmentIds((prev) => prev.filter((id) => id !== item.id));
    setAvailabilityRefreshKey((prev) => prev + 1);
  };

  const handleDeleteSelectedAppointments = async () => {
    if (selectedAppointmentIds.length === 0) return;
    if (!window.confirm(`Eliminar ${selectedAppointmentIds.length} citas seleccionadas?`)) return;

    setIsSaving(true);
    try {
      const selectedAppointments = appointments.filter((appointment) => selectedAppointmentIds.includes(appointment.id));
      for (const appointment of selectedAppointments) {
        await deleteAppointmentAndLock(db, {
          appointmentId: appointment.id,
          lockId: appointment.lockId,
          date: appointment.date,
          time: appointment.time,
          barberId: appointment.barberId,
        });
        await notifyCancellationByEmail(appointment);
      }

      setAppointments((prev) => prev.filter((appointment) => !selectedAppointmentIds.includes(appointment.id)));
      setSelectedAppointmentIds([]);
      setAvailabilityRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Error deleting selected appointments:", error);
      alert("No se pudieron eliminar todas las citas seleccionadas.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAppointmentSelection = (appointmentId: string, checked: boolean) => {
    setSelectedAppointmentIds((prev) => {
      if (checked) {
        if (prev.includes(appointmentId)) return prev;
        return [...prev, appointmentId];
      }
      return prev.filter((id) => id !== appointmentId);
    });
  };

  const handleManualBooking = async (event: React.FormEvent) => {
    event.preventDefault();
    const barber = activeBarbers.find((item) => item.id === newBarberId);
    const service = activeServices.find((item) => item.id === newServiceId);
    const customerName = newCustomerName.trim();
    if (!barber || !service || !customerName || !newDate || !newTime) return;
    if (bookedManualTimes.includes(newTime)) {
      alert("Ese horario no esta disponible.");
      return;
    }

    setIsSaving(true);
    try {
      const { appointmentId, lockId } = await createAppointmentWithLock(db, {
        customerId: "manual",
        customerName,
        customerEmail: "Presencial / Telefono",
        barberId: barber.id,
        barberName: barber.name,
        serviceId: service.id,
        serviceName: service.name,
        price: service.price,
        date: newDate,
        time: newTime,
        status: "confirmed",
      });

      setAppointments((prev) => sortAppointments([...prev, {
        id: appointmentId,
        lockId,
        customerId: "manual",
        customerName,
        customerEmail: "Presencial / Telefono",
        barberId: barber.id,
        barberName: barber.name,
        serviceId: service.id,
        serviceName: service.name,
        price: service.price,
        date: newDate,
        time: newTime,
      }]));

      setNewCustomerName("");
      setNewDate("");
      setIsModalOpen(false);
      setAvailabilityRefreshKey((prev) => prev + 1);
    } catch (error) {
      if (error instanceof Error && error.message === "SLOT_TAKEN") {
        alert("Ese horario ya esta ocupado.");
      } else if (error instanceof Error && error.message === "SLOT_CLOSED") {
        alert("Ese horario esta bloqueado por cierre o fuera del horario laboral.");
      } else {
        alert("No se pudo crear la cita.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddBarber = async () => {
    const name = newBarberName.trim();
    if (!name) return;
    const docRef = await addDoc(collection(db, "barbers"), { name, bio: newBarberBio.trim(), active: true, photoURL: "", createdAt: new Date().toISOString() });
    setBarbers((prev) => [...prev, { id: docRef.id, name, bio: newBarberBio.trim(), active: true, photoURL: "" }].sort((a, b) => a.name.localeCompare(b.name)));
    setNewBarberName("");
    setNewBarberBio("");
  };

  const handleBarberPhotoUpload = async (barberId: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Selecciona una imagen valida.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("La imagen no puede superar 5MB.");
      return;
    }

    setIsSaving(true);
    try {
      const photoRef = ref(storage, `barbers/${barberId}/profile/avatar`);
      await uploadBytes(photoRef, file, { contentType: file.type });
      const photoURL = await getDownloadURL(photoRef);

      await setDoc(doc(db, "barbers", barberId), { photoURL, updatedAt: new Date().toISOString() }, { merge: true });
      setBarbers((prev) => prev.map((barber) => (barber.id === barberId ? { ...barber, photoURL } : barber)));
    } catch (error) {
      console.error("Error uploading barber photo:", error);
      if (error instanceof FirebaseError) {
        alert(`No se pudo subir la foto del barbero (${error.code}).`);
      } else {
        alert("No se pudo subir la foto del barbero.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddService = async () => {
    const name = newServiceName.trim();
    const price = Number(newServicePrice);
    if (!name || Number.isNaN(price)) return;
    const docRef = await addDoc(collection(db, "services"), { name, price, durationMinutes: 60, active: true, createdAt: new Date().toISOString() });
    setServices((prev) => [...prev, { id: docRef.id, name, price, durationMinutes: 60, active: true }].sort((a, b) => a.name.localeCompare(b.name)));
    setNewServiceName("");
    setNewServicePrice("15");
  };

  const handleSaveBarber = async (barber: Barber) => {
    await setDoc(doc(db, "barbers", barber.id), { name: barber.name.trim(), bio: barber.bio.trim(), active: barber.active, photoURL: barber.photoURL || "", updatedAt: new Date().toISOString() }, { merge: true });
  };

  const handleSaveService = async (service: Service) => {
    await setDoc(doc(db, "services", service.id), { name: service.name.trim(), price: service.price, durationMinutes: 60, active: service.active, updatedAt: new Date().toISOString() }, { merge: true });
  };

  const handleDeleteBarber = async (id: string) => {
    await deleteDoc(doc(db, "barbers", id));
    setBarbers((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDeleteService = async (id: string) => {
    await deleteDoc(doc(db, "services", id));
    setServices((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveHours = async () => {
    if (hoursDraft.closeHour <= hoursDraft.openHour) return;
    const normalized = normalizeBusinessHours({ ...hoursDraft, slotMinutes: 60 });
    const value = { ...normalized, slotMinutes: 60 };
    await setDoc(doc(db, "settings", "businessHours"), value, { merge: true });
    setBusinessHours(value);
    setHoursDraft(value);
  };

  const toggleClosureBlockedTime = (time: string, enabled: boolean) => {
    setClosureBlockedTimes((prev) => {
      if (enabled) {
        if (prev.includes(time)) return prev;
        return [...prev, time];
      }
      return prev.filter((slot) => slot !== time);
    });
  };

  const handleSaveClosure = async () => {
    if (!closureDate) return;

    const cleanedBlockedTimes = closureClosedAllDay
      ? []
      : closureBlockedTimes.filter((slot) => manualSlots.includes(slot)).sort();

    try {
      if (!closureClosedAllDay && cleanedBlockedTimes.length === 0) {
        await deleteDoc(doc(db, "closures", closureDate));
        setClosures((prev) => prev.filter((closure) => closure.date !== closureDate));
        return;
      }

      const closureData: ClosureDay = {
        date: closureDate,
        closedAllDay: closureClosedAllDay,
        blockedTimes: cleanedBlockedTimes,
      };

      await setDoc(
        doc(db, "closures", closureDate),
        {
          ...closureData,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setClosures((prev) => {
        const withoutCurrent = prev.filter((closure) => closure.date !== closureDate);
        return [...withoutCurrent, closureData].sort((a, b) => a.date.localeCompare(b.date));
      });
    } catch (error) {
      console.error("Error saving closure:", error);
      alert("No se pudo guardar la configuracion del cierre.");
    }
  };

  const handleDeleteClosure = async (date: string) => {
    try {
      await deleteDoc(doc(db, "closures", date));
      setClosures((prev) => prev.filter((closure) => closure.date !== date));
      if (closureDate === date) {
        setClosureClosedAllDay(false);
        setClosureBlockedTimes([]);
      }
    } catch (error) {
      console.error("Error deleting closure:", error);
      alert("No se pudo eliminar la configuracion del dia.");
    }
  };

  if (loading) return <div className="min-h-screen bg-barbas-black flex items-center justify-center"><div className="w-12 h-12 border-4 border-barbas-gold border-t-transparent rounded-full animate-spin"></div></div>;
  if (!isAdmin) return null;

  return (
    <main className="min-h-screen bg-barbas-black p-3 sm:p-6 text-white overflow-x-hidden">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center border-b border-white/10 pb-4">
          <h1 className="text-2xl sm:text-3xl font-bold">Administrador</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:w-auto">
            <button onClick={() => setIsModalOpen(true)} className="bg-barbas-gold text-barbas-black px-3 py-2 rounded-lg font-bold min-h-11">Nueva cita</button>
            <button onClick={async () => { await signOut(auth); router.push("/"); }} className="bg-red-500/20 text-red-400 px-3 py-2 rounded-lg min-h-11">Cerrar sesion</button>
          </div>
        </header>

        <section className="bg-barbas-dark p-4 rounded-xl border border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-3">
            <h2 className="text-xl font-bold">Citas</h2>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs flex items-center gap-1 text-gray-300">
                <input
                  type="checkbox"
                  checked={allAppointmentsSelected}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setSelectedAppointmentIds(appointments.map((appointment) => appointment.id));
                    } else {
                      setSelectedAppointmentIds([]);
                    }
                  }}
                />
                Seleccionar todas
              </label>
              <button
                onClick={handleDeleteSelectedAppointments}
                disabled={selectedAppointmentIds.length === 0 || isSaving}
                className="w-full sm:w-auto px-3 py-2 rounded-lg bg-red-500/20 text-red-300 disabled:opacity-50 min-h-11"
              >
                Eliminar seleccionadas ({selectedAppointmentIds.length})
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {appointments.map((item) => (
              <div key={item.id} className="border border-white/10 rounded-lg p-3 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center overflow-hidden">
                <div className="flex items-start gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedAppointmentIds.includes(item.id)}
                    onChange={(event) => toggleAppointmentSelection(item.id, event.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-barbas-gold"
                  />
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center relative">
                    {item.customerPhotoURL ? (
                      <Image src={item.customerPhotoURL} alt={item.customerName} fill sizes="40px" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-gray-300 font-semibold">
                        {item.customerName.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold wrap-break-word">{item.date} {item.time} - {item.customerName}</p>
                    <p className="text-sm text-gray-400 wrap-break-word">{item.barberName} | {item.serviceName} | {item.price} EUR</p>
                    <p className="text-xs text-gray-500 break-all">{item.customerEmail || "Sin correo"}</p>
                  </div>
                </div>
                <div className="flex w-full sm:w-auto items-center justify-end gap-2 flex-wrap self-end sm:self-auto">
                  {getWhatsAppLink(item.customerPhone) ? (
                    <a
                      href={getWhatsAppLink(item.customerPhone)}
                      target="_blank"
                      rel="noreferrer"
                      title="Contactar por WhatsApp"
                      className="w-10 h-10 rounded-full bg-green-500 hover:bg-green-400 text-white flex items-center justify-center shrink-0"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M12 2a10 10 0 00-8.66 15l-1.2 4.4 4.5-1.18A10 10 0 1012 2zm0 18a8 8 0 01-4.07-1.12l-.3-.18-2.67.7.72-2.6-.2-.32A8 8 0 1112 20zm4.43-5.94c-.24-.12-1.4-.7-1.62-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1-.38-1.9-1.2-.7-.62-1.16-1.4-1.3-1.64-.14-.24-.02-.36.1-.48.1-.1.24-.26.36-.38.12-.12.16-.2.24-.34.08-.14.04-.26-.02-.38-.06-.12-.54-1.3-.74-1.78-.2-.48-.4-.42-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2 0 1.18.86 2.32.98 2.48.12.16 1.68 2.56 4.08 3.58.57.24 1 .38 1.34.48.56.18 1.08.16 1.48.1.45-.06 1.4-.58 1.6-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28z" />
                      </svg>
                    </a>
                  ) : (
                    <span className="text-[10px] text-gray-500">Sin WhatsApp</span>
                  )}
                  <button onClick={() => handleDeleteAppointment(item)} className="text-red-400 border border-red-400/30 hover:bg-red-500/20 shrink-0 px-3 py-2 rounded min-h-11 whitespace-nowrap">Eliminar</button>
                </div>
              </div>
            ))}
            {appointments.length === 0 && <p className="text-gray-400">No hay citas.</p>}
          </div>
        </section>

        <section className="bg-barbas-dark p-4 rounded-xl border border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h2 className="text-xl font-bold">Disponibilidad para llamadas</h2>
            <button
              onClick={() => setAvailabilityRefreshKey((prev) => prev + 1)}
              className="px-3 py-2 border border-white/20 rounded-lg text-sm text-gray-200 w-full sm:w-auto min-h-11"
            >
              Actualizar
            </button>
          </div>
          <p className="text-sm text-gray-400 mb-3">
            Consulta al instante si una fecha y hora estan libres para agendar manualmente.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 mb-3">
            <input
              type="date"
              value={availabilityDate}
              min={getToday()}
              onChange={(event) => setAvailabilityDate(event.target.value)}
              className="w-full bg-black/30 border border-gray-600 rounded px-3 py-2 scheme-dark"
            />
            <select
              value={availabilityBarberId}
              onChange={(event) => setAvailabilityBarberId(event.target.value)}
              className="w-full bg-black/30 border border-gray-600 rounded px-3 py-2"
            >
              <option value="all">Todos los barberos</option>
              {activeBarbers.map((barber) => (
                <option key={barber.id} value={barber.id}>
                  {barber.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-300 mb-3">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded border border-barbas-gold"></span>
              Disponible
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-barbas-gold border border-barbas-gold"></span>
              No disponible
            </span>
            <span className="text-gray-400">
              Disponibles: {availabilitySummary.available} / {availabilitySummary.total}
            </span>
          </div>

          {availabilityDate && closuresByDate.get(availabilityDate)?.closedAllDay && (
            <p className="text-red-300 text-sm mb-3 border border-red-500/30 p-2 rounded-lg bg-red-950/20">
              La barberia esta marcada como cerrada todo el dia.
            </p>
          )}

          {loadingAvailability && <p className="text-gray-400 text-sm mb-3">Cargando disponibilidad...</p>}

          {!loadingAvailability && availabilitySlots.length === 0 && (
            <p className="text-gray-400 text-sm">No hay horarios para mostrar.</p>
          )}

          {!loadingAvailability && availabilitySlots.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {availabilitySlots.map((entry) => (
                <div
                  key={entry.slot}
                  className={`rounded-lg border p-2 text-center ${
                    entry.isUnavailable
                      ? "bg-barbas-gold text-barbas-black border-barbas-gold"
                      : "bg-transparent text-barbas-gold border-barbas-gold"
                  }`}
                >
                  <p className="font-bold text-sm">{entry.slot}</p>
                  <p className="text-[10px] leading-tight">
                    {entry.blockedByClosure
                      ? "Bloqueado"
                      : entry.isPast
                        ? "Hora pasada"
                        : availabilityBarberId === "all"
                          ? `${entry.freeCount} libre(s)`
                          : entry.isUnavailable
                            ? "Ocupado"
                            : "Libre"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <div className="bg-barbas-dark p-4 rounded-xl border border-white/10">
            <h2 className="font-bold mb-2">Barberos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mb-3">
              <input value={newBarberName} onChange={(event) => setNewBarberName(event.target.value)} placeholder="Nombre" className="bg-black/30 border border-gray-600 rounded px-2 py-1" />
              <input value={newBarberBio} onChange={(event) => setNewBarberBio(event.target.value)} placeholder="Bio" className="bg-black/30 border border-gray-600 rounded px-2 py-1" />
              <button onClick={handleAddBarber} className="bg-barbas-gold text-black px-3 py-2 rounded min-h-11 font-bold">+</button>
            </div>
            {barbers.map((item) => (
              <div key={item.id} className="border border-white/10 rounded-lg p-2 mb-2 space-y-2">
                <div className="flex gap-2 items-center">
                  <div className="w-12 h-12 rounded-full bg-black/40 overflow-hidden border border-white/10 flex items-center justify-center relative">
                    {item.photoURL ? (
                      <Image src={item.photoURL} alt={item.name} fill sizes="48px" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-gray-400">Sin foto</span>
                    )}
                  </div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input value={item.name} onChange={(event) => setBarbers((prev) => prev.map((row) => row.id === item.id ? { ...row, name: event.target.value } : row))} className="bg-black/30 border border-gray-600 rounded px-2 py-1" />
                    <input value={item.bio} onChange={(event) => setBarbers((prev) => prev.map((row) => row.id === item.id ? { ...row, bio: event.target.value } : row))} className="bg-black/30 border border-gray-600 rounded px-2 py-1" />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleBarberPhotoUpload(item.id, file); }} className="text-xs text-gray-300 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-barbas-gold file:text-barbas-black file:font-semibold w-full" />
                  <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={item.active} onChange={(event) => setBarbers((prev) => prev.map((row) => row.id === item.id ? { ...row, active: event.target.checked } : row))} />Activo</label>
                  <button onClick={() => handleSaveBarber(item)} className="text-emerald-400 text-sm px-2 py-2 min-h-11">Guardar</button>
                  <button onClick={() => handleDeleteBarber(item.id)} className="text-red-400 text-sm px-2 py-2 min-h-11">Borrar</button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-barbas-dark p-4 rounded-xl border border-white/10">
            <h2 className="font-bold mb-2">Servicios</h2>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 mb-3">
              <input value={newServiceName} onChange={(event) => setNewServiceName(event.target.value)} placeholder="Servicio" className="bg-black/30 border border-gray-600 rounded px-2 py-1" />
              <input type="number" value={newServicePrice} onChange={(event) => setNewServicePrice(event.target.value)} placeholder="Precio" className="w-full sm:w-24 bg-black/30 border border-gray-600 rounded px-2 py-1" />
              <button onClick={handleAddService} className="bg-barbas-gold text-black px-3 py-2 rounded min-h-11 font-bold">+</button>
            </div>
            {services.map((item) => (
              <div key={item.id} className="border border-white/10 rounded-lg p-2 mb-2">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 mb-2">
                  <input value={item.name} onChange={(event) => setServices((prev) => prev.map((row) => row.id === item.id ? { ...row, name: event.target.value } : row))} className="bg-black/30 border border-gray-600 rounded px-2 py-1" />
                  <input type="number" value={item.price} onChange={(event) => setServices((prev) => prev.map((row) => row.id === item.id ? { ...row, price: Number(event.target.value) } : row))} className="w-full sm:w-24 bg-black/30 border border-gray-600 rounded px-2 py-1" />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={item.active} onChange={(event) => setServices((prev) => prev.map((row) => row.id === item.id ? { ...row, active: event.target.checked } : row))} />Activo</label>
                  <button onClick={() => handleSaveService(item)} className="text-emerald-400 text-sm px-2 py-2 min-h-11">Guardar</button>
                  <button onClick={() => handleDeleteService(item.id)} className="text-red-400 text-sm px-2 py-2 min-h-11">Borrar</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-barbas-dark p-4 rounded-xl border border-white/10">
          <h2 className="font-bold mb-2">Horario laboral (slots de 1 hora)</h2>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div>
              <label className="text-xs text-gray-400">Apertura</label>
              <select value={hoursDraft.openHour} onChange={(event) => setHoursDraft((prev) => ({ ...prev, openHour: Number(event.target.value) }))} className="bg-black/30 border border-gray-600 rounded px-2 py-1 block">
                {hourOptions.map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">Cierre</label>
              <select value={hoursDraft.closeHour} onChange={(event) => setHoursDraft((prev) => ({ ...prev, closeHour: Number(event.target.value) }))} className="bg-black/30 border border-gray-600 rounded px-2 py-1 block">
                {hourOptions.filter((hour) => hour > hoursDraft.openHour).map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}
              </select>
            </div>
            <button onClick={handleSaveHours} className="bg-barbas-gold text-black px-3 py-2 rounded font-bold w-full sm:w-auto min-h-11">Guardar horario</button>
          </div>
          <p className="text-xs text-gray-400 mt-2 wrap-break-word">Slots: {buildTimeSlots({ ...hoursDraft, slotMinutes: 60 }).join(", ")}</p>
        </section>

        <section className="bg-barbas-dark p-4 rounded-xl border border-white/10">
          <h2 className="font-bold mb-3">Cierres y franjas sin servicio</h2>
          <div className="grid md:grid-cols-[220px_1fr] gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Dia</label>
                <input
                  type="date"
                  value={closureDate}
                  min={getToday()}
                  onChange={(event) => setClosureDate(event.target.value)}
                  className="w-full bg-black/30 border border-gray-600 rounded px-2 py-1 scheme-dark"
                />
              </div>
              <label className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={closureClosedAllDay}
                  onChange={(event) => setClosureClosedAllDay(event.target.checked)}
                />
                Cerrar barberia todo el dia
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button onClick={handleSaveClosure} className="bg-barbas-gold text-black px-3 py-2 rounded font-bold w-full min-h-11">
                  Guardar cierre
                </button>
                <button onClick={() => void handleDeleteClosure(closureDate)} className="bg-red-500/20 text-red-300 px-3 py-2 rounded w-full min-h-11">
                  Limpiar dia
                </button>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-300 mb-2">Selecciona horas sin servicio para el dia:</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {manualSlots.map((slot) => (
                  <label key={slot} className={`text-xs border rounded px-2 py-1 text-center cursor-pointer ${closureBlockedTimes.includes(slot) ? "bg-barbas-gold text-black border-barbas-gold" : "border-gray-600 text-gray-200"}`}>
                    <input
                      type="checkbox"
                      className="hidden"
                      disabled={closureClosedAllDay}
                      checked={closureBlockedTimes.includes(slot)}
                      onChange={(event) => toggleClosureBlockedTime(slot, event.target.checked)}
                    />
                    {slot}
                  </label>
                ))}
              </div>
              {closureClosedAllDay && <p className="text-xs text-gray-400 mt-2">Dia marcado como cerrado completo.</p>}
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="text-sm font-semibold mb-2">Dias configurados</p>
            <div className="space-y-1">
              {closures.length === 0 && <p className="text-xs text-gray-400">No hay cierres configurados.</p>}
              {closures.map((closure) => (
                <div key={closure.date} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs border border-white/10 rounded px-2 py-1">
                  <span className="wrap-break-word">
                    {closure.date} - {closure.closedAllDay ? "Cerrado todo el dia" : `Bloques: ${closure.blockedTimes.join(", ") || "ninguno"}`}
                  </span>
                  <button onClick={() => void handleDeleteClosure(closure.date)} className="text-red-300 self-start sm:self-auto">
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleManualBooking} className="w-full max-w-md bg-barbas-dark border border-white/10 rounded-xl p-4 space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold">Nueva cita manual</h3>
            <input value={newCustomerName} onChange={(event) => setNewCustomerName(event.target.value)} placeholder="Cliente" className="w-full bg-black/30 border border-gray-600 rounded px-3 py-2" required />
            <select value={newBarberId} onChange={(event) => setNewBarberId(event.target.value)} className="w-full bg-black/30 border border-gray-600 rounded px-3 py-2">{activeBarbers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <select value={newServiceId} onChange={(event) => setNewServiceId(event.target.value)} className="w-full bg-black/30 border border-gray-600 rounded px-3 py-2">{activeServices.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.price} EUR</option>)}</select>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} min={getToday()} className="bg-black/30 border border-gray-600 rounded px-3 py-2" required />
              <select value={newTime} onChange={(event) => setNewTime(event.target.value)} disabled={!newDate || loadingManualSlots} className="bg-black/30 border border-gray-600 rounded px-3 py-2">
                {manualSlots.map((slot) => <option key={slot} value={slot} disabled={bookedManualTimes.includes(slot)}>{bookedManualTimes.includes(slot) ? `${slot} (Ocupado)` : slot}</option>)}
              </select>
            </div>
            {newDate && bookedManualTimes.length >= manualSlots.length && (
              <p className="text-xs text-red-300">No hay horarios disponibles para esta fecha.</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:justify-end">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-3 py-2 rounded border border-white/20 min-h-11">Cancelar</button>
              <button type="submit" disabled={isSaving || loadingManualSlots || !newTime || bookedManualTimes.includes(newTime)} className="px-3 py-2 rounded bg-barbas-gold text-black font-bold disabled:opacity-50 min-h-11">{isSaving ? "Guardando..." : "Confirmar"}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

