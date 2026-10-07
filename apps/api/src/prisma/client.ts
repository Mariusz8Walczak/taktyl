// I-008 (ADR-0010): punkt wejscia do klienta Prisma 7 (generator "prisma-client" zapisuje kod w src/generated).
// Importy w calym API ida przez ten plik, wiec przyszla zmiana lokalizacji klienta dotyka jednego miejsca.
export * from "../generated/prisma/client.js";
