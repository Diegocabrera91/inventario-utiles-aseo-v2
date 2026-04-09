# Inventario de Útiles de Aseo - Guía de Usuario

## 🚀 Inicio Rápido

### 1. Acceder a la Aplicación
- Abre el navegador en tu teléfono o computadora
- Ingresa tu nombre cuando se te pida (se guardará automáticamente)
- ¡Listo! Ya estás dentro del sistema

### 2. Registrar un Movimiento

#### Opción A: Escanear Código de Barras (Recomendado)
1. En la pestaña **"Registrar Movimiento"**, haz clic en el botón 📷 (cámara)
2. Apunta la cámara al código de barras
3. El código se llenará automáticamente
4. Completa los demás campos (descripción, cantidad, etc.)
5. Haz clic en **"Aplicar Movimiento"**

#### Opción B: Ingresar Código Manualmente
1. Escribe el código en el campo "Código de Barras"
2. Completa los demás campos
3. Haz clic en **"Aplicar Movimiento"**

### 3. Campos del Formulario

| Campo | Descripción | Requerido |
|-------|-------------|-----------|
| **Código de Barras** | Identificador único del producto (ej: 001, SKU-123) | Sí |
| **Descripción** | Nombre del producto (ej: Papel higiénico) | Sí |
| **Categoría** | Tipo de producto (ej: Baño, Limpieza) | No |
| **Stock Mínimo** | Cantidad mínima antes de alertar | No |
| **Tipo de Movimiento** | Entrada, Salida o Ajuste | Sí |
| **Cantidad** | Cantidad a registrar | Sí |
| **Observación** | Notas adicionales (ej: Reposición mensual) | No |

### 4. Tipos de Movimiento

- **Entrada**: Cuando llega nuevo stock (compras, donaciones)
- **Salida**: Cuando se usa o se entrega el producto
- **Ajuste**: Para corregir el stock (inventario físico)

## 📊 Vistas Disponibles

### Pestaña "Registrar Movimiento"
- Formulario para registrar nuevos movimientos
- Botón de escaneo de códigos de barras
- Historial de cambios en tiempo real

### Pestaña "Inventario"
- Lista de todos los productos
- Stock actual y mínimo
- Estado del producto (Normal, Bajo mínimo, Sin stock)
- Botón para descargar como CSV

### Pestaña "Historial"
- Registro completo de todos los movimientos
- Quién hizo cada cambio y cuándo
- Stock antes y después de cada movimiento
- Botón para descargar como CSV

## ⚠️ Estados del Inventario

| Estado | Color | Significado |
|--------|-------|-------------|
| **Normal** | Verde ✓ | Stock suficiente |
| **Bajo mínimo** | Amarillo ⚠️ | Stock por debajo del mínimo |
| **Sin stock** | Rojo ✕ | Stock agotado |

## 🔒 Sistema de Bloqueo

Cuando alguien está registrando un movimiento:
- El sistema se **bloquea automáticamente** para otros usuarios
- Verás un mensaje: "El inventario está siendo modificado por [nombre]"
- Espera a que termine (máximo 30 segundos)
- Luego podrás hacer tu movimiento

**Esto evita conflictos y asegura que los datos sean correctos.**

## 📱 Uso en Teléfono

### Permisos Necesarios
- **Cámara**: Para escanear códigos de barras
- **Almacenamiento**: Para descargar archivos CSV

### Cómo Permitir Acceso a la Cámara
1. Abre la aplicación
2. Cuando pida permiso, selecciona **"Permitir"**
3. Si lo rechazaste, ve a Configuración > Aplicaciones > Navegador > Permisos > Cámara

## 💾 Descargar Datos

### Descargar Inventario
1. Ve a la pestaña **"Inventario"**
2. Haz clic en **"Descargar CSV"**
3. Se descargará un archivo con todos los productos

### Descargar Historial
1. Ve a la pestaña **"Historial"**
2. Haz clic en **"Descargar CSV"**
3. Se descargará un archivo con todos los movimientos

## 🆘 Solución de Problemas

### "No se pudo acceder a la cámara"
- Verifica que hayas dado permiso de cámara a la aplicación
- Intenta en otro navegador
- Reinicia la aplicación

### "El código no se detecta"
- Asegúrate de que el código esté bien iluminado
- Acerca la cámara al código
- Intenta con otro código de barras
- Si no funciona, ingresa el código manualmente

### "El inventario está bloqueado"
- Espera 30 segundos a que se libere
- Si sigue bloqueado, recarga la página

### "Perdí mi nombre de usuario"
- Tu nombre se guarda en el navegador
- Si lo borraste, simplemente ingresa uno nuevo
- Cada vez que entres, se te pedirá el nombre

## 📞 Contacto y Soporte

Si tienes problemas o sugerencias, contacta al administrador del sistema.

---

**Última actualización**: Abril 2026
