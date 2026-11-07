/** Приводит номер к виду "996555123456": "+996 555-12-34-56" -> "996555123456" */
export const normalizePhone = (phone: string) => phone.replace(/\D/g, '');
