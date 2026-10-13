// Parámetros del simulador. Son valores SIMULADOS para la demostración, no medidas de la planta:
// cuando haya datos reales llegarán por otra DataSource y este archivo no se usa.

type Tabla = Readonly<Record<string, number>>

export interface ParamHorno {
  /** Piscina de la que se carga el horno. */
  entrada: string
  /** Piscina a la que descarga. */
  salida: string
  objetivoC: number
  /** Carga máxima (pzs/min). */
  capCarga: number
  /** Tiempo medio de permanencia dentro del horno (min). */
  residenciaMin: number
  gasM3h: number
  /** De qué clasificación sale la "calidad" del OEE. */
  calidad: 'bizcocho' | 'final'
}

export const PARAM = {
  /** Productividad por persona (pzs/h) de las etapas manuales; se multiplica por la dotación. */
  productividad: { '1.1': 21, '1.3': 23, '1.7': 75, '2.1': 40, '2.2': 40, '2.3': 17, '2.4': 70, '3.3': 70 } as Tabla,
  /** Personas que se asumen si la dotación no asigna a nadie a la etapa. */
  personasMin: { '1.1': 6, '1.3': 6, '1.7': 2, '2.1': 1, '2.2': 1, '2.3': 6, '2.4': 2, '3.3': 2 } as Tabla,
  /** Capacidad (pzs/min) de etapas no manuales. */
  capacidad: { '2.0': 2.9, '2.5': 1.6, '3.4': 0.5, '3.5': 0.5, '3.8': 0.15, ventas: 2.2 } as Tabla,
  /** Hornos por código de etapa de quema. */
  hornos: {
    '1.5': {
      entrada: '1.4',
      salida: '1.6',
      objetivoC: 1000,
      capCarga: 3.6,
      residenciaMin: 40,
      gasM3h: 36,
      calidad: 'bizcocho',
    },
    '3.1': {
      entrada: '2.6',
      salida: '3.2',
      objetivoC: 1080,
      capCarga: 3.4,
      residenciaMin: 40,
      gasM3h: 42,
      calidad: 'final',
    },
  } as Readonly<Record<string, ParamHorno>>,
  /** WIP heredado del turno anterior (pzs) en colas, piscinas y bodegas. */
  wipInicial: {
    '1.3': 30,
    '1.4': 70,
    '1.6': 220,
    '1.8': 1500,
    '2.6': 60,
    '3.2': 200,
    '3.4': 10,
    '3.5': 0,
    '3.6': 4200,
    '3.8': 25,
  } as Tabla,
  /** Piezas en proceso al inicio en cada paso de cada ruta de decoración. */
  wipInicialPorPasoRuta: 4,
  /** Umbral de WIP alto por piscina: por encima la piscina queda en 'espera' (con histéresis del 10 %). */
  umbralWipAlto: { '1.4': 160, '1.6': 300, '2.6': 160, '3.2': 300 } as Tabla,
  histeresisWip: 0.9,
  /** Mezcla de métodos de formación (se normaliza). */
  pesoRutaFormacion: { RF1: 0.3, RF2: 0.15, RF3: 0.15, RF4: 0.13, RF5: 0.12, RF6: 0.05, RF7: 0.1 } as Tabla,
  /** Rechazo base en CC de formación (%) por método. */
  rechazoCcPct: { RF1: 6, RF2: 4, RF3: 7, RF4: 3.5, RF5: 2.5, RF6: 9, RF7: 8 } as Tabla,
  /** Mezcla de rutas de decoración (se normaliza). */
  pesoRutaDecoracion: {
    R1: 0.08,
    R2: 0.08,
    R3: 0.1,
    R4: 0.22,
    R5: 0.15,
    R6: 0.12,
    R7: 0.07,
    R8: 0.08,
    R9: 0.1,
  } as Tabla,
  /** Mezcla nominal de la clasificación de bizcocho (1.7). */
  mixBizcocho: { buena: 0.95, mala: 0.05 } as Tabla,
  /** Mezcla nominal de la clasificación final (3.3). */
  mixFinal: {
    tipo_a: 0.6,
    tipo_b: 0.17,
    tipo_c: 0.07,
    ok_falta_calcomania: 0.08,
    desecho: 0.04,
    recuperable: 0.04,
  } as Tabla,
  /** Resultados de 3.3 que cuentan como piezas buenas del turno. */
  resultadosBuenos: ['tipo_a', 'tipo_b', 'tipo_c', 'ok_falta_calcomania'] as readonly string[],
  /** Salidas no productivas en 2.0 (roturas, muestras, pruebas), % de lo liberado. */
  noProductivasPct: 0.6,
  /** Pasta dada de baja por pieza rechazada en CC (kg) y merma base (kg/min). */
  kgPastaPorRechazo: 1.1,
  kgPastaBasePorMin: 0.05,
  /** Pasta equivalente por pieza formada (kg), para la tasa de molinos y extrusora. */
  kgPastaPorPieza: 1.4,
  /** Esmalte por pieza esmaltada y color por pieza decorada (kg). */
  kgEsmaltePorPieza: 0.18,
  kgColorPorPieza: 0.03,
} as const
