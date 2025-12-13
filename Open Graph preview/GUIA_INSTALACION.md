# Guía Visual de Instalación - OpenGraph Preview Extension

## 📋 Paso 1: Generar los Iconos (Opcional pero Recomendado)

### Opción A: Usando el Generador HTML

1. **Abre el archivo `generate-icons.html`**
   - Haz doble clic en el archivo `generate-icons.html`
   - O arrastra el archivo a una ventana de Chrome
   - O haz clic derecho → "Abrir con" → Chrome

2. **Verás una página con este contenido:**
   ```
   [Generador de Iconos para OpenGraph Preview Extension]
   
   [Generar Iconos]  [Descargar Todos los Iconos]
   
   [Vista previa de los iconos aparecerá aquí]
   ```

3. **Haz clic en "Generar Iconos"**
   - Verás 3 iconos aparecer en la página (16x16, 48x48, 128x128)

4. **Haz clic en "Descargar Todos los Iconos"**
   - Se descargarán automáticamente 3 archivos:
     - `icon16.png`
     - `icon48.png`
     - `icon128.png`

5. **Mueve los archivos descargados**
   - Copia los 3 archivos PNG a la carpeta de la extensión
   - Deben estar en la misma carpeta que `manifest.json`, `popup.html`, etc.

### Opción B: Crear Iconos Manualmente

Si prefieres crear tus propios iconos:
- Crea 3 imágenes PNG con tamaños: 16x16, 48x48, 128x128 píxeles
- Nómbralos: `icon16.png`, `icon48.png`, `icon128.png`
- Colócalos en la carpeta de la extensión

### Opción C: Omitir los Iconos

- La extensión funcionará sin iconos, pero mostrará un icono genérico de Chrome
- Puedes saltarte este paso si quieres probar la extensión rápido

---

## 🔧 Paso 2: Activar Modo Desarrollador en Chrome

### Instrucciones Detalladas:

1. **Abre Google Chrome**

2. **Abre la página de Extensiones**
   - Método 1: Escribe en la barra de direcciones: `chrome://extensions/`
   - Método 2: Menú (3 puntos) → Más herramientas → Extensiones
   - Método 3: Presiona `Ctrl+Shift+E` (Windows) o `Cmd+Shift+E` (Mac)

3. **Activa el Modo de Desarrollador**
   - En la esquina **superior derecha** de la página de extensiones
   - Verás un **toggle/interruptor** que dice "Modo de desarrollador" o "Developer mode"
   - **Haz clic en el toggle** para activarlo
   - Debe cambiar de color (generalmente se pone azul o naranja cuando está activo)
   - Verás que aparecen nuevos botones arriba: "Cargar extensión sin empaquetar", "Empaquetar extensión", etc.

   ```
   [Modo de desarrollador] ← Haz clic aquí para activarlo
   ```

4. **Verifica que está activado**
   - Debe verse el toggle en posición "ON" o activado
   - Deben aparecer los botones adicionales mencionados arriba

---

## 📦 Paso 3: Cargar la Extensión

1. **Haz clic en "Cargar extensión sin empaquetar"**
   - Este botón solo aparece cuando el Modo de Desarrollador está activado
   - Está ubicado en la parte superior de la página de extensiones

2. **Selecciona la carpeta de la extensión**
   - Se abrirá un explorador de archivos
   - Navega hasta la carpeta que contiene:
     - `manifest.json`
     - `popup.html`
     - `popup.css`
     - `popup.js`
     - (y opcionalmente los iconos: `icon16.png`, `icon48.png`, `icon128.png`)
   - **Selecciona la carpeta completa** (no los archivos individuales)
   - Haz clic en "Seleccionar carpeta" o "Abrir"

3. **Verifica la instalación**
   - La extensión debería aparecer en la lista de extensiones
   - Verás el nombre "OpenGraph Preview"
   - Deberías ver un icono en la barra de herramientas de Chrome (junto a la barra de direcciones)

---

## ✅ Paso 4: Usar la Extensión

1. **Navega a cualquier página web**
   - Por ejemplo: https://feverup.com
   - O cualquier otra página que quieras analizar

2. **Haz clic en el icono de la extensión**
   - Está en la barra de herramientas de Chrome
   - Si no lo ves, haz clic en el icono de "extensión" (puzzle) en la barra de herramientas

3. **La extensión se abrirá**
   - Automáticamente detectará la URL actual
   - Extraerá los meta tags Open Graph
   - Mostrará el preview para diferentes plataformas sociales

4. **Puedes editar los campos**
   - Modifica el título, descripción o imagen
   - Los cambios se reflejan en tiempo real en los previews
   - Genera el código HTML automáticamente

5. **Copia los meta tags**
   - Haz clic en "Copy To Clipboard"
   - Pega el código en tu sitio web

---

## 🐛 Solución de Problemas

### "No puedo encontrar el toggle de Modo de Desarrollador"
- Asegúrate de estar en `chrome://extensions/`
- El toggle está en la esquina superior derecha
- Si no lo ves, actualiza la página (F5)

### "El botón 'Cargar extensión sin empaquetar' no aparece"
- Verifica que el Modo de Desarrollador esté activado
- El toggle debe estar en posición "ON"
- Recarga la página de extensiones

### "Error al cargar la extensión"
- Verifica que todos los archivos estén en la misma carpeta
- Asegúrate de seleccionar la carpeta, no archivos individuales
- Revisa la consola de errores (F12) para más detalles

### "Los iconos no aparecen"
- No es crítico, la extensión funcionará igual
- Puedes generar los iconos después usando `generate-icons.html`

### "La extensión no extrae los meta tags"
- Algunas páginas bloquean la inyección de scripts
- Intenta con otra URL
- Algunas páginas no tienen meta tags Open Graph implementados

---

## 📸 Capturas de Pantalla de Referencia

### Ubicación del Modo de Desarrollador:
```
┌─────────────────────────────────────────┐
│  chrome://extensions/                   │
├─────────────────────────────────────────┤
│                                         │
│  [Modo de desarrollador] ← AQUÍ        │
│                                         │
│  [Cargar extensión sin empaquetar]     │
│  [Empaquetar extensión]                │
│                                         │
└─────────────────────────────────────────┘
```

### Estructura de Carpetas Correcta:
```
Custom Chrome Extensions/
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
├── icon16.png      ← Opcional
├── icon48.png      ← Opcional
├── icon128.png     ← Opcional
├── README.md
└── generate-icons.html
```

---

## 💡 Consejos

- Mantén el Modo de Desarrollador activado solo cuando estés desarrollando extensiones
- Puedes desactivarlo después, pero la extensión seguirá funcionando
- Si modificas los archivos de la extensión, recarga la extensión haciendo clic en el icono de recarga en `chrome://extensions/`
- Los cambios se aplican inmediatamente sin necesidad de recargar Chrome

---

¿Necesitas más ayuda? Revisa el archivo `README.md` para más información técnica.

