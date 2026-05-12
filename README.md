# askUs 🎲

¿Quién es más probable que...? — versión para tu grupo de amigos.

Una app web para jugar "¿Quién es más probable que...?" con amigos. Crea salas privadas, vota preguntas divertidas y chatea en tiempo real.

---

## 🚀 Características

- 🎯 **Preguntas diarias**: 200 preguntas organizadas por categorías
- 👥 **Salas privadas**: Crea salas con códigos únicos para tu grupo
- 🗳️ **Votaciones en tiempo real**: Vota quién es más probable que...
- 💬 **Chat integrado**: Chatea mientras juegas
- 📱 **Responsive**: Funciona en móvil y desktop
- 🔥 **Firebase**: Persistencia en tiempo real (Realtime Database)
- ⚡ **Rápido**: Vite + React para desarrollo moderno

---

## 📋 Requisitos

- Node.js 18+
- Cuenta de Google (para Firebase)

---

## 🛠️ Instalación y configuración

### 1. Clona o descarga el proyecto

```bash
git clone <tu-repo>
cd askus
```

### 2. Instala dependencias

```bash
npm install
```

### 3. Configura Firebase (gratis)

1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. Crea un nuevo proyecto (ej: `askus-grupo`)
3. Habilita **Realtime Database**:
   - Ve a **Build → Realtime Database**
   - Haz clic en **"Crear base de datos"**
   - Elige **"Comenzar en modo de prueba"**
   - Selecciona región (ej: `europe-west1`)
4. Registra una app web:
   - Ve a **Configuración del proyecto** (⚙️)
   - Pestaña **"Tus apps"**
   - Haz clic en **`</>`** (web)
   - Pon nombre y registra
5. Copia la configuración que aparece

### 4. Configura variables de entorno

Copia `.env.example` a `.env`:

```bash
cp .env.example .env
```

Edita `.env` con tus valores de Firebase:

```env
# Firebase configuration
VITE_FIREBASE_API_KEY=tu_apiKey
VITE_FIREBASE_AUTH_DOMAIN=tu_authDomain
VITE_FIREBASE_DATABASE_URL=https://tu-proyecto-default-rtdb.region.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=tu_projectId
VITE_FIREBASE_STORAGE_BUCKET=tu_storageBucket
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_messagingSenderId
VITE_FIREBASE_APP_ID=tu_appId
VITE_FIREBASE_MEASUREMENT_ID=tu_measurementId
```

> **Nota**: El `VITE_FIREBASE_DATABASE_URL` es el más importante. Lo encuentras en Firebase Console → Realtime Database → URL en la parte superior.

### 5. Configura reglas de seguridad (desarrollo)

Para desarrollo, pon reglas públicas en Firebase Console → Realtime Database → Rules:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

> ⚠️ **Importante**: Estas reglas hacen la base de datos pública. Solo para desarrollo. Para producción, configura reglas seguras con autenticación.

### 6. Ejecuta en local

```bash
npm run dev
```

Abre `http://localhost:5173` en el navegador.

---

## 🎮 Cómo jugar

1. **Crear sala**: Pon tu nombre y elige cuántas preguntas diarias (2-10)
2. **Comparte código**: Da el código de sala a tus amigos
3. **Juega**: Vota quién es más probable que... en cada pregunta
4. **Chatea**: Habla mientras votáis

---

## 📁 Estructura del proyecto

```
askus/
├── index.html              # HTML principal
├── package.json            # Dependencias y scripts
├── vite.config.js          # Configuración Vite
├── questions.json          # 200 preguntas del juego
├── server.js               # Backend Express (generación preguntas)
├── .env                    # Variables de entorno (no subir a git)
├── .env.example            # Ejemplo de variables
└── src/
    ├── main.jsx            # Punto de entrada React
    ├── App.jsx             # Componente principal
    ├── firebase.js         # Configuración Firebase
    └── index.css           # Estilos globales
```

---

## 🔧 Desarrollo

### Añadir más preguntas

Edita `questions.json` para añadir preguntas nuevas. El formato es:

```json
{
  "questions": [
    "Quien es mas probable que [acción]?",
    "Quien es mas probable que [otra acción]?"
  ]
}
```

### Personalizar colores/avatares

Edita la constante `PALETTE` en `src/App.jsx`.

### Despliegue en producción

**Vercel (recomendado):**
```bash
npm install -g vercel
vercel
```

**Netlify:**
```bash
npm run build
# Sube la carpeta `dist` a Netlify
```

---

## 🐛 Solución de problemas

### "Firebase no está configurado"
- Verifica que `.env` tenga todos los valores correctos
- Reinicia `npm run dev`
- Comprueba que `VITE_FIREBASE_DATABASE_URL` sea válido

### "Error al crear sala"
- Verifica reglas de Firebase (deben permitir escritura)
- Comprueba conexión a internet

### Preguntas no se generan
- Verifica que `questions.json` exista y tenga preguntas
- Reinicia el servidor

---

## 📄 Licencia

Este proyecto es de código abierto. Úsalo como quieras.

---

## 🤝 Contribuir

1. Fork el repo
2. Crea una rama (`git checkout -b feature/nueva-funcion`)
3. Commit cambios (`git commit -am 'Añade nueva función'`)
4. Push (`git push origin feature/nueva-funcion`)
5. Abre un Pull Request

---

¡Diviértete jugando con tus amigos! 🎉
