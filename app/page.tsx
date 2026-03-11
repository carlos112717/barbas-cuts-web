"use client";

import { useState } from "react";
import Image from "next/image";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { useRouter } from "next/navigation";
import { auth, db } from "../lib/firebase";

export default function AuthScreen() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));

        if (userDoc.exists() && userDoc.data().role === "admin") {
          router.push("/admin");
        } else {
          router.push("/home");
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
          name,
          phone,
          email,
          role: "client",
          createdAt: new Date().toISOString(),
        });

        router.push("/home");
      }
    } catch (err: unknown) {
      if (err instanceof FirebaseError) {
        if (err.code === "auth/invalid-credential") {
          setError("Correo o contrasena incorrectos.");
        } else if (err.code === "auth/email-already-in-use") {
          setError("Este correo ya esta registrado.");
        } else if (err.code === "auth/weak-password") {
          setError("La contrasena debe tener al menos 6 caracteres.");
        } else if (err.code === "auth/unauthorized-domain") {
          setError("Dominio no autorizado en Firebase Auth. Agrega tu dominio de Vercel en Authentication > Settings > Authorized domains.");
        } else {
          setError("Ocurrio un error. Intentalo de nuevo.");
        }
        console.error("Firebase auth error:", err.code, err.message);
      } else {
        setError("Ocurrio un error inesperado.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-barbas-black flex flex-col items-center justify-center p-4 sm:p-6 overflow-x-hidden">
      <div className="w-full max-w-md bg-barbas-dark p-5 sm:p-8 rounded-2xl shadow-xl border border-barbas-gold/20">
        <div className="flex flex-col items-center mb-8">
          <div className="w-36 h-36 mb-4">
            <Image
              src="/LOGO_BARBER.png"
              alt="Barbas Cut's"
              width={144}
              height={144}
              className="w-full h-full object-contain"
              priority
            />
          </div>
        </div>

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          {!isLogin && (
            <>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Nombre Completo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-barbas-gold transition-colors"
                  placeholder="Juan Perez"
                  required={!isLogin}
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Telefono / WhatsApp</label>
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
            <label className="text-gray-400 text-sm mb-1 block">Correo Electronico</label>
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
            <label className="text-gray-400 text-sm mb-1 block">Contrasena</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border border-gray-600 rounded-lg px-4 py-3 pr-12 text-white focus:outline-none focus:border-barbas-gold transition-colors"
                placeholder="********"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-barbas-gold transition-colors"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 5.09A9.94 9.94 0 0112 5c5 0 9 5 9 7 0 1.13-1.3 3.04-3.35 4.61M6.1 6.1C3.59 7.7 2 10.03 2 12c0 2 4 7 10 7a9.97 9.97 0 004.06-.84" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-barbas-gold text-barbas-black font-bold text-lg py-3 rounded-lg mt-2 hover:bg-yellow-500 transition-colors disabled:opacity-50 min-h-11"
          >
            {loading ? "Cargando..." : isLogin ? "INICIAR SESION" : "REGISTRARSE"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          {isLogin ? "No tienes cuenta? " : "Ya tienes cuenta? "}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-barbas-gold font-bold hover:underline"
          >
            {isLogin ? "Registrate aqui" : "Inicia sesion"}
          </button>
        </div>
      </div>
    </main>
  );
}

