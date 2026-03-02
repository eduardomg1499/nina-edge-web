# Instrucciones para el Agente Local (Mini PC Mele)

¡Hola! Esta carpeta contiene el "Agente Local". Es el puente entre la plataforma web que acabamos de crear y el software NINA que controla tu telescopio.

## ¿Qué es esto?
La plataforma web vive en la "nube" (internet). Tu telescopio y NINA viven en tu "Mini PC" (local). Para que la web pueda decirle a NINA qué hacer, necesitas un pequeño programa corriendo en el Mini PC que escuche a la web y le pase las instrucciones a NINA. Ese programa es este **Agente Local**.

## Pasos para instalarlo en tu Mini PC (Mele)

1. **Descarga Node.js:**
   - Ve a tu Mini PC (donde está NINA).
   - Abre el navegador y entra a [nodejs.org](https://nodejs.org/).
   - Descarga e instala la versión "LTS" (Recomendada para la mayoría). Es como instalar cualquier otro programa de Windows (Siguiente, Siguiente, Instalar).

2. **Copia estos archivos:**
   - Copia esta carpeta completa (`agente-local`) a tu Mini PC. Puedes ponerla en el Escritorio o en Documentos.
   - Los archivos importantes son `agente.js` y `package.json`.

3. **Instala las dependencias:**
   - Abre la carpeta `agente-local` en tu Mini PC.
   - Haz clic en la barra de direcciones de la carpeta (arriba, donde dice la ruta), escribe `cmd` y presiona Enter. Esto abrirá una ventana negra de comandos (Símbolo del sistema).
   - Escribe el siguiente comando y presiona Enter:
     ```bash
     npm install
     ```
   - Verás que se descarga una carpeta llamada `node_modules`.

4. **Ejecuta el Agente:**
   - En esa misma ventana negra, escribe:
     ```bash
     node agente.js
     ```
   - ¡Listo! Verás un mensaje diciendo que está intentando conectar a la nube.

## ¿Cómo se conecta con NINA realmente?
El archivo `agente.js` que te he dado es una **plantilla funcional**. Actualmente simula que mueve el telescopio y envía una foto de prueba.

Para que controle NINA de verdad, en el futuro tendrás que instalar un plugin en NINA llamado **"Web API"** (o similar) que permite que programas externos le envíen comandos. Luego, en el archivo `agente.js`, reemplazarás los comentarios que dicen `// AQUI: En un caso real...` por las peticiones reales a la API de NINA.
