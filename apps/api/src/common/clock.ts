// B-212: zegar wstrzykiwany (testy ustawiaja stala chwile; logika domeny dostaje `Date`, nie czyta zegara).
export const CLOCK = Symbol("CLOCK");
export type Clock = () => Date;
export const systemClock: Clock = () => new Date();
