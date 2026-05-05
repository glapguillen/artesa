# Artesa AI Investment Dashboard

Aplicación web profesional e interactiva para explorar rankings históricos de empresas, oportunidades de inversión por capital disponible y tamaño empresarial, proyecciones a 3, 5 y 7 años, detección de oportunidades emergentes y consultas asistidas por IA.

## Ejecutar

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Datos

El repositorio de datos está en `src/data`. La aplicación usa datos locales versionados para rankings históricos y oportunidades. La capa `src/services/dataRepository.js` centraliza la lectura e interacción con esos datos para que pueda sustituirse por una API o base de datos posteriormente.
