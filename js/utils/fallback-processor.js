/**
 * MnemoTag v3.0 - Fallback Processor
 * Sistema de procesamiento fallback para navegadores sin soporte de Workers
 * Características: Main thread processing, filter fallbacks, watermark fallbacks, performance optimization
 */

const FallbackProcessor = {
  // Configuración
  config: {
    enableLogging: true,
    enableProgressCallbacks: true,
    chunkSize: 1000000, // Procesar en chunks para evitar bloqueo UI
    enableAsyncProcessing: true,
    maxProcessingTime: 5000 // 5 segundos máximo
  },
  
  // Métricas de rendimiento
  stats: {
    operationsProcessed: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0,
    failedOperations: 0
  },
  
  // Procesar imagen en el hilo principal (fallback)
  processInMainThread: function(imageData, operations, options = {}) {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      
      try {
        if (this.config.enableLogging) {
          console.log('⚠️ FallbackProcessor: Procesando en hilo principal', {
            operaciones: operations.length,
            tamaño: `${imageData.width}x${imageData.height}`
          });
        }
        
        // Verificar que tenemos datos válidos
        if (!imageData || !imageData.data) {
          throw new Error('ImageData inválido');
        }
        
        // Crear canvas temporal
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        if (!tempCtx) {
          throw new Error('No se pudo crear contexto 2D');
        }
        
        tempCanvas.width = imageData.width;
        tempCanvas.height = imageData.height;
        
        // Dibujar imagen inicial
        tempCtx.putImageData(imageData, 0, 0);
        
        // Configurar callbacks de progreso
        const progressCallback = options.onProgress || null;
        const totalOperations = operations.length;
        
        // Procesar operaciones
        if (this.config.enableAsyncProcessing && operations.length > 3) {
          // Procesamiento asíncrono para operaciones múltiples
          this.processOperationsAsync(tempCtx, operations, progressCallback)
            .then(() => {
              const resultImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
              this.updateStats(startTime, true);
              resolve(resultImageData);
            })
            .catch(reject);
        } else {
          // Procesamiento síncrono para operaciones simples
          for (let i = 0; i < operations.length; i++) {
            this.applyOperationFallback(tempCtx, operations[i]);
            
            // Callback de progreso
            if (progressCallback) {
              progressCallback((i + 1) / totalOperations);
            }
          }
          
          // Obtener resultado
          const resultImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
          
          // Simular async con setTimeout para no bloquear UI
          setTimeout(() => {
            this.updateStats(startTime, true);
            resolve(resultImageData);
          }, 0);
        }
        
      } catch (error) {
        this.updateStats(startTime, false);
        console.error('❌ FallbackProcessor: Error en procesamiento:', error);
        reject(error);
      }
    });
  },
  
  // Procesamiento asíncrono de operaciones
  processOperationsAsync: function(ctx, operations, progressCallback) {
    return new Promise((resolve, reject) => {
      let currentIndex = 0;
      
      const processNext = () => {
        if (currentIndex >= operations.length) {
          resolve();
          return;
        }
        
        try {
          this.applyOperationFallback(ctx, operations[currentIndex]);
          currentIndex++;
          
          // Callback de progreso
          if (progressCallback) {
            progressCallback(currentIndex / operations.length);
          }
          
          // Procesar siguiente en el próximo frame
          requestAnimationFrame(processNext);
          
        } catch (error) {
          reject(error);
        }
      };
      
      // Iniciar procesamiento
      requestAnimationFrame(processNext);
    });
  },
  
  // Aplicar operación en fallback
  applyOperationFallback: function(ctx, operation) {
    try {
      switch (operation.type) {
        case 'watermark-text':
          this.applyTextWatermarkFallback(ctx, operation.config);
          break;
        case 'watermark-image':
          this.applyImageWatermarkFallback(ctx, operation.config);
          break;
        case 'filter':
          this.applyFilterFallback(ctx, operation.config);
          break;
        case 'brightness':
          this.applyFilterFallback(ctx, { type: 'brightness', value: operation.value || operation.config.value });
          break;
        case 'contrast':
          this.applyFilterFallback(ctx, { type: 'contrast', value: operation.value || operation.config.value });
          break;
        case 'saturation':
          this.applyFilterFallback(ctx, { type: 'saturation', value: operation.value || operation.config.value });
          break;
        case 'blur':
          this.applyBlurFallback(ctx, operation.config || { value: operation.value });
          break;
        case 'sepia':
          this.applySepiaFallback(ctx, operation.config || { value: operation.value });
          break;
        case 'hue-rotate':
          this.applyHueRotateFallback(ctx, operation.config || { value: operation.value });
          break;
        default:
          console.warn(`⚠️ FallbackProcessor: Operación no soportada: ${operation.type}`);
      }
    } catch (error) {
      console.error(`❌ FallbackProcessor: Error aplicando operación ${operation.type}:`, error);
      this.stats.failedOperations++;
    }
  },
  
  // Aplicar marca de agua de texto (fallback)
  applyTextWatermarkFallback: function(ctx, config) {
    ctx.save();
    
    try {
      // Configurar fuente y estilo
      ctx.font = `${config.fontSize || config.size || 20}px ${config.fontFamily || config.font || 'Arial'}`;
      ctx.fillStyle = config.color || '#ffffff';
      ctx.globalAlpha = (config.opacity || 0.5) / 100;
      
      // Configurar sombra si está especificada
      if (config.shadow) {
        ctx.shadowColor = config.shadowColor || '#000000';
        ctx.shadowBlur = config.shadowBlur || 3;
        ctx.shadowOffsetX = config.shadowOffsetX || 1;
        ctx.shadowOffsetY = config.shadowOffsetY || 1;
      }
      
      // Aplicar transformaciones de posición
      ctx.textAlign = config.textAlign || 'left';
      ctx.textBaseline = config.textBaseline || 'top';
      
      // Dibujar texto
      const text = config.text || '';
      const x = config.x || 10;
      const y = config.y || 10;
      
      if (config.strokeWidth && config.strokeColor) {
        ctx.strokeStyle = config.strokeColor;
        ctx.lineWidth = config.strokeWidth;
        ctx.strokeText(text, x, y);
      }
      
      ctx.fillText(text, x, y);
      
    } catch (error) {
      console.error('Error aplicando marca de agua de texto:', error);
    } finally {
      ctx.restore();
    }
  },
  
  // Aplicar marca de agua de imagen (fallback)
  applyImageWatermarkFallback: function(ctx, config) {
    if (!config.imageElement && !config.imageData) {
      console.warn('⚠️ FallbackProcessor: No hay imagen para marca de agua');
      return;
    }
    
    ctx.save();
    
    try {
      ctx.globalAlpha = (config.opacity || 50) / 100;
      
      if (config.imageElement) {
        // Usar elemento de imagen
        ctx.drawImage(
          config.imageElement,
          config.x || 0,
          config.y || 0,
          config.width || config.imageElement.width,
          config.height || config.imageElement.height
        );
      } else if (config.imageData) {
        // Usar ImageData
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = config.imageData.width;
        tempCanvas.height = config.imageData.height;
        tempCtx.putImageData(config.imageData, 0, 0);
        
        ctx.drawImage(
          tempCanvas,
          config.x || 0,
          config.y || 0,
          config.width || config.imageData.width,
          config.height || config.imageData.height
        );
      }
      
    } catch (error) {
      console.error('Error aplicando marca de agua de imagen:', error);
    } finally {
      ctx.restore();
    }
  },
  
  // Aplicar filtro (fallback)
  applyFilterFallback: function(ctx, config) {
    const canvas = ctx.canvas;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    switch (config.type) {
      case 'brightness':
        this.adjustBrightnessFallback(data, config.value || 0);
        break;
      case 'contrast':
        this.adjustContrastFallback(data, config.value || 0);
        break;
      case 'saturation':
        this.adjustSaturationFallback(data, config.value || 0);
        break;
      case 'sepia':
        this.adjustSepiaFallback(data, config.value || 0);
        break;
      case 'hue-rotate':
        this.adjustHueRotateFallback(data, config.value || 0);
        break;
      case 'grayscale':
        this.adjustGrayscaleFallback(data);
        break;
      default:
        console.warn(`⚠️ FallbackProcessor: Filtro no soportado: ${config.type}`);
        return;
    }
    
    ctx.putImageData(imageData, 0, 0);
  },
  
  // Aplicar blur (usando CSS filter como fallback)
  applyBlurFallback: function(ctx, config) {
    const blurValue = config.value || 0;
    if (blurValue <= 0) return;
    
    // Aplicar blur usando CSS filter en el canvas
    const originalFilter = ctx.filter;
    ctx.filter = `blur(${blurValue}px)`;
    
    // Crear imagen temporal
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = ctx.canvas.width;
    tempCanvas.height = ctx.canvas.height;
    tempCtx.putImageData(imageData, 0, 0);
    
    // Aplicar blur
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
    
    // Restaurar filtro original
    ctx.filter = originalFilter;
  },
  
  // Aplicar sepia (fallback)
  applySepiaFallback: function(ctx, config) {
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    this.adjustSepiaFallback(imageData.data, config.value || 0);
    ctx.putImageData(imageData, 0, 0);
  },
  
  // Aplicar hue rotate (fallback)
  applyHueRotateFallback: function(ctx, config) {
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    this.adjustHueRotateFallback(imageData.data, config.value || 0);
    ctx.putImageData(imageData, 0, 0);
  },
  
  // Métodos de ajuste de filtros (fallback)
  adjustBrightnessFallback: function(data, brightness) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] + brightness));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + brightness));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + brightness));
    }
  },
  
  adjustContrastFallback: function(data, contrast) {
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
      data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
      data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
    }
  },
  
  adjustSaturationFallback: function(data, saturation) {
    const satFactor = (saturation + 100) / 100;
    
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = Math.min(255, Math.max(0, gray + satFactor * (data[i] - gray)));
      data[i + 1] = Math.min(255, Math.max(0, gray + satFactor * (data[i + 1] - gray)));
      data[i + 2] = Math.min(255, Math.max(0, gray + satFactor * (data[i + 2] - gray)));
    }
  },
  
  adjustSepiaFallback: function(data, sepiaValue) {
    const amount = sepiaValue / 100;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const tr = 0.393 * r + 0.769 * g + 0.189 * b;
      const tg = 0.349 * r + 0.686 * g + 0.168 * b;
      const tb = 0.272 * r + 0.534 * g + 0.131 * b;
      
      data[i] = Math.min(255, r + amount * (tr - r));
      data[i + 1] = Math.min(255, g + amount * (tg - g));
      data[i + 2] = Math.min(255, b + amount * (tb - b));
    }
  },
  
  adjustHueRotateFallback: function(data, hueRotate) {
    const radians = (hueRotate * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    
    // Matriz de rotación de hue
    const matrix = [
      0.213 + cos * 0.787 - sin * 0.213,
      0.715 - cos * 0.715 - sin * 0.715,
      0.072 - cos * 0.072 + sin * 0.928,
      0.213 - cos * 0.213 + sin * 0.143,
      0.715 + cos * 0.285 + sin * 0.140,
      0.072 - cos * 0.072 - sin * 0.283,
      0.213 - cos * 0.213 - sin * 0.787,
      0.715 - cos * 0.715 + sin * 0.715,
      0.072 + cos * 0.928 + sin * 0.072
    ];
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      data[i] = Math.min(255, Math.max(0, matrix[0] * r + matrix[1] * g + matrix[2] * b));
      data[i + 1] = Math.min(255, Math.max(0, matrix[3] * r + matrix[4] * g + matrix[5] * b));
      data[i + 2] = Math.min(255, Math.max(0, matrix[6] * r + matrix[7] * g + matrix[8] * b));
    }
  },
  
  adjustGrayscaleFallback: function(data) {
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
  },
  
  // Actualizar estadísticas
  updateStats: function(startTime, success) {
    const processingTime = performance.now() - startTime;
    
    this.stats.operationsProcessed++;
    this.stats.totalProcessingTime += processingTime;
    this.stats.averageProcessingTime = this.stats.totalProcessingTime / this.stats.operationsProcessed;
    
    if (!success) {
      this.stats.failedOperations++;
    }
    
    if (this.config.enableLogging) {
      console.log(`📊 FallbackProcessor: Operación ${success ? 'exitosa' : 'fallida'} - Tiempo: ${processingTime.toFixed(2)}ms`);
    }
  },
  
  // Verificar si una operación es soportada
  isOperationSupported: function(operationType) {
    const supportedOperations = [
      'watermark-text',
      'watermark-image',
      'filter',
      'brightness',
      'contrast',
      'saturation',
      'blur',
      'sepia',
      'hue-rotate',
      'grayscale'
    ];
    
    return supportedOperations.includes(operationType);
  },
  
  // Procesar imagen completa (API simplificada)
  processImage: function(imageData, filters, options = {}) {
    // Convertir filtros a operaciones
    const operations = this.filtersToOperations(filters);
    
    return this.processInMainThread(imageData, operations, options);
  },
  
  // Convertir filtros a operaciones
  filtersToOperations: function(filters) {
    const operations = [];
    
    Object.entries(filters).forEach(([filterType, value]) => {
      if (value !== 0 && value !== false && value !== null) {
        operations.push({
          type: filterType,
          config: { type: filterType, value: value }
        });
      }
    });
    
    return operations;
  },
  
  // Configurar el processor
  configure: function(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.enableLogging) {
      console.log('⚙️ FallbackProcessor configurado:', this.config);
    }
  },
  
  // Obtener estadísticas
  getStats: function() {
    const successRate = this.stats.operationsProcessed > 0 
      ? ((this.stats.operationsProcessed - this.stats.failedOperations) / this.stats.operationsProcessed * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      successRate: `${successRate}%`,
      averageProcessingTime: Math.round(this.stats.averageProcessingTime * 100) / 100,
      config: this.config
    };
  },
  
  // Reset estadísticas
  resetStats: function() {
    this.stats = {
      operationsProcessed: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      failedOperations: 0
    };
    
    if (this.config.enableLogging) {
      console.log('📊 FallbackProcessor: Estadísticas reseteadas');
    }
  },
  
  // Cleanup
  cleanup: function() {
    this.resetStats();
    
    if (this.config.enableLogging) {
      console.log('🧹 FallbackProcessor: Limpiado');
    }
  }
};

// Verificar si existe window para registrar globalmente
if (typeof window !== 'undefined') {
  window.FallbackProcessor = FallbackProcessor;
}

// Exportar para módulos si es necesario
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FallbackProcessor;
}
