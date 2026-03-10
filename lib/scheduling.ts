export interface BusinessHours {
  openHour: number;
  closeHour: number;
  slotMinutes: number;
}

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  openHour: 9,
  closeHour: 20,
  slotMinutes: 60,
};

export const normalizeBusinessHours = (input: Partial<BusinessHours> | undefined): BusinessHours => {
  const openHour = Number.isInteger(input?.openHour) ? Number(input?.openHour) : DEFAULT_BUSINESS_HOURS.openHour;
  const closeHour = Number.isInteger(input?.closeHour) ? Number(input?.closeHour) : DEFAULT_BUSINESS_HOURS.closeHour;
  const slotMinutes = Number.isInteger(input?.slotMinutes) ? Number(input?.slotMinutes) : DEFAULT_BUSINESS_HOURS.slotMinutes;

  const safeOpen = Math.min(22, Math.max(0, openHour));
  const safeClose = Math.min(23, Math.max(safeOpen + 1, closeHour));
  const safeSlotMinutes = slotMinutes > 0 ? slotMinutes : 60;

  return {
    openHour: safeOpen,
    closeHour: safeClose,
    slotMinutes: safeSlotMinutes,
  };
};

export const buildTimeSlots = (hours: BusinessHours): string[] => {
  const slots: string[] = [];
  const start = hours.openHour * 60;
  const end = hours.closeHour * 60;

  for (let minute = start; minute < end; minute += hours.slotMinutes) {
    const hour = Math.floor(minute / 60);
    const mins = minute % 60;
    slots.push(`${String(hour).padStart(2, "0")}:${String(mins).padStart(2, "0")}`);
  }

  return slots;
};

export const getSlotLockId = (date: string, time: string, barberId: string): string => {
  return `${date}__${time}__${barberId}`;
};
