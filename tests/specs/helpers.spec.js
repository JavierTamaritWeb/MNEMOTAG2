// Tests de las funciones puras de helpers.js.

describe('helpers — formatFileSize', function () {
  it('devuelve "0 B" para 0', function () {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('formatea bytes en KB', function () {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formatea bytes en MB', function () {
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2 MB');
  });
});

describe('helpers — getFileExtension / getMimeType', function () {
  it('mapea formatos conocidos a su extensión', function () {
    expect(getFileExtension('jpeg')).toBe('jpg');
    expect(getFileExtension('png')).toBe('png');
    expect(getFileExtension('webp')).toBe('webp');
    expect(getFileExtension('avif')).toBe('avif');
  });

  it('devuelve jpg como fallback para formatos desconocidos', function () {
    expect(getFileExtension('xyz')).toBe('jpg');
  });

  it('mapea formatos conocidos a su MIME type', function () {
    expect(getMimeType('jpeg')).toBe('image/jpeg');
    expect(getMimeType('png')).toBe('image/png');
    expect(getMimeType('webp')).toBe('image/webp');
    expect(getMimeType('avif')).toBe('image/avif');
  });
});

describe('helpers — sanitizeFileBaseName', function () {
  it('devuelve "imagen" para entradas vacías o nulas', function () {
    expect(sanitizeFileBaseName('')).toBe('imagen');
    expect(sanitizeFileBaseName(null)).toBe('imagen');
    expect(sanitizeFileBaseName(undefined)).toBe('imagen');
  });

  it('elimina la extensión del nombre', function () {
    expect(sanitizeFileBaseName('foto.jpg')).toBe('foto');
    expect(sanitizeFileBaseName('paisaje.PNG')).toBe('paisaje');
  });

  it('respeta tildes y eñes (UTF-8)', function () {
    expect(sanitizeFileBaseName('niño.jpg')).toBe('niño');
    expect(sanitizeFileBaseName('árbol.png')).toBe('árbol');
  });

  it('elimina caracteres peligrosos para sistemas de archivos', function () {
    const dirty = 'foto<>:"/\\|?*.jpg';
    const clean = sanitizeFileBaseName(dirty);
    expect(clean).not.toContain('<');
    expect(clean).not.toContain('>');
    expect(clean).not.toContain(':');
    expect(clean).not.toContain('?');
    expect(clean).not.toContain('*');
    expect(clean).not.toContain('|');
    expect(clean).not.toContain('/');
    expect(clean).not.toContain('\\');
  });

  it('limita la longitud máxima a 60 caracteres', function () {
    const veryLong = 'a'.repeat(200);
    expect(sanitizeFileBaseName(veryLong).length).toBe(60);
  });
});

describe('helpers — debounce', function () {
  it('agrupa múltiples llamadas en una sola tras la espera', function () {
    let calls = 0;
    const fn = debounce(function () { calls++; }, 30);

    fn(); fn(); fn();
    expect(calls).toBe(0);

    return new Promise(function (resolve) {
      setTimeout(function () {
        expect(calls).toBe(1);
        resolve();
      }, 60);
    });
  });
});
