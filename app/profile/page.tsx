"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  updatePassword,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../../lib/firebase";

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [userRole, setUserRole] = useState<"client" | "admin">("client");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTransientMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    messageTimeoutRef.current = setTimeout(() => setMessage({ text: "", type: "" }), 3500);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/");
        setLoading(false);
        return;
      }

      setUser(currentUser);
      setEmail(currentUser.email || "");

      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (typeof data.name === "string") setName(data.name);
          if (typeof data.phone === "string") setPhone(data.phone);
          if (typeof data.photoURL === "string") setPhotoURL(data.photoURL);
          if (data.role === "admin") setUserRole("admin");
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, [router]);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage({ text: "Selecciona una imagen valida.", type: "error" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ text: "La imagen no puede superar 5MB.", type: "error" });
      return;
    }

    setPhotoFile(file);
    setPhotoURL(URL.createObjectURL(file));
  };

  const handleUpdateProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setMessage({ text: "", type: "" });

    try {
      const trimmedName = name.trim();
      const trimmedPhone = phone.trim();
      let nextPhotoURL = photoURL;

      if (photoFile) {
        const photoRef = ref(storage, `users/${user.uid}/profile/avatar`);
        await uploadBytes(photoRef, photoFile, { contentType: photoFile.type });
        nextPhotoURL = await getDownloadURL(photoRef);
      }

      await setDoc(
        doc(db, "users", user.uid),
        {
          name: trimmedName,
          phone: trimmedPhone,
          email: user.email || "",
          photoURL: nextPhotoURL,
        },
        { merge: true }
      );

      setPhotoURL(nextPhotoURL);
      setPhotoFile(null);
      showTransientMessage("Perfil actualizado correctamente.", "success");
    } catch (error) {
      console.error("Error updating profile:", error);
      if (error instanceof FirebaseError) {
        showTransientMessage(`No se pudo actualizar el perfil (${error.code}).`, "error");
      } else {
        showTransientMessage("No se pudo actualizar el perfil.", "error");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      showTransientMessage("No se encontro una sesion valida. Inicia sesion nuevamente.", "error");
      return;
    }

    const hasPasswordProvider = currentUser.providerData.some(
      (provider) => provider.providerId === "password"
    );
    if (!hasPasswordProvider) {
      showTransientMessage(
        "Tu cuenta no usa contrasena tradicional. Inicia con tu proveedor habitual para gestionarla.",
        "error"
      );
      return;
    }

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      showTransientMessage("Completa los 3 campos de contrasena.", "error");
      return;
    }

    if (newPassword !== newPassword.trim()) {
      showTransientMessage("La nueva contrasena no debe iniciar ni terminar con espacios.", "error");
      return;
    }

    if (newPassword.length < 6) {
      showTransientMessage("La nueva contrasena debe tener al menos 6 caracteres.", "error");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showTransientMessage("La confirmacion de contrasena no coincide.", "error");
      return;
    }

    if (currentPassword === newPassword) {
      showTransientMessage("La nueva contrasena debe ser diferente a la actual.", "error");
      return;
    }

    setIsChangingPassword(true);
    setMessage({ text: "", type: "" });

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      await currentUser.reload();

      // Verifica de inmediato que la nueva contrasena quedo activa en Firebase Auth.
      const verifyCredential = EmailAuthProvider.credential(currentUser.email, newPassword);
      await reauthenticateWithCredential(currentUser, verifyCredential);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      showTransientMessage("Contrasena actualizada correctamente. Usa la nueva en tu proximo inicio de sesion.", "success");
    } catch (error) {
      console.error("Error changing password:", error);
      if (error instanceof FirebaseError) {
        if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
          showTransientMessage("La contrasena actual es incorrecta.", "error");
        } else if (error.code === "auth/requires-recent-login") {
          showTransientMessage("Por seguridad, vuelve a iniciar sesion e intentalo nuevamente.", "error");
        } else if (error.code === "auth/too-many-requests") {
          showTransientMessage("Demasiados intentos. Espera unos minutos e intentalo de nuevo.", "error");
        } else {
          showTransientMessage(`No se pudo cambiar la contrasena (${error.code}).`, "error");
        }
      } else {
        showTransientMessage("No se pudo cambiar la contrasena.", "error");
      }
    } finally {
      setIsChangingPassword(false);
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
    <main className="min-h-screen bg-barbas-black p-4 sm:p-6 overflow-x-hidden">
      <div className="max-w-md mx-auto">
        <header className="flex items-center mb-6 sm:mb-10 mt-2">
          <button onClick={() => router.push(userRole === "admin" ? "/admin" : "/home")} className="text-barbas-gold w-11 h-11 flex items-center justify-center hover:bg-white/10 rounded-full mr-2 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Mi Perfil</h1>
        </header>

        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-24 h-24 bg-barbas-dark border-2 border-barbas-gold rounded-full flex items-center justify-center shadow-lg overflow-hidden relative">
            {photoURL ? (
              <Image
                src={photoURL}
                alt="Foto de perfil"
                fill
                sizes="96px"
                unoptimized={photoURL.startsWith("blob:")}
                className="w-full h-full object-cover"
              />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-barbas-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </div>
          <input type="file" accept="image/*" onChange={handlePhotoChange} className="w-full text-xs sm:text-sm text-gray-300 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-barbas-gold file:text-barbas-black file:font-semibold hover:file:bg-yellow-500" />
        </div>

        <form onSubmit={handleUpdateProfile} className="bg-barbas-dark p-4 sm:p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col gap-5">
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Nombre Completo</label>
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} className="w-full bg-transparent border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-barbas-gold transition-colors" required />
          </div>

          <div>
            <label className="text-gray-400 text-sm mb-1 block">Telefono / WhatsApp</label>
            <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full bg-transparent border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-barbas-gold transition-colors" required />
          </div>

          <div>
            <label className="text-gray-400 text-sm mb-1 block">Correo Electronico</label>
            <input type="email" value={email} disabled className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-gray-500 cursor-not-allowed" />
            <p className="text-xs text-gray-500 mt-1">El correo no se puede modificar.</p>
          </div>

          <div className="pt-2 border-t border-white/10 space-y-3">
            <h2 className="text-white font-semibold">Cambiar contrasena</h2>

            <div>
              <label className="text-gray-400 text-sm mb-1 block">Contrasena actual</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleChangePassword();
                    }
                  }}
                  className="w-full bg-transparent border border-gray-600 rounded-lg px-4 py-3 pr-12 text-white focus:outline-none focus:border-barbas-gold transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  aria-label={showCurrentPassword ? "Ocultar contrasena actual" : "Mostrar contrasena actual"}
                  className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-barbas-gold transition-colors"
                >
                  {showCurrentPassword ? (
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

            <div>
              <label className="text-gray-400 text-sm mb-1 block">Nueva contrasena</label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleChangePassword();
                    }
                  }}
                  className="w-full bg-transparent border border-gray-600 rounded-lg px-4 py-3 pr-12 text-white focus:outline-none focus:border-barbas-gold transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  aria-label={showNewPassword ? "Ocultar nueva contrasena" : "Mostrar nueva contrasena"}
                  className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-barbas-gold transition-colors"
                >
                  {showNewPassword ? (
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

            <div>
              <label className="text-gray-400 text-sm mb-1 block">Confirmar nueva contrasena</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmNewPassword}
                  onChange={(event) => setConfirmNewPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleChangePassword();
                    }
                  }}
                  className="w-full bg-transparent border border-gray-600 rounded-lg px-4 py-3 pr-12 text-white focus:outline-none focus:border-barbas-gold transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? "Ocultar confirmacion de contrasena" : "Mostrar confirmacion de contrasena"}
                  className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-barbas-gold transition-colors"
                >
                  {showConfirmPassword ? (
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

            <button
              type="button"
              onClick={handleChangePassword}
              disabled={isChangingPassword}
              className="w-full border border-barbas-gold/60 text-barbas-gold font-semibold py-3 rounded-lg hover:bg-barbas-gold/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-11"
            >
              {isChangingPassword ? "ACTUALIZANDO CONTRASENA..." : "ACTUALIZAR CONTRASENA"}
            </button>
          </div>

          {message.text && (
            <div className={`p-3 rounded-lg text-sm text-center font-medium ${message.type === "success" ? "bg-green-900/30 text-green-400 border border-green-500/30" : "bg-red-900/30 text-red-400 border border-red-500/30"}`}>
              {message.text}
            </div>
          )}

          <button type="submit" disabled={isSaving} className="w-full bg-barbas-gold text-barbas-black font-bold text-lg py-3 rounded-lg mt-2 hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-11">
            {isSaving ? "GUARDANDO..." : "GUARDAR CAMBIOS"}
          </button>
        </form>
      </div>
    </main>
  );
}

