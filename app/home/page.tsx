"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [userPhotoURL, setUserPhotoURL] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();

            if (data.role === "admin") {
              router.push("/admin");
              return;
            }

            if (data.name) {
              setUserName(data.name);
            } else {
              setUserName("Usuario sin nombre");
            }
            if (typeof data.photoURL === "string" && data.photoURL.trim()) {
              setUserPhotoURL(data.photoURL.trim());
            } else if (currentUser.photoURL) {
              setUserPhotoURL(currentUser.photoURL);
            } else {
              setUserPhotoURL("");
            }
          } else {
            setUserName("Usuario de Prueba");
            setUserPhotoURL(currentUser.photoURL || "");
          }
        } catch (error) {
          console.error("Error al obtener datos del usuario:", error);
          setUserName("Cliente");
          setUserPhotoURL(currentUser.photoURL || "");
        }
      } else {
        router.push("/");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-barbas-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-barbas-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-barbas-black p-4 sm:p-6 overflow-x-hidden">
      <div className="max-w-md mx-auto">
        <header className="flex items-start justify-between gap-3 mb-8 mt-2">
          <div className="min-w-0">
            <p className="text-gray-400 text-sm">Hola, {userName}</p>
            <h1 className="text-white text-lg sm:text-2xl font-bold leading-tight">Bienvenido a Barbas Cut&apos;s</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => router.push("/profile")}
              className="w-11 h-11 rounded-full border border-barbas-gold/40 bg-barbas-dark overflow-hidden flex items-center justify-center relative"
              title="Mi perfil"
            >
              {userPhotoURL ? (
                <Image src={userPhotoURL} alt={userName || "Foto de perfil"} fill sizes="44px" className="w-full h-full object-cover" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-barbas-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="w-11 h-11 flex items-center justify-center text-barbas-gold hover:bg-white/10 rounded-full transition-colors"
              title="Cerrar sesion"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        <button
          onClick={() => router.push("/booking")}
          className="w-full bg-barbas-gold rounded-2xl p-5 sm:p-6 flex flex-col justify-between min-h-[170px] shadow-lg hover:scale-[1.02] transition-transform duration-300 text-left mb-6"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-barbas-black mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div>
            <h2 className="text-barbas-black text-xl font-bold">Reservar Cita</h2>
            <p className="text-barbas-black/80 text-sm">Elige tu estilo y horario ideal</p>
          </div>
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <button
            onClick={() => router.push("/appointments")}
            className="bg-barbas-dark rounded-2xl p-4 sm:p-5 flex flex-col justify-between min-h-[150px] border border-white/5 hover:border-barbas-gold/50 transition-colors text-left"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-barbas-gold mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h2 className="text-white font-bold">Mis Citas</h2>
              <p className="text-gray-400 text-xs">Historial y estado</p>
            </div>
          </button>
          <button
            onClick={() => router.push("/profile")}
            className="bg-barbas-dark rounded-2xl p-4 sm:p-5 flex flex-col justify-between min-h-[150px] border border-white/5 hover:border-barbas-gold/50 transition-colors text-left"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-barbas-gold mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <div>
              <h2 className="text-white font-bold">Mi Perfil</h2>
              <p className="text-gray-400 text-xs">Actualiza tus datos</p>
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}
