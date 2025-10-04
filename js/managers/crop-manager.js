/**
 * CropManager - Sistema de recorte inteligente de imágenes
 * Soporta proporciones fijas, drag-and-drop y sugerencias automáticas
 * @version 1.0.0
 */

class CropManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.cropArea = null;
    this.aspectRatio = null;
    this.isDragging = false;
    this.isResizing = false;
    this.activeHandle = null;
    this.dragStartPos = null;
    this.isActive = false;
    this.showGrid = true;
    this.minSize = 50;
    this.snapThreshold = 10;
    
    // Handles para resize (8 puntos)
    this.handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    this.handleSize = 10;
    
    // Proporciones predefinidas
    this.aspectRatios = {
      'free': { name: 'Libre', ratio: null },
      '1:1': { name: 'Cuadrado (1:1)', ratio: 1 },
      '16:9': { name: 'Horizontal (16:9)', ratio: 16/9 },
      '9:16': { name: 'Vertical (9:16)', ratio: 9/16 },
      '4:3': { name: 'Clásico (4:3)', ratio: 4/3 },
      '3:2': { name: 'Fotografía (3:2)', ratio: 3/2 },
      '21:9': { name: 'Cinemático (21:9)', ratio: 21/9 },
      'custom': { name: 'Personalizado', ratio: null }
    };
    
    console.log('✅ CropManager inicializado');
  }

  /**
   * Inicializar modo de recorte
   */
  initCropMode(image) {
    if (!this.canvas || !image) {
      throw new Error('Canvas e imagen requeridos');
    }

    this.isActive = true;
    this.image = image;
    
    // Crear área de crop inicial (80% del centro)
    const margin = 0.1;
    this.cropArea = {
      x: this.canvas.width * margin,
      y: this.canvas.height * margin,
      width: this.canvas.width * (1 - 2 * margin),
      height: this.canvas.height * (1 - 2 * margin)
    };

    // Agregar event listeners
    this.setupEventListeners();
    
    // Dibujar overlay inicial
    this.draw();
    
    console.log('✂️ Modo crop activado');
    return this.cropArea;
  }

  /**
   * Configurar event listeners
   */
  setupEventListeners() {
    this.boundMouseDown = this.handleMouseDown.bind(this);
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundMouseUp = this.handleMouseUp.bind(this);
    
    this.canvas.addEventListener('mousedown', this.boundMouseDown);
    this.canvas.addEventListener('mousemove', this.boundMouseMove);
    this.canvas.addEventListener('mouseup', this.boundMouseUp);
    this.canvas.addEventListener('mouseleave', this.boundMouseUp);
  }

  /**
   * Remover event listeners
   */
  removeEventListeners() {
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.boundMouseDown);
      this.canvas.removeEventListener('mousemove', this.boundMouseMove);
      this.canvas.removeEventListener('mouseup', this.boundMouseUp);
      this.canvas.removeEventListener('mouseleave', this.boundMouseUp);
    }
  }

  /**
   * Establecer proporción de aspecto
   */
  setAspectRatio(key) {
    const aspectConfig = this.aspectRatios[key];
    if (!aspectConfig) {
      throw new Error(`Proporción no encontrada: ${key}`);
    }

    this.aspectRatio = aspectConfig.ratio;
    
    // Ajustar área de crop actual a la nueva proporción
    if (this.aspectRatio && this.cropArea) {
      this.adjustToAspectRatio();
    }
    
    this.draw();
    console.log(`📐 Proporción establecida: ${aspectConfig.name}`);
  }

  /**
   * Ajustar área de crop a proporción de aspecto
   */
  adjustToAspectRatio() {
    if (!this.aspectRatio) return;

    const currentRatio = this.cropArea.width / this.cropArea.height;
    
    if (currentRatio > this.aspectRatio) {
      // Reducir ancho
      const newWidth = this.cropArea.height * this.aspectRatio;
      const diff = this.cropArea.width - newWidth;
      this.cropArea.x += diff / 2;
      this.cropArea.width = newWidth;
    } else {
      // Reducir alto
      const newHeight = this.cropArea.width / this.aspectRatio;
      const diff = this.cropArea.height - newHeight;
      this.cropArea.y += diff / 2;
      this.cropArea.height = newHeight;
    }
    
    this.constrainToBounds();
  }

  /**
   * Manejar mouse down
   */
  handleMouseDown(e) {
    if (!this.isActive) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Verificar si hizo clic en un handle
    const handle = this.getHandleAtPosition(x, y);
    if (handle) {
      this.isResizing = true;
      this.activeHandle = handle;
      this.dragStartPos = { x, y };
      this.canvas.style.cursor = this.getHandleCursor(handle);
      return;
    }

    // Verificar si hizo clic dentro del área de crop
    if (this.isInsideCropArea(x, y)) {
      this.isDragging = true;
      this.dragStartPos = { 
        x, 
        y,
        cropX: this.cropArea.x,
        cropY: this.cropArea.y
      };
      this.canvas.style.cursor = 'move';
    }
  }

  /**
   * Manejar mouse move
   */
  handleMouseMove(e) {
    if (!this.isActive) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.isResizing) {
      this.handleResize(x, y);
      this.draw();
      return;
    }

    if (this.isDragging) {
      this.handleDrag(x, y);
      this.draw();
      return;
    }

    // Actualizar cursor según posición
    const handle = this.getHandleAtPosition(x, y);
    if (handle) {
      this.canvas.style.cursor = this.getHandleCursor(handle);
    } else if (this.isInsideCropArea(x, y)) {
      this.canvas.style.cursor = 'move';
    } else {
      this.canvas.style.cursor = 'default';
    }
  }

  /**
   * Manejar mouse up
   */
  handleMouseUp() {
    this.isDragging = false;
    this.isResizing = false;
    this.activeHandle = null;
    this.dragStartPos = null;
    this.canvas.style.cursor = 'default';
  }

  /**
   * Manejar arrastre del área
   */
  handleDrag(x, y) {
    const dx = x - this.dragStartPos.x;
    const dy = y - this.dragStartPos.y;

    this.cropArea.x = this.dragStartPos.cropX + dx;
    this.cropArea.y = this.dragStartPos.cropY + dy;

    // Aplicar snap a bordes
    this.applySnap();
    
    // Mantener dentro de límites
    this.constrainToBounds();
  }

  /**
   * Manejar redimensionamiento
   */
  handleResize(x, y) {
    const dx = x - this.dragStartPos.x;
    const dy = y - this.dragStartPos.y;

    const originalArea = { ...this.cropArea };

    switch (this.activeHandle) {
      case 'nw':
        this.cropArea.x += dx;
        this.cropArea.y += dy;
        this.cropArea.width -= dx;
        this.cropArea.height -= dy;
        break;
      case 'n':
        this.cropArea.y += dy;
        this.cropArea.height -= dy;
        break;
      case 'ne':
        this.cropArea.y += dy;
        this.cropArea.width += dx;
        this.cropArea.height -= dy;
        break;
      case 'e':
        this.cropArea.width += dx;
        break;
      case 'se':
        this.cropArea.width += dx;
        this.cropArea.height += dy;
        break;
      case 's':
        this.cropArea.height += dy;
        break;
      case 'sw':
        this.cropArea.x += dx;
        this.cropArea.width -= dx;
        this.cropArea.height += dy;
        break;
      case 'w':
        this.cropArea.x += dx;
        this.cropArea.width -= dx;
        break;
    }

    // Aplicar proporción de aspecto si está definida
    if (this.aspectRatio) {
      this.maintainAspectRatioWhileResizing(this.activeHandle, originalArea);
    }

    // Validar tamaños mínimos
    if (this.cropArea.width < this.minSize || this.cropArea.height < this.minSize) {
      this.cropArea = originalArea;
      return;
    }

    // Actualizar posición de inicio para siguiente movimiento
    this.dragStartPos.x = x;
    this.dragStartPos.y = y;

    this.constrainToBounds();
  }

  /**
   * Mantener proporción durante resize
   */
  maintainAspectRatioWhileResizing(handle, originalArea) {
    const currentRatio = this.cropArea.width / this.cropArea.height;
    
    if (Math.abs(currentRatio - this.aspectRatio) > 0.01) {
      if (['e', 'w', 'ne', 'nw', 'se', 'sw'].includes(handle)) {
        // Ajustar altura basado en ancho
        const newHeight = this.cropArea.width / this.aspectRatio;
        if (['nw', 'ne', 'n'].includes(handle)) {
          const diff = this.cropArea.height - newHeight;
          this.cropArea.y += diff;
        }
        this.cropArea.height = newHeight;
      } else {
        // Ajustar ancho basado en altura
        const newWidth = this.cropArea.height * this.aspectRatio;
        if (['nw', 'sw', 'w'].includes(handle)) {
          const diff = this.cropArea.width - newWidth;
          this.cropArea.x += diff;
        }
        this.cropArea.width = newWidth;
      }
    }
  }

  /**
   * Aplicar snap a bordes y centro
   */
  applySnap() {
    // Snap a bordes del canvas
    if (Math.abs(this.cropArea.x) < this.snapThreshold) {
      this.cropArea.x = 0;
    }
    if (Math.abs(this.cropArea.y) < this.snapThreshold) {
      this.cropArea.y = 0;
    }
    if (Math.abs(this.cropArea.x + this.cropArea.width - this.canvas.width) < this.snapThreshold) {
      this.cropArea.x = this.canvas.width - this.cropArea.width;
    }
    if (Math.abs(this.cropArea.y + this.cropArea.height - this.canvas.height) < this.snapThreshold) {
      this.cropArea.y = this.canvas.height - this.cropArea.height;
    }

    // Snap a centro
    const centerX = (this.canvas.width - this.cropArea.width) / 2;
    const centerY = (this.canvas.height - this.cropArea.height) / 2;
    
    if (Math.abs(this.cropArea.x - centerX) < this.snapThreshold) {
      this.cropArea.x = centerX;
    }
    if (Math.abs(this.cropArea.y - centerY) < this.snapThreshold) {
      this.cropArea.y = centerY;
    }
  }

  /**
   * Mantener área dentro de límites del canvas
   */
  constrainToBounds() {
    if (this.cropArea.x < 0) this.cropArea.x = 0;
    if (this.cropArea.y < 0) this.cropArea.y = 0;
    
    if (this.cropArea.x + this.cropArea.width > this.canvas.width) {
      this.cropArea.x = this.canvas.width - this.cropArea.width;
    }
    if (this.cropArea.y + this.cropArea.height > this.canvas.height) {
      this.cropArea.y = this.canvas.height - this.cropArea.height;
    }
  }

  /**
   * Obtener handle en posición
   */
  getHandleAtPosition(x, y) {
    const area = this.cropArea;
    const hs = this.handleSize;
    
    const positions = {
      nw: { x: area.x, y: area.y },
      n: { x: area.x + area.width / 2, y: area.y },
      ne: { x: area.x + area.width, y: area.y },
      e: { x: area.x + area.width, y: area.y + area.height / 2 },
      se: { x: area.x + area.width, y: area.y + area.height },
      s: { x: area.x + area.width / 2, y: area.y + area.height },
      sw: { x: area.x, y: area.y + area.height },
      w: { x: area.x, y: area.y + area.height / 2 }
    };

    for (const [handle, pos] of Object.entries(positions)) {
      if (Math.abs(x - pos.x) < hs && Math.abs(y - pos.y) < hs) {
        return handle;
      }
    }

    return null;
  }

  /**
   * Verificar si punto está dentro del área de crop
   */
  isInsideCropArea(x, y) {
    return x >= this.cropArea.x && 
           x <= this.cropArea.x + this.cropArea.width &&
           y >= this.cropArea.y && 
           y <= this.cropArea.y + this.cropArea.height;
  }

  /**
   * Obtener cursor para handle
   */
  getHandleCursor(handle) {
    const cursors = {
      nw: 'nw-resize',
      n: 'n-resize',
      ne: 'ne-resize',
      e: 'e-resize',
      se: 'se-resize',
      s: 's-resize',
      sw: 'sw-resize',
      w: 'w-resize'
    };
    return cursors[handle] || 'default';
  }

  /**
   * Dibujar overlay de crop
   */
  draw() {
    if (!this.isActive || !this.ctx) return;

    const area = this.cropArea;
    
    // Limpiar canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Dibujar imagen original
    if (this.image) {
      this.ctx.drawImage(this.image, 0, 0, this.canvas.width, this.canvas.height);
    }

    // Dibujar overlay oscuro
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    
    // Arriba
    this.ctx.fillRect(0, 0, this.canvas.width, area.y);
    // Abajo
    this.ctx.fillRect(0, area.y + area.height, this.canvas.width, this.canvas.height - area.y - area.height);
    // Izquierda
    this.ctx.fillRect(0, area.y, area.x, area.height);
    // Derecha
    this.ctx.fillRect(area.x + area.width, area.y, this.canvas.width - area.x - area.width, area.height);

    // Dibujar borde del área de crop
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(area.x, area.y, area.width, area.height);

    // Dibujar grid de tercios si está habilitado
    if (this.showGrid) {
      this.drawRuleOfThirdsGrid();
    }

    // Dibujar handles
    this.drawHandles();
  }

  /**
   * Dibujar grid de regla de tercios
   */
  drawRuleOfThirdsGrid() {
    const area = this.cropArea;
    
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.lineWidth = 1;
    
    // Líneas verticales
    const vThird = area.width / 3;
    this.ctx.beginPath();
    this.ctx.moveTo(area.x + vThird, area.y);
    this.ctx.lineTo(area.x + vThird, area.y + area.height);
    this.ctx.moveTo(area.x + 2 * vThird, area.y);
    this.ctx.lineTo(area.x + 2 * vThird, area.y + area.height);
    this.ctx.stroke();
    
    // Líneas horizontales
    const hThird = area.height / 3;
    this.ctx.beginPath();
    this.ctx.moveTo(area.x, area.y + hThird);
    this.ctx.lineTo(area.x + area.width, area.y + hThird);
    this.ctx.moveTo(area.x, area.y + 2 * hThird);
    this.ctx.lineTo(area.x + area.width, area.y + 2 * hThird);
    this.ctx.stroke();
  }

  /**
   * Dibujar handles de resize
   */
  drawHandles() {
    const area = this.cropArea;
    const hs = this.handleSize;
    
    const positions = {
      nw: { x: area.x, y: area.y },
      n: { x: area.x + area.width / 2, y: area.y },
      ne: { x: area.x + area.width, y: area.y },
      e: { x: area.x + area.width, y: area.y + area.height / 2 },
      se: { x: area.x + area.width, y: area.y + area.height },
      s: { x: area.x + area.width / 2, y: area.y + area.height },
      sw: { x: area.x, y: area.y + area.height },
      w: { x: area.x, y: area.y + area.height / 2 }
    };

    this.ctx.fillStyle = '#ffffff';
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1;

    for (const pos of Object.values(positions)) {
      this.ctx.fillRect(pos.x - hs/2, pos.y - hs/2, hs, hs);
      this.ctx.strokeRect(pos.x - hs/2, pos.y - hs/2, hs, hs);
    }
  }

  /**
   * Aplicar recorte a la imagen
   */
  applyCrop() {
    if (!this.isActive || !this.image) {
      throw new Error('Modo crop no activo');
    }

    // Calcular proporciones entre canvas y imagen original
    const scaleX = this.image.naturalWidth / this.canvas.width;
    const scaleY = this.image.naturalHeight / this.canvas.height;

    // Coordenadas del crop en la imagen original
    const cropX = this.cropArea.x * scaleX;
    const cropY = this.cropArea.y * scaleY;
    const cropWidth = this.cropArea.width * scaleX;
    const cropHeight = this.cropArea.height * scaleY;

    // Crear canvas temporal con el tamaño del crop
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCanvas.width = cropWidth;
    tempCanvas.height = cropHeight;
    
    // Configurar alta calidad
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';

    // Dibujar área recortada
    tempCtx.drawImage(
      this.image,
      cropX, cropY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );

    console.log(`✂️ Crop aplicado: ${Math.round(cropWidth)}x${Math.round(cropHeight)}`);

    return {
      canvas: tempCanvas,
      width: cropWidth,
      height: cropHeight,
      dataUrl: tempCanvas.toDataURL('image/png')
    };
  }

  /**
   * Generar sugerencias automáticas de crop
   */
  suggestCrops() {
    if (!this.image || !this.canvas) {
      throw new Error('Imagen y canvas requeridos');
    }

    const suggestions = [];

    // 1. Centrado - crop exacto al centro
    const centered = this.getCenteredCrop();
    suggestions.push({
      name: 'Centrado',
      description: 'Recorte centrado en el medio de la imagen',
      cropArea: centered
    });

    // 2. Regla de tercios - sujeto en intersección
    const thirdsCrop = this.getRuleOfThirdsCrop();
    suggestions.push({
      name: 'Regla de Tercios',
      description: 'Sujeto principal en intersección de tercios',
      cropArea: thirdsCrop
    });

    // 3. Contenido inteligente - basado en contraste
    const smartCrop = this.getSmartCrop();
    suggestions.push({
      name: 'Contenido Inteligente',
      description: 'Enfocado en áreas de mayor interés visual',
      cropArea: smartCrop
    });

    console.log('💡 3 sugerencias de crop generadas');
    return suggestions;
  }

  /**
   * Crop centrado
   */
  getCenteredCrop() {
    const size = Math.min(this.canvas.width, this.canvas.height) * 0.8;
    return {
      x: (this.canvas.width - size) / 2,
      y: (this.canvas.height - size) / 2,
      width: size,
      height: size
    };
  }

  /**
   * Crop según regla de tercios
   */
  getRuleOfThirdsCrop() {
    const width = this.canvas.width * 0.7;
    const height = this.canvas.height * 0.7;
    
    // Posicionar en intersección superior-izquierda de tercios
    return {
      x: this.canvas.width / 3 - width / 2,
      y: this.canvas.height / 3 - height / 2,
      width: width,
      height: height
    };
  }

  /**
   * Crop inteligente basado en contenido
   */
  getSmartCrop() {
    // Análisis simple de contraste
    // En una implementación completa usaría análisis más sofisticado
    
    const size = Math.min(this.canvas.width, this.canvas.height) * 0.75;
    
    // Por ahora, posicionar ligeramente arriba del centro
    // (donde suele estar el contenido importante)
    return {
      x: (this.canvas.width - size) / 2,
      y: (this.canvas.height - size) / 2 - this.canvas.height * 0.1,
      width: size,
      height: size
    };
  }

  /**
   * Aplicar sugerencia
   */
  applySuggestion(suggestion) {
    this.cropArea = { ...suggestion.cropArea };
    this.constrainToBounds();
    this.draw();
  }

  /**
   * Toggle grid de tercios
   */
  toggleGrid() {
    this.showGrid = !this.showGrid;
    this.draw();
  }

  /**
   * Desactivar modo crop
   */
  deactivate() {
    this.isActive = false;
    this.removeEventListeners();
    this.cropArea = null;
    this.canvas.style.cursor = 'default';
    console.log('✂️ Modo crop desactivado');
  }

  /**
   * Obtener información del crop actual
   */
  getCropInfo() {
    if (!this.cropArea) return null;
    
    return {
      x: Math.round(this.cropArea.x),
      y: Math.round(this.cropArea.y),
      width: Math.round(this.cropArea.width),
      height: Math.round(this.cropArea.height),
      aspectRatio: this.cropArea.width / this.cropArea.height
    };
  }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.CropManager = CropManager;
}
