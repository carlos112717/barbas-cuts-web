/* eslint-disable no-console */
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const force = process.argv.includes("--force");

const defaultBarbers = [
  { id: "carlos-el-bravo", name: "Carlos El Bravo", bio: "Especialista en corte clasico y navaja.", active: true, photoURL: "" },
  { id: "dra-cortes", name: "Dra. Cortes", bio: "Estilo moderno y disenos personalizados.", active: true, photoURL: "" },
  { id: "juan-fade", name: "Juan Fade", bio: "Experto en degradados y perfilados.", active: true, photoURL: "" },
];

const defaultServices = [
  { id: "corte-clasico", name: "Corte Clasico", price: 15, durationMinutes: 60, active: true },
  { id: "barba-toalla", name: "Barba y Toalla Caliente", price: 12, durationMinutes: 60, active: true },
  { id: "servicio-vip", name: "Servicio Completo VIP", price: 25, durationMinutes: 60, active: true },
];

const defaultBusinessHours = {
  openHour: 9,
  closeHour: 20,
  slotMinutes: 60,
};

async function shouldSeedCollection(collectionName) {
  if (force) return true;
  const snapshot = await db.collection(collectionName).limit(1).get();
  return snapshot.empty;
}

async function seedBarbers() {
  if (!(await shouldSeedCollection("barbers"))) {
    console.log("Skipping barbers: collection already has data.");
    return;
  }

  const batch = db.batch();
  const now = new Date().toISOString();
  defaultBarbers.forEach((barber) => {
    const ref = db.collection("barbers").doc(barber.id);
    batch.set(ref, { ...barber, createdAt: now, updatedAt: now }, { merge: true });
  });
  await batch.commit();
  console.log(`Seeded ${defaultBarbers.length} barbers.`);
}

async function seedServices() {
  if (!(await shouldSeedCollection("services"))) {
    console.log("Skipping services: collection already has data.");
    return;
  }

  const batch = db.batch();
  const now = new Date().toISOString();
  defaultServices.forEach((service) => {
    const ref = db.collection("services").doc(service.id);
    batch.set(ref, { ...service, createdAt: now, updatedAt: now }, { merge: true });
  });
  await batch.commit();
  console.log(`Seeded ${defaultServices.length} services.`);
}

async function seedBusinessHours() {
  const ref = db.collection("settings").doc("businessHours");
  const snapshot = await ref.get();
  if (!force && snapshot.exists) {
    console.log("Skipping business hours: document already exists.");
    return;
  }

  await ref.set(
    {
      ...defaultBusinessHours,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  console.log("Seeded business hours.");
}

async function main() {
  await seedBarbers();
  await seedServices();
  await seedBusinessHours();
  console.log("Seed completed.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
