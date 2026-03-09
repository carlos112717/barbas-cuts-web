"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  
  // Estados de los campos del perfil
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(""); // Será de solo lectura
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Estado para mostrar mensajes de éxito o error en pantalla
  const [message, setMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setEmail(currentUser.email || "");
        
        // Traemos los datos actuales desde Firestore
        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.name) setName(data.name);
            if (data.phone) setPhone(data.phone);
          }
        } catch (error) {
          console.error("Error al cargar el perfil:", error);
        }
      } else {
        router.push("/");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Función para guardar los cambios en Firestore
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSaving(true);
    setMessage({ text: "", type: "" }); // Limpiamos mensajes anteriores

    try {
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, {
        name: name,
        phone: phone,
      });
      
      setMessage({ text: "¡Perfil actualizado con éxito!", type: "success" });
      
      // Ocultamos el mensaje de éxito después de 3 segundos
      setTimeout(() => setMessage({ text: "", type: "" }), 3000);
      
    } catch (error) {
      console.error("Error al actualizar:", error);
      setMessage({ text: "Hubo un error al actualizar tu perfil. Inténtalo de nuevo.", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // Pantalla de carga inicial
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
        
        {/* --- HEADER --- */}
        <header className="flex items-center mb-10 mt-2">
          <button 
            onClick={() => router.push("/home")} 
            className="text-barbas-gold p-2 hover:bg-white/10 rounded-full mr-3 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-white">Mi Perfil</h1>
        </header>

        {/* --- ICONO DE PERFIL --- */}
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 bg-barbas-dark border-2 border-barbas-gold rounded-full flex items-center justify-center shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-barbas-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>

        {/* --- FORMULARIO DE PERFIL --- */}
        <form onSubmit={handleUpdateProfile} className="bg-barbas-dark p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col gap-5">
          
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Nombre Completo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-barbas-gold transition-colors"
              placeholder="Ej. Juan Pérez"
              required
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm mb-1 block">Teléfono / WhatsApp</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-transparent border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-barbas-gold transition-colors"
              placeholder="+34 600 000 000"
              required
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm mb-1 block">Correo Electrónico</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">El correo no se puede modificar.</p>
          </div>

          {/* MENSAJE DE ESTADO */}
          {message.text && (
            <div className={`p-3 rounded-lg text-sm text-center font-medium ${message.type === 'success' ? 'bg-green-900/30 text-green-400 border border-green-500/30' : 'bg-red-900/30 text-red-400 border border-red-500/30'}`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-barbas-gold text-barbas-black font-bold text-lg py-3 rounded-lg mt-2 hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "GUARDANDO..." : "GUARDAR CAMBIOS"}
          </button>
        </form>

      </div>
    </main>
  );
}