'use strict';

// ===== WEB WORKER PARA PROCESAMIENTO DE IMÁGENES =====
// Worker optimizado para filtros pesados con OffscreenCanvas

class ImageProcessor {
  constructor() {
    this.supportOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';
  }

  // Procesar imagen con filtros específicos
  processImage(imageData, filters) {
    try {
      
      // Validar entrada
      if (!imageData || !imageData.data) {
        throw new Error('ImageData inválido');
      }
      
      // Procesar directamente los datos sin canvas innecesario
      const processedData = this.applyHeavyFilters(imageData, filters);
      
      return processedData;
      
    } catch (error) {
      console.error('❌ Error en worker:', error);
      throw error;
    }
  }

  // Aplicar filtros computacionalmente pesados
  applyHeavyFilters(imageData, filters) {
    const data = new Uint8ClampedArray(imageData.data);
    const width = imageData.width;
    const height = imageData.height;

    // Aplicar blur si es pesado (> 3px)
    if (filters.blur && Math.abs(filters.blur) > 3) {
      this.applyBoxBlur(data, width, height, Math.abs(filters.blur));
    }

    // Aplicar contrast si es pesado (> 150%)
    if (filters.contrast && Math.abs(filters.contrast - 100) > 50) {
      this.applyContrast(data, filters.contrast);
    }

    // Aplicar saturation si es pesada (> 150%)
    if (filters.saturation && Math.abs(filters.saturation - 100) > 50) {
      this.applySaturation(data, filters.saturation);
    }

    // Aplicar brightness si es pesado
    if (filters.brightness && Math.abs(filters.brightness - 100) > 50) {
      this.applyBrightness(data, filters.brightness);
    }

    return new ImageData(data, width, height);
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

  // Aplicar contraste corregido (entrada en porcentaje 0-200)
  applyContrast(data, contrastPercent) {
    // Convertir porcentaje a factor: 100% = 1.0, 150% = 1.5, 50% = 0.5
    const contrast = contrastPercent / 100;
    
    for (let i = 0; i < data.length; i += 4) {
      // Aplicar contraste correctamente
      data[i] = Math.max(0, Math.min(255, ((data[i] - 128) * contrast) + 128));
      data[i + 1] = Math.max(0, Math.min(255, ((data[i + 1] - 128) * contrast) + 128));
      data[i + 2] = Math.max(0, Math.min(255, ((data[i + 2] - 128) * contrast) + 128));
      // Alpha channel unchanged
    }
  }

  // Aplicar saturación corregida (entrada en porcentaje 0-200)
  applySaturation(data, saturationPercent) {
    const saturation = saturationPercent / 100;
    
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

  // Aplicar brillo optimizado
  applyBrightness(data, brightness) {
    const factor = brightness / 100;
    
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
  const { id, imageData, filters } = e.data;
  
  try {
    
    // Procesar imagen
    const processedData = processor.processImage(imageData, filters);
    
    // CRÍTICO: Clonar buffer antes de transferir para evitar corrupción
    const clonedBuffer = processedData.data.buffer.slice();
    
    // Enviar resultado con transferable object clonado
    self.postMessage({
      id,
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
