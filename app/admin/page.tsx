"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs, doc, getDoc, deleteDoc, query, orderBy, addDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

// --- INTERFACES ---
interface Appointment {
  id: string; // ID real de Firestore
  customerName: string;
  customerEmail: string;
  barberName: string;
  serviceName: string;
  price: number;
  date: string;
  time: string;
  status: string;
}

interface Barber { id: string; name: string; }
interface Service { id: string; name: string; price: number; }

// --- DATOS DE REFERENCIA (Dummy) ---
const DUMMY_BARBERS: Barber[] = [
  { id: "1", name: "Carlos El Bravo" },
  { id: "2", name: "Dra. Cortes" },
  { id: "3", name: "Juan Fade" },
];

const DUMMY_SERVICES: Service[] = [
  { id: "1", name: "Corte Clásico", price: 15 },
  { id: "2", name: "Barba y Toalla Caliente", price: 12 },
  { id: "3", name: "Servicio Completo VIP", price: 25 },
];

const TIME_SLOTS = ["09:00", "09:30", "10:00", "10:30", "11:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

export default function AdminDashboard() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Estados para el Modal de Cita Manual
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newBarberId, setNewBarberId] = useState(DUMMY_BARBERS[0].id);
  const [newServiceId, setNewServiceId] = useState(DUMMY_SERVICES[0].id);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState(TIME_SLOTS[0]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists() && userDoc.data().role === "admin") {
            setIsAdmin(true);
            fetchAllAppointments();
          } else {
            router.push("/home");
          }
        } catch (error) {
          console.error("Error verificando rol:", error);
          router.push("/home");
        }
      } else {
        router.push("/");
      }
    });

    return () => unsubscribe();
  }, [router]);

  // OBTENER CITAS CORREGIDO: Mapeo seguro del ID
  const fetchAllAppointments = async () => {
    try {
      const q = query(collection(db, "appointments"), orderBy("date", "desc"));
      const querySnapshot = await getDocs(q);
      
      const apps: Appointment[] = [];
      querySnapshot.forEach((document) => {
        // CORRECCIÓN CLAVE: Extraemos el 'document.id' real de Firestore y 
        // luego volcamos el resto de los datos (...document.data())
        apps.push({ 
          id: document.id, 
          customerName: document.data().customerName || "Cliente Desconocido", // Respaldo extra
          customerEmail: document.data().customerEmail || "",
          barberName: document.data().barberName || "",
          serviceName: document.data().serviceName || "",
          price: document.data().price || 0,
          date: document.data().date || "",
          time: document.data().time || "",
          status: document.data().status || "pending"
        });
      });
      
      apps.sort((a, b) => {
        if (a.date === b.date) return a.time.localeCompare(b.time);
        return 0;
      });

      setAppointments(apps);
    } catch (error) {
      console.error("Error al obtener todas las citas:", error);
    } finally {
      setLoading(false);
    }
  };

  // CANCELAR CORREGIDO: Verificación de ID vacío
  const handleCancelAppointment = async (id: string) => {
    if (!id || id === "") {
      alert("⚠️ Esta cita tiene un ID corrupto y no se puede borrar automáticamente. Por favor, elimínala manualmente desde la consola de Firebase.");
      return;
    }

    if (window.confirm("¿Estás seguro de cancelar esta cita del cliente?")) {
      try {
        // CORRECCIÓN: Usamos la sintaxis modular JS SDK estándar
        await deleteDoc(doc(db, "appointments", id));
        setAppointments(appointments.filter(app => app.id !== id));
        alert("Cita eliminada correctamente.");
      } catch (error: unknown) {
        if (error instanceof Error) {
          alert(`No se pudo eliminar. Firebase dice: ${error.message}`);
        } else {
          alert("Hubo un error desconocido al intentar eliminar.");
        }
      }
    }
  };

  const handleManualBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const barber = DUMMY_BARBERS.find(b => b.id === newBarberId);
      const service = DUMMY_SERVICES.find(s => s.id === newServiceId);
      
      if (!barber || !service || !newDate || !newTime || !newCustomerName) {
        alert("Por favor completa todos los campos.");
        setIsSaving(false);
        return;
      }

      const appointmentData = {
        customerId: "manual",
        customerName: newCustomerName,
        customerEmail: "Presencial / Teléfono",
        barberId: barber.id,
        barberName: barber.name,
        serviceId: service.id,
        serviceName: service.name,
        price: service.price,
        date: newDate,
        time: newTime,
        status: "confirmed",
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, "appointments"), appointmentData);
      
      // Añadimos la nueva cita con su ID real de Firestore generado por addDoc
      const newAppointmentWithId = { id: docRef.id, ...appointmentData } as Appointment;
      setAppointments([newAppointmentWithId, ...appointments]);
      
      setNewCustomerName("");
      setNewDate("");
      setIsModalOpen(false);
      alert("Cita manual agendada con éxito.");

    } catch (error) {
      console.error("Error creando cita manual:", error);
      alert("Hubo un error al guardar la cita.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (loading) return <div className="min-h-screen bg-barbas-black flex items-center justify-center"><div className="w-12 h-12 border-4 border-barbas-gold border-t-transparent rounded-full animate-spin"></div></div>;
  if (!isAdmin) return null; 

  const getTodayString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  return (
    <main className="min-h-screen bg-barbas-black p-6 relative">
      <div className="max-w-4xl mx-auto">
        
        <header className="flex justify-between items-center mb-8 mt-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-barbas-gold text-sm font-bold tracking-widest uppercase">Panel de Control</p>
            <h1 className="text-white text-3xl font-bold">Administrador</h1>
          </div>
          <button onClick={handleLogout} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-4 py-2 rounded-lg transition-colors font-semibold">
            Cerrar Sesión
          </button>
        </header>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Agenda General</h2>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-barbas-gold text-barbas-black font-bold px-4 py-2 rounded-lg hover:bg-yellow-500 transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
            Nueva Cita Manual
          </button>
        </div>

        <div className="bg-barbas-dark rounded-xl border border-white/5 overflow-hidden">
          {appointments.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No hay citas registradas en el sistema.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-black/50 text-barbas-gold uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4">Fecha / Hora</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4">Servicio</th>
                    <th className="px-6 py-4">Barbero</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {appointments.map((app) => (
                    <tr key={app.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-medium text-white whitespace-nowrap">
                        {app.date} <br/><span className="text-gray-400">{app.time}</span>
                      </td>
                      <td className="px-6 py-4">
                        {/* Muestra el nombre real guardado en la cita */}
                        <p className="font-bold text-white">{app.customerName}</p>
                        <p className="text-xs text-gray-500">{app.customerEmail}</p>
                      </td>
                      <td className="px-6 py-4">{app.serviceName} <br/><span className="text-barbas-gold">{app.price}€</span></td>
                      <td className="px-6 py-4">{app.barberName}</td>
                      <td className="px-6 py-4 text-right">
                        {/* Botón protegido: Si el ID está vacío, se informa */}
                        <button onClick={() => handleCancelAppointment(app.id)} className="text-red-400 hover:text-red-300 font-medium">
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* --- MODAL DE NUEVA CITA MANUAL*/}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-barbas-dark p-6 rounded-2xl w-full max-w-md border border-barbas-gold/30 shadow-2xl relative">
            
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <h2 className="text-2xl font-bold text-barbas-gold mb-6">Agendar Cita Manual</h2>

            <form onSubmit={handleManualBooking} className="flex flex-col gap-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Nombre del Cliente</label>
                <input type="text" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} className="w-full bg-transparent border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-barbas-gold" placeholder="Ej. Carlos Pérez" required />
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">Barbero</label>
                <select value={newBarberId} onChange={(e) => setNewBarberId(e.target.value)} className="w-full bg-barbas-black border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-barbas-gold">
                  {DUMMY_BARBERS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">Servicio</label>
                <select value={newServiceId} onChange={(e) => setNewServiceId(e.target.value)} className="w-full bg-barbas-black border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-barbas-gold">
                  {DUMMY_SERVICES.map(s => <option key={s.id} value={s.id}>{s.name} - {s.price}€</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Fecha</label>
                  <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} min={getTodayString()} className="w-full bg-transparent border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-barbas-gold [color-scheme:dark]" required />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Hora</label>
                  <select value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-full bg-barbas-black border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-barbas-gold">
                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <button type="submit" disabled={isSaving} className="w-full bg-barbas-gold text-barbas-black font-bold text-lg py-3 rounded-lg mt-4 hover:bg-yellow-500 transition-colors disabled:opacity-50">
                {isSaving ? "GUARDANDO..." : "CONFIRMAR CITA"}
              </button>
            </form>

          </div>
        </div>
      )}

    </main>
  );
}