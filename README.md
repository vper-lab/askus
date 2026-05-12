# askUs ðŸŽ²

Â¿QuiÃ©n es mÃ¡s probable que...? â€” versiÃ³n para tu grupo de amigos.

Una app web para jugar "Â¿QuiÃ©n es mÃ¡s probable que...?" con amigos. Crea salas privadas, vota preguntas divertidas y chatea en tiempo real.

---

## ðŸš€ CaracterÃ­sticas

- ðŸŽ¯ **Preguntas diarias**: 200 preguntas organizadas por categorÃ­as
- ðŸ‘¥ **Salas privadas**: Crea salas con cÃ³digos Ãºnicos para tu grupo
- ðŸ—³ï¸ **Votaciones en tiempo real**: Vota quiÃ©n es mÃ¡s probable que...
- ðŸ’¬ **Chat integrado**: Chatea mientras juegas
- ðŸ“± **Responsive**: Funciona en mÃ³vil y desktop
- ðŸ”¥ **Firebase**: Persistencia en tiempo real (Realtime Database)
- âš¡ **RÃ¡pido**: Vite + React para desarrollo moderno

---

## ðŸ“‹ Requisitos

- Node.js 18+
- Cuenta de Google (para Firebase)

---

## ðŸ› ï¸ InstalaciÃ³n y configuraciÃ³n

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
   - Ve a **Build â†’ Realtime Database**
   - Haz clic en **"Crear base de datos"**
   - Elige **"Comenzar en modo de prueba"**
   - Selecciona regiÃ³n (ej: `europe-west1`)
4. Registra una app web:
   - Ve a **ConfiguraciÃ³n del proyecto** (âš™ï¸)
   - PestaÃ±a **"Tus apps"**
   - Haz clic en **`</>`** (web)
   - Pon nombre y registra
5. Copia la configuraciÃ³n que aparece

### 4. Configura variables de entorno

Copia `.env.example` a `.env`:

```bash
cp .env.example .env
```

Edita `.env` con tus valores de Firebase:

```env
# Firebase configuration
FIREBASE_API_KEY=tu_apiKey
FIREBASE_AUTH_DOMAIN=tu_authDomain
FIREBASE_DATABASE_URL=https://tu-proyecto-default-rtdb.region.firebasedatabase.app
FIREBASE_PROJECT_ID=tu_projectId
FIREBASE_STORAGE_BUCKET=tu_storageBucket
FIREBASE_MESSAGING_SENDER_ID=tu_messagingSenderId
FIREBASE_APP_ID=tu_appId
FIREBASE_MEASUREMENT_ID=tu_measurementId
```

> **Nota**: El `FIREBASE_DATABASE_URL` es el mÃ¡s importante. Lo encuentras en Firebase Console â†’ Realtime Database â†’ URL en la parte superior.

### 5. Configura reglas de seguridad (desarrollo)

Para desarrollo, pon reglas pÃºblicas en Firebase Console â†’ Realtime Database â†’ Rules:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

> âš ï¸ **Importante**: Estas reglas hacen la base de datos pÃºblica. Solo para desarrollo. Para producciÃ³n, configura reglas seguras con autenticaciÃ³n.

### 6. Ejecuta en local

```bash
npm run dev
```

Abre `http://localhost:5173` en el navegador.

---

## ðŸŽ® CÃ³mo jugar

1. **Crear sala**: Pon tu nombre y elige cuÃ¡ntas preguntas diarias (2-10)
2. **Comparte cÃ³digo**: Da el cÃ³digo de sala a tus amigos
3. **Juega**: Vota quiÃ©n es mÃ¡s probable que... en cada pregunta
4. **Chatea**: Habla mientras votÃ¡is

---

## ðŸ“ Estructura del proyecto

```
askus/
â”œâ”€â”€ index.html              # HTML principal
â”œâ”€â”€ package.json            # Dependencias y scripts
â”œâ”€â”€ vite.config.js          # ConfiguraciÃ³n Vite
â”œâ”€â”€ questions.json          # 200 preguntas del juego
â”œâ”€â”€ server.js               # Backend Express (generaciÃ³n preguntas)
â”œâ”€â”€ .env                    # Variables de entorno (no subir a git)
â”œâ”€â”€ .env.example            # Ejemplo de variables
â””â”€â”€ src/
    â”œâ”€â”€ main.jsx            # Punto de entrada React
    â”œâ”€â”€ App.jsx             # Componente principal
    â”œâ”€â”€ firebase.js         # ConfiguraciÃ³n Firebase
    â””â”€â”€ index.css           # Estilos globales
```

---

## ðŸ”§ Desarrollo

### AÃ±adir mÃ¡s preguntas

Edita `questions.json` para aÃ±adir preguntas nuevas. El formato es:

```json
{
  "questions": [
    "Quien es mas probable que [acciÃ³n]?",
    "Quien es mas probable que [otra acciÃ³n]?"
  ]
}
```

### Personalizar colores/avatares

Edita la constante `PALETTE` en `src/App.jsx`.

### Despliegue en producciÃ³n

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

## ðŸ› SoluciÃ³n de problemas

### "Firebase no estÃ¡ configurado"
- Verifica que `.env` tenga todos los valores correctos
- Reinicia `npm run dev`
- Comprueba que `FIREBASE_DATABASE_URL` sea vÃ¡lido

### "Error al crear sala"
- Verifica reglas de Firebase (deben permitir escritura)
- Comprueba conexiÃ³n a internet

### Preguntas no se generan
- Verifica que `questions.json` exista y tenga preguntas
- Reinicia el servidor

---

## ðŸ“„ Licencia

Este proyecto es de cÃ³digo abierto. Ãšsalo como quieras.

---

## ðŸ¤ Contribuir

1. Fork el repo
2. Crea una rama (`git checkout -b feature/nueva-funcion`)
3. Commit cambios (`git commit -am 'AÃ±ade nueva funciÃ³n'`)
4. Push (`git push origin feature/nueva-funcion`)
5. Abre un Pull Request

---

Â¡DiviÃ©rtete jugando con tus amigos! ðŸŽ‰

