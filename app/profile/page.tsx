"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
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

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setMessage({ text: "Perfil actualizado correctamente.", type: "success" });

      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
      messageTimeoutRef.current = setTimeout(() => setMessage({ text: "", type: "" }), 3000);
    } catch (error) {
      console.error("Error updating profile:", error);
      if (error instanceof FirebaseError) {
        setMessage({ text: `No se pudo actualizar el perfil (${error.code}).`, type: "error" });
      } else {
        setMessage({ text: "No se pudo actualizar el perfil.", type: "error" });
      }
    } finally {
      setIsSaving(false);
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
          <button onClick={() => router.push("/home")} className="text-barbas-gold w-11 h-11 flex items-center justify-center hover:bg-white/10 rounded-full mr-2 transition-colors">
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

