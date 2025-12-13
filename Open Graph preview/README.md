# OpenGraph Preview - Chrome Extension

Una extensión de Chrome que permite previsualizar y generar meta tags Open Graph directamente desde la URL en la que estás navegando, sin necesidad de visitar opengraph.xyz.

## Características

- ✅ Preview en tiempo real de cómo se verá tu sitio en redes sociales
- ✅ Soporte para Facebook, X (Twitter), LinkedIn y Discord
- ✅ Edición de título, descripción e imagen
- ✅ Generación automática de meta tags HTML
- ✅ Copia al portapapeles con un solo clic
- ✅ Extracción automática de meta tags de la página actual

## Instalación

1. Clona o descarga este repositorio
2. **Genera los iconos** (opcional pero recomendado):
   - Abre `generate-icons.html` en tu navegador
   - Haz clic en "Generar Iconos"
   - Haz clic en "Descargar Todos los Iconos"
   - Guarda los archivos `icon16.png`, `icon48.png` e `icon128.png` en la carpeta de la extensión
   - Si no generas los iconos, la extensión funcionará pero mostrará un icono por defecto
3. Abre Chrome y navega a `chrome://extensions/`
4. Activa el "Modo de desarrollador" en la esquina superior derecha
5. Haz clic en "Cargar extensión sin empaquetar"
6. Selecciona la carpeta de la extensión

## Uso

1. Navega a cualquier página web
2. Haz clic en el icono de la extensión en la barra de herramientas
3. La extensión automáticamente detectará la URL actual y extraerá los meta tags Open Graph
4. Puedes editar el título, descripción e imagen
5. Verás el preview en tiempo real para diferentes plataformas sociales
6. Copia los meta tags generados con el botón "Copy To Clipboard"

## Estructura del Proyecto

```
├── manifest.json       # Configuración de la extensión
├── popup.html         # Interfaz de usuario
├── popup.css          # Estilos
├── popup.js           # Lógica principal
├── icon16.png         # Icono 16x16
├── icon48.png         # Icono 48x48
├── icon128.png        # Icono 128x128
└── README.md          # Este archivo
```

## Permisos

La extensión requiere los siguientes permisos:
- `activeTab`: Para acceder a la pestaña activa
- `tabs`: Para obtener información de las pestañas
- `scripting`: Para inyectar scripts y extraer meta tags
- `<all_urls>`: Para poder analizar cualquier URL

## Notas

- Los iconos (icon16.png, icon48.png, icon128.png) deben ser creados o reemplazados con tus propios iconos
- La extensión funciona mejor en páginas que ya tienen meta tags Open Graph implementados
- Para páginas sin meta tags, la extensión intentará extraer información del título y descripción estándar

## Desarrollo

Para modificar la extensión:
1. Edita los archivos según necesites
2. Ve a `chrome://extensions/`
3. Haz clic en el botón de recargar en la tarjeta de la extensión
4. Prueba los cambios

## Licencia

Este proyecto es de código abierto y está disponible para uso personal y comercial.

