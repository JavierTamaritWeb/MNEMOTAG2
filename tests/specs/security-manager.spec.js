// Tests de SecurityManager y de la utilidad sanitizeFilename.

describe('SecurityManager.sanitizeText', function () {
  it('escapa los caracteres HTML peligrosos', function () {
    const result = SecurityManager.sanitizeText('<script>alert(1)</script>');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
  });

  it('escapa comillas simples y dobles', function () {
    const result = SecurityManager.sanitizeText(`"hola" 'mundo'`);
    expect(result).toContain('&quot;');
    expect(result).toContain('&#x27;');
  });

  it('devuelve cadena vacía si la entrada no es string', function () {
    expect(SecurityManager.sanitizeText(null)).toBe('');
    expect(SecurityManager.sanitizeText(undefined)).toBe('');
    expect(SecurityManager.sanitizeText(123)).toBe('');
  });
});

describe('SecurityManager.validateImageFile', function () {
  it('rechaza la ausencia de archivo', function () {
    const result = SecurityManager.validateImageFile(null);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rechaza un MIME type no permitido', function () {
    const fakeFile = {
      name: 'malware.exe',
      type: 'application/x-msdownload',
      size: 1024 * 100,
    };
    const result = SecurityManager.validateImageFile(fakeFile);
    expect(result.isValid).toBe(false);
    const codes = result.errors.map(function (e) { return e.type; });
    expect(codes).toContain('INVALID_FORMAT');
  });

  it('rechaza un archivo más grande que AppConfig.maxFileSize', function () {
    const fakeFile = {
      name: 'gigante.jpg',
      type: 'image/jpeg',
      size: AppConfig.maxFileSize + 1,
    };
    const result = SecurityManager.validateImageFile(fakeFile);
    expect(result.isValid).toBe(false);
    const codes = result.errors.map(function (e) { return e.type; });
    expect(codes).toContain('FILE_TOO_LARGE');
  });

  it('acepta un JPG válido bien formado', function () {
    const fakeFile = {
      name: 'foto.jpg',
      type: 'image/jpeg',
      size: 1024 * 200,
    };
    const result = SecurityManager.validateImageFile(fakeFile);
    expect(result.isValid).toBe(true);
  });
});

describe('SecurityManager.validateMetadata', function () {
  it('valida un objeto de metadatos limpio', function () {
    const result = SecurityManager.validateMetadata({
      title: 'Atardecer',
      author: 'Javier',
      description: 'Foto de prueba',
      keywords: 'paisaje, cielo',
      copyright: '© 2026 Javier',
    });
    expect(result.isValid).toBe(true);
  });

  it('marca como inválido un título demasiado largo', function () {
    const result = SecurityManager.validateMetadata({
      title: 'a'.repeat(200), // > 100
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.title).toBeDefined();
  });

  it('sanitiza HTML en los campos de texto', function () {
    const result = SecurityManager.validateMetadata({
      title: '<b>Hola</b>',
    });
    expect(result.sanitized.title).not.toContain('<');
    expect(result.sanitized.title).toContain('&lt;');
  });
});

describe('SecurityManager.validateWatermarkText', function () {
  it('valida un watermark correcto', function () {
    const result = SecurityManager.validateWatermarkText('© Javier', 24, 50);
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('rechaza tamaño fuera de rango (10-200)', function () {
    expect(SecurityManager.validateWatermarkText('texto', 5, 50).isValid).toBe(false);
    expect(SecurityManager.validateWatermarkText('texto', 300, 50).isValid).toBe(false);
  });

  it('rechaza opacidad fuera de rango (0-100)', function () {
    expect(SecurityManager.validateWatermarkText('texto', 24, -1).isValid).toBe(false);
    expect(SecurityManager.validateWatermarkText('texto', 24, 150).isValid).toBe(false);
  });

  it('rechaza texto vacío', function () {
    const result = SecurityManager.validateWatermarkText('', 24, 50);
    expect(result.isValid).toBe(false);
  });
});

describe('SecurityManager.isValidFileBaseName', function () {
  it('acepta nombres con letras, números, espacios, guiones, tildes y eñes', function () {
    expect(SecurityManager.isValidFileBaseName('niño 01-final')).toBe(true);
    expect(SecurityManager.isValidFileBaseName('árbol_grande')).toBe(true);
  });

  it('rechaza nombres reservados de Windows', function () {
    expect(SecurityManager.isValidFileBaseName('CON')).toBe(false);
    expect(SecurityManager.isValidFileBaseName('aux')).toBe(false);
    expect(SecurityManager.isValidFileBaseName('COM1')).toBe(false);
    expect(SecurityManager.isValidFileBaseName('LPT9')).toBe(false);
  });

  it('rechaza nombres con caracteres prohibidos', function () {
    expect(SecurityManager.isValidFileBaseName('foto<bad>')).toBe(false);
    expect(SecurityManager.isValidFileBaseName('foto?')).toBe(false);
  });

  it('rechaza nombres vacíos o demasiado largos', function () {
    expect(SecurityManager.isValidFileBaseName('')).toBe(false);
    expect(SecurityManager.isValidFileBaseName('a'.repeat(70))).toBe(false);
  });
});

describe('sanitizeFilename (función global)', function () {
  it('devuelve fallback para entradas no string', function () {
    expect(sanitizeFilename(null)).toBe('imagen_editada');
    expect(sanitizeFilename(undefined)).toBe('imagen_editada');
  });

  it('reemplaza espacios por guiones y normaliza a minúsculas', function () {
    expect(sanitizeFilename('Mi Foto Bonita')).toBe('mi-foto-bonita');
  });
});
