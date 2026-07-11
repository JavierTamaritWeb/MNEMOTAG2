'use strict';

// ===== WEB WORKER PARA PROCESAMIENTO DE IMÁGENES =====
// Worker optimizado para filtros pesados con OffscreenCanvas

class ImageProcessor {
  constructor() {
    this.supportOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';
  }

  // Procesar imagen con operaciones o filtros específicos
  processImage(imageData, operationsOrFilters) {
    try {
      
      // Validar entrada
      if (!imageData || !imageData.data) {
        throw new Error('ImageData inválido');
      }
      
      const operations = Array.isArray(operationsOrFilters)
        ? operationsOrFilters
        : this.filtersToOperations(operationsOrFilters || {});

      // Procesar directamente los datos sin canvas innecesario
      const processedData = this.applyOperations(imageData, operations);
      
      return processedData;
      
    } catch (error) {
      console.error('❌ Error en worker:', error);
      throw error;
    }
  }

  filtersToOperations(filters) {
    const order = ['brightness', 'contrast', 'saturation', 'sepia', 'hueRotate', 'blur'];
    return order
      .filter(type => filters[type] !== 0 && filters[type] !== undefined && filters[type] !== null)
      .map(type => ({
        type: 'filter',
        config: {
          type: type === 'hueRotate' ? 'hue-rotate' : type,
          value: filters[type]
        }
      }));
  }

  // Aplicar operaciones de filtro con la misma semántica que CSS/fallback
  applyOperations(imageData, operations) {
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;

    for (const operation of operations) {
      const config = operation.config || operation;
      const type = config.type || operation.type;
      const value = config.value || 0;

      switch (type) {
        case 'brightness':
          this.applyBrightness(data, value);
          break;
        case 'contrast':
          this.applyContrast(data, value);
          break;
        case 'saturation':
          this.applySaturation(data, value);
          break;
        case 'sepia':
          this.applySepia(data, value);
          break;
        case 'hue-rotate':
        case 'hueRotate':
          this.applyHueRotate(data, value);
          break;
        case 'blur':
          if (value > 0) this.applyBoxBlur(data, width, height, value);
          break;
        default:
          break;
      }
    }

    return { data, width, height };
  }

  // Algoritmo de Box Blur optimizado
  applyBoxBlur(data, width, height, radius) {
    const kernelSize = Math.floor(radius * 2) + 1;
    const halfKernel = Math.floor(kernelSize / 2);
    
    // Crear buffer temporal
    const temp = new Uint8ClampedArray(data.length);
    
    // Blur horizontal
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4;
        
        let r = 0, g = 0, b = 0, a = 0, count = 0;
        
        for (let kx = -halfKernel; kx <= halfKernel; kx++) {
          const sampleX = Math.max(0, Math.min(width - 1, x + kx));
          const sampleIndex = (y * width + sampleX) * 4;
          
          r += data[sampleIndex];
          g += data[sampleIndex + 1];
          b += data[sampleIndex + 2];
          a += data[sampleIndex + 3];
          count++;
        }
        
        temp[pixelIndex] = r / count;
        temp[pixelIndex + 1] = g / count;
        temp[pixelIndex + 2] = b / count;
        temp[pixelIndex + 3] = a / count;
      }
    }
    
    // Blur vertical
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4;
        
        let r = 0, g = 0, b = 0, a = 0, count = 0;
        
        for (let ky = -halfKernel; ky <= halfKernel; ky++) {
          const sampleY = Math.max(0, Math.min(height - 1, y + ky));
          const sampleIndex = (sampleY * width + x) * 4;
          
          r += temp[sampleIndex];
          g += temp[sampleIndex + 1];
          b += temp[sampleIndex + 2];
          a += temp[sampleIndex + 3];
          count++;
        }
        
        data[pixelIndex] = r / count;
        data[pixelIndex + 1] = g / count;
        data[pixelIndex + 2] = b / count;
        data[pixelIndex + 3] = a / count;
      }
    }
  }

  // Aplicar contraste corregido (entrada 0 = neutro, como CSS)
  applyContrast(data, contrastValue) {
    const contrast = (100 + contrastValue) / 100;
    
    for (let i = 0; i < data.length; i += 4) {
      // Aplicar contraste correctamente
      data[i] = Math.max(0, Math.min(255, ((data[i] - 128) * contrast) + 128));
      data[i + 1] = Math.max(0, Math.min(255, ((data[i + 1] - 128) * contrast) + 128));
      data[i + 2] = Math.max(0, Math.min(255, ((data[i + 2] - 128) * contrast) + 128));
      // Alpha channel unchanged
    }
  }

  // Aplicar saturación corregida (entrada 0 = neutro, como CSS)
  applySaturation(data, saturationValue) {
    const saturation = (100 + saturationValue) / 100;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Usar fórmula de luminancia estándar
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // Aplicar saturación correctamente
      data[i] = Math.max(0, Math.min(255, gray + saturation * (r - gray)));
      data[i + 1] = Math.max(0, Math.min(255, gray + saturation * (g - gray)));
      data[i + 2] = Math.max(0, Math.min(255, gray + saturation * (b - gray)));
      // Alpha channel unchanged
    }
  }

  applySepia(data, sepiaValue) {
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
  }

  applyHueRotate(data, hueRotate) {
    const radians = (hueRotate * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

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
  }

  // Aplicar brillo optimizado (entrada 0 = neutro, como CSS)
  applyBrightness(data, brightness) {
    const factor = (100 + brightness) / 100;
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] * factor));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * factor));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * factor));
      // Alpha channel unchanged
    }
  }
}

// Worker message handler con mejor manejo de transferable objects
const processor = new ImageProcessor();

self.onmessage = function(e) {
  const { id } = e.data;
  const payload = e.data.data || {};
  const imageData = e.data.imageData || payload.imageData;
  const operations = e.data.operations || payload.operations || e.data.filters || payload.filters || [];
  
  try {
    
    // Procesar imagen
    const processedData = processor.processImage(imageData, operations);
    
    // CRÍTICO: Clonar buffer antes de transferir para evitar corrupción
    const clonedBuffer = processedData.data.buffer.slice();
    
    // Enviar resultado con transferable object clonado
    self.postMessage({
      id,
      type: 'complete',
      success: true,
      result: {
        data: new Uint8ClampedArray(clonedBuffer),
        width: processedData.width,
        height: processedData.height
      }
    }, [clonedBuffer]);
    
    
  } catch (error) {
    console.error(`❌ Worker error en job ${id}:`, error);
    
    // Enviar error
    self.postMessage({
      id,
      success: false,
      error: error.message
    });
  }
};

// Worker startup
