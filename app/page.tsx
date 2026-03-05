"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore"; // Importamos las funciones de la base de datos
import { FirebaseError } from "firebase/app";
import { auth, db } from "../lib/firebase"; 
import { useRouter } from "next/navigation";

export default function AuthScreen() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  
  // Estados del formulario
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");   // Nuevo
  const [phone, setPhone] = useState(""); // Nuevo
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        // INICIAR SESIÓN
        await signInWithEmailAndPassword(auth, email, password);
        router.push("/home");
      } else {
        // REGISTRO
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Guardamos el Nombre y Teléfono en la colección "users" de Firestore
        await setDoc(doc(db, "users", user.uid), {
          name: name,
          phone: phone,
          email: email,
          role: "client", // Por defecto todos son clientes. Luego haremos al admin.
          createdAt: new Date().toISOString()
        });

        router.push("/home");
      }
    } catch (err: unknown) {
      if (err instanceof FirebaseError) {
        if (err.code === "auth/invalid-credential") setError("Correo o contraseña incorrectos.");
        else if (err.code === "auth/email-already-in-use") setError("Este correo ya está registrado.");
        else if (err.code === "auth/weak-password") setError("La contraseña debe tener al menos 6 caracteres.");
        else setError("Ocurrió un error. Inténtalo de nuevo.");
      } else {
        setError("Ocurrió un error inesperado.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-barbas-black flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-barbas-dark p-8 rounded-2xl shadow-xl border border-barbas-gold/20">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 mb-4 bg-barbas-gold rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-barbas-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-barbas-gold tracking-widest uppercase">
            Barbas Cut&apos;s
          </h1>
        </div>

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          
          {/* Campos extra SOLO para el Registro */}
          {!isLogin && (
            <>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Nombre Completo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-barbas-gold transition-colors"
                  placeholder="Juan Pérez"
                  required={!isLogin} // Solo es obligatorio si se está registrando
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
                  required={!isLogin}
                />
              </div>
            </>
          )}

          <div>
            <label className="text-gray-400 text-sm mb-1 block">Correo Electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-barbas-gold transition-colors"
              placeholder="tu@correo.com"
              required
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm mb-1 block">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-barbas-gold transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-barbas-gold text-barbas-black font-bold text-lg py-3 rounded-lg mt-2 hover:bg-yellow-500 transition-colors disabled:opacity-50"
          >
            {loading ? "Cargando..." : (isLogin ? "INICIAR SESIÓN" : "REGISTRARSE")}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          {isLogin ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-barbas-gold font-bold hover:underline"
          >
            {isLogin ? "Regístrate aquí" : "Inicia sesión"}
          </button>
        </div>

      </div>
    </main>
  );
}