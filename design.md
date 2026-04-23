# Design System & UI/UX Specification — Inventario Patrimonial

## Visión de diseño

Interfaz limpia, moderna y mobile-first. Prioriza acceso rápido con un clic, usa colores consistentes, tipografía clara y espaciado generoso. Soporta light/dark mode automáticamente. Componentes reutilizables de shadcn/ui aseguran consistencia.

## Paleta de colores

### Colores principales (Tailwind CSS v4)

- **Primary:** `oklch(0.578 0.19 259)` (azul teal, botones principales)
- **Background:** `oklch(0.145 0)` dark / `oklch(0.98 0.002 264)` light
- **Foreground:** `oklch(0.98 0.002 264)` dark / `oklch(0.145 0)` light
- **Card:** `oklch(0.205 0)` dark / `oklch(0.97 0.002 264)` light
- **Muted:** `oklch(0.285 0)` dark / `oklch(0.93 0.0031 264)` light
- **Border:** `oklch(0.285 0)` dark / `oklch(0.93 0.0031 264)` light

### Estados

- **Success (✓):** `oklch(0.68 0.16 142)` (verde)
- **Destructive:** `oklch(0.63 0.25 27)` (rojo)
- **Warning:** `oklch(0.80 0.18 71)` (naranja/amarillo)
- **Muted/Disabled:** `oklch(0.50 0.05 0)` (gris)

## Tipografía

- **Font Family:** Sistema predeterminado (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`)
- **Heading 1:** 32px, bold, line-height 1.2 (h1.page-title)
- **Heading 2:** 24px, semibold, line-height 1.3
- **Body:** 14px/16px, regular, line-height 1.5
- **Small/Label:** 12px, medium, line-height 1.4
- **Monospace (código/números):** `font-mono`, para códigos patrimoniales y direcciones

## Componentes base (shadcn/ui)

### Button

```tsx
// Variantes principales
<Button variant="default">        {/* primary, color full */}
<Button variant="secondary">      {/* muted background */}
<Button variant="outline">        {/* border, no fill */}
<Button variant="ghost">          {/* texto solo, hover light */}
<Button variant="destructive">    {/* rojo */}

// Tamaños
<Button size="sm">    {/* h-8 text-xs */}
<Button size="default"> {/* h-10 text-sm */}
<Button size="lg">    {/* h-12 text-base */}
<Button size="icon">  {/* h-10 w-10, centrado */}

// Estados
<Button disabled>
```

**Uso recomendado:**
- Botones principales de acción: `variant="default"`
- Cancelar/alternativo: `variant="outline"` o `variant="ghost"`
- Destructivo (eliminar): `variant="destructive"` con AlertDialog
- Icono de toggle/quick action: `size="icon"`

### Input

```tsx
<Input placeholder="..." />        {/* text input */}
<Input type="number" step="0.01" /> {/* número */}
<Input type="email" />             {/* email */}
<Input disabled />

// Con label
<Label htmlFor="campo">Etiqueta</Label>
<Input id="campo" />
```

**UX:**
- Placeholder en gris claro (no es instrucción, es ejemplo)
- Label siempre arriba del input
- Error mensaje bajo el campo en rojo

### Select (nativo)

```tsx
<Select value={state} onValueChange={setState}>
  <SelectTrigger>
    <SelectValue placeholder="Selecciona..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="opcion1">Opción 1</SelectItem>
    <SelectItem value="opcion2">Opción 2</SelectItem>
  </SelectContent>
</Select>
```

### Card

```tsx
<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descripción opcional</CardDescription>
  </CardHeader>
  <CardContent>
    {/* contenido principal */}
  </CardContent>
</Card>
```

**Uso:** Agrupar secciones de contenido relacionado. Max-width en desktop: 768px (md).

### AlertDialog

```tsx
<AlertDialog open={isOpen} onOpenChange={setIsOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>¿Confirmar acción?</AlertDialogTitle>
      <AlertDialogDescription>
        Descripción clara y específica de qué pasará.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction onClick={handleConfirm}>
        Sí, confirmar
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Uso:** Acciones críticas (eliminar, revocar, cambiar rol, carga masiva). Botón destructivo en rojo si es destructivo.

### Badge

```tsx
<Badge variant="default">Activo</Badge>
<Badge variant="secondary">Pendiente</Badge>
<Badge variant="warning">Advertencia</Badge>
<Badge variant="destructive">Error</Badge>
```

### Alert

```tsx
<Alert variant="default">
  <AlertDescription>Mensaje informativo</AlertDescription>
</Alert>

<Alert variant="success">    {/* verde */}
<Alert variant="warning">    {/* amarillo */}
<Alert variant="destructive"> {/* rojo */}
```

### Table

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Encabezado 1</TableHead>
      <TableHead>Encabezado 2</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Dato 1</TableCell>
      <TableCell>Dato 2</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

**Mobile:** Envolver en `<div className="overflow-x-auto">` para scroll horizontal.

## Layouts principales

### Layout Desktop

```
┌─────────────────────────────────┐
│  Sidebar (w-64)    │ Header (md:hidden)
├─────────────────────────────────┤
│                                 │
│ Sidebar                         │ Main Content
│ - Logo                          │ (md:ml-64)
│ - Nav items                     │
│ - Footer (user, theme, logout)  │
│ - Toggle button (-, right)      │
│                                 │
└─────────────────────────────────┘
```

**Sidebar:** Fixed en `left-0 top-0 h-screen w-64` (colapsado: w-14). Transición suave 200ms. Botón toggle con z-10 sobresale.

### Layout Mobile

```
┌──────────────────┐
│ Header compacto  │
├──────────────────┤
│                  │
│ Main Content     │
│                  │
├──────────────────┤
│ Bottom Nav (6-10 items) │
└──────────────────┘
```

**Header móvil:** Sticky top. Logo + user info + back button.
**Bottom Nav:** Fixed. Iconos + label. 5-6 items principales + IA.

## Patrones UI

### Campos obligatorios

```tsx
<Label>Nombre *</Label>
<Input required />
```

El asterisco indica obligatorio. Validar al submit.

### Feedback visual

- **Éxito:** Verde + icono ✓ + toast "Guardado" (sonner)
- **Error:** Rojo + mensaje debajo del campo
- **Loading:** Spinner azul + "Cargando..." + disabled button
- **Copiar:** Botón verde + "Copiado!" + toast (500ms)

### Iconos (Lucide React)

Tamaños estándar:
- Texto inline: 16px (h-4 w-4)
- Header/botón: 20px (h-5 w-5)
- Grande/hero: 32px+ (h-8 w-8+)

Colores:
- Default: `text-foreground`
- Muted: `text-muted-foreground`
- Primary: `text-primary`
- Destructivo: `text-destructive`

### Espaciado (Tailwind)

- **Padding:** px-3/4, py-2/3 (pequeño) → px-5/6, py-4 (grande)
- **Gap:** gap-2 (pequeño) → gap-4 (medio) → gap-6 (grande)
- **Margin:** my-3, mb-2, etc.
- **Section spacing:** `space-y-5` (entre cards/secciones)

### Bordes y sombras

- **Border:** `border border-border` (línea sutil)
- **Rounded:** `rounded-xl` (12px, esquinas redondeadas)
- **Shadow:** `shadow-sm` (cards), `shadow-md` (dropdowns)

## Flujos visuales

### Login (OTP + Passkey)

1. **Pantalla inicial:** Correo + botón "Enviar código"
2. **Correo enviado:** Spinner + "Código enviado a [email]"
3. **Ingreso de código:** 6 dígitos + botón "Verificar"
4. **Exitoso:** ✓ + redirect a Home
5. **Error:** Mensaje rojo + retry link
6. **Passkey disponible:** Link alternativo "Continuar con passkey"

### Registro de bien

1. **Scan modal:** Cámara + marco + "Escanear" + "Escribir manual"
2. **Código detectado:** Auto-close + BienForm abre
3. **Duplicado encontrado:** DuplicateAlert (Ver/Editar/Registrar otro)
4. **Form abierto:** Campos pre-llenados con SIGA data (silencioso)
5. **Validación error:** Mensaje rojo, campo marcado
6. **Guardado:** Toast "Bien registrado" + opciones (Ver/Editar/Registrar otro)

### Búsqueda

1. **Desktop:** Todos los filtros visibles, formulario arriba
2. **Mobile:** Solo código visible, botón "Filtros avanzados" + contador
3. **Resultados:** Tabla (desktop) / Cards (mobile)
4. **Menú ⋮:** Dropdown con Ver/Editar/Eliminar
5. **Copiar:** Botón verde + toast "Copiado"

### SIGA PJ

1. **Sin búsqueda:** Icono DB + "Ingresa un filtro..."
2. **Buscando:** Spinners en filas (skeleton)
3. **Sin resultados:** "Sin resultados para los filtros ingresados"
4. **Con resultados:** Tabla paginada, fecha actualización en subtítulo
5. **Paginación:** Botones Anterior/Siguiente con contador

## Dark Mode

**Sistema:** next-themes + Tailwind `dark:` prefix

```tsx
// En componentes
<div className="bg-background text-foreground dark:bg-card">

// Variables CSS automáticas
body.dark {
  --background: oklch(0.145 0);
  --foreground: oklch(0.98 0.002 264);
  ...
}
```

**Persistencia:** localStorage `theme='dark'|'light'|'system'`

## Responsive breakpoints (Tailwind)

| Breakpoint | Ancho | Uso |
|-----------|-------|-----|
| sm | 640px | Teléfono grande |
| md | 768px | Tablet |
| lg | 1024px | Desktop |
| xl | 1280px | Desktop grande |

**Mobile-first:** Estilos base móvil, luego `md:hidden`, `lg:flex`, etc.

## Accesibilidad (WCAG 2.1 AA)

- **Contraste:** 4.5:1 mínimo (texto normal), 3:1 (grande)
- **Focus visible:** `focus-visible:ring-2 focus-visible:ring-ring` en botones
- **Labels:** Siempre asociados con `htmlFor` en inputs
- **ARIA:** `aria-current="page"` en nav activo, `aria-hidden` en iconos puros
- **Teclado:** Tab navigation, Enter en botones, Escape en dialogs
- **Semántica:** `<button>` para acciones, `<a>` para links

## Animaciones

- **Transiciones:** 200ms ease-in-out para color, opacity, transform
- **Sidebar toggle:** `transition-[width] duration-200 ease-in-out`
- **Spinner:** `.animate-spin` en `Loader2` icon
- **Ripple:** No incluir, mantener simple

## Ejemplos de pantallas

### Home (inicio)

```
┌──────────────────────┐
│ Inventario          │ (title)
│ Sedes disponibles   │ (subtitle)
├──────────────────────┤
│ [Card Escanear]     │
│ Abre modal          │
│                     │
│ [Card Buscar]       │
│ Ir a /search        │
│                     │
│ [Card SIGA PJ]      │ (nuevo)
│ Ir a /siga-pj       │
│                     │
│ [Card Admin]        │
│ Si es admin         │
└──────────────────────┘
```

### Search (búsqueda)

**Desktop:**
```
┌─ Código ──────────────────────────┐
├─────────────────────────────────────┤
│ Trabajador │ Ubicación │ ...        │
├─────────────────────────────────────┤
│ [Buscar]                             │
├─────────────────────────────────────┤
│ Tabla con resultados + menú ⋮        │
└─────────────────────────────────────┘
```

**Mobile:**
```
┌─ Código ──────────────────────────┐
│ [▼ Filtros avanzados] (1)         │
├─────────────────────────────────────┤
│ (collapsed)                         │
├─────────────────────────────────────┤
│ [Buscar]                            │
├─────────────────────────────────────┤
│ Cards con resultados                │
└─────────────────────────────────────┘
```

### SIGA PJ (nuevo)

```
┌──────────────────────────────────────┐
│ Base SIGA PJ                         │
│ Datos actualizados al [fecha]        │ ← subtítulo
├──────────────────────────────────────┤
│ ┌─ Búsqueda ────────────────────────┐│
│ │ Código│Descripción│Responsable    ││
│ │ [Buscar]                          ││
│ └───────────────────────────────────┘│
├──────────────────────────────────────┤
│ Tabla paginada (25/página)           │
│ Pág. 1 de 10 · 250 registros        │
│ [Anterior] [Siguiente]               │
└──────────────────────────────────────┘
```

## Guía de estilo — tone of voice

- **Amigable:** "¡Guardado! El bien se registró correctamente."
- **Claro:** Mensajes sin jerga técnica
- **Accionable:** "Intenta nuevamente" + retry link vs "Error"
- **Español:** UI completamente en español
- **Breve:** Máximo 1-2 líneas por mensaje

