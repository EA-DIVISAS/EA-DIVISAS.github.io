import { describe, expect, it } from 'vitest';
import { importeConLetra } from './numero-a-letras';

describe('importeConLetra', () => {
  it('montos típicos de operaciones cripto', () => {
    expect(importeConLetra(597419.8)).toBe('QUINIENTOS NOVENTA Y SIETE MIL CUATROCIENTOS DIECINUEVE PESOS 80/100 M.N.');
    expect(importeConLetra(45198.31)).toBe('CUARENTA Y CINCO MIL CIENTO NOVENTA Y OCHO PESOS 31/100 M.N.');
    expect(importeConLetra(2752408.28)).toBe('DOS MILLONES SETECIENTOS CINCUENTA Y DOS MIL CUATROCIENTOS OCHO PESOS 28/100 M.N.');
  });

  it('casos especiales', () => {
    expect(importeConLetra(1)).toBe('UN PESO 00/100 M.N.');
    expect(importeConLetra(100)).toBe('CIEN PESOS 00/100 M.N.');
    expect(importeConLetra(1000)).toBe('MIL PESOS 00/100 M.N.');
    expect(importeConLetra(21000)).toBe('VEINTIÚN MIL PESOS 00/100 M.N.');
    expect(importeConLetra(1000000)).toBe('UN MILLÓN DE PESOS 00/100 M.N.');
    expect(importeConLetra(0.5)).toBe('CERO PESOS 50/100 M.N.');
  });
});
