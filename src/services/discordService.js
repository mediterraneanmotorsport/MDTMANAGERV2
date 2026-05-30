/**
 * MDT Discord Service
 * Handles communication with Discord Webhooks for premium team notifications,
 * generating dynamic vertical 16:9 WEC-inspired telemetry poster cards with HTML5 Canvas.
 */

// Helper to asynchronously load image in browser context
const loadImg = (src) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Prevent security errors

        const timer = setTimeout(() => {
            console.warn(`MDT Telemetry Card: Image load timed out for ${src}`);
            img.onload = null;
            img.onerror = null;
            resolve(null);
        }, 5000);

        img.onload = () => {
            clearTimeout(timer);
            resolve(img);
        };
        img.onerror = () => {
            clearTimeout(timer);
            console.warn(`MDT Telemetry Card: Failed to load image asset from ${src}`);
            resolve(null);
        };
        img.src = src;
    });
};

// Helper to automatically crop transparent empty boundaries of any image (visual scale consistency)
const trimImage = (img) => {
    if (!img || img.width === 0 || img.height === 0) return img;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0);

    let imgData;
    try {
        imgData = tempCtx.getImageData(0, 0, img.width, img.height);
    } catch (e) {
        console.warn("Failed to getImageData for pilot image trim (likely CORS):", e);
        return img; // Fallback to original image if security/CORS prevents scanning
    }

    const pixels = imgData.data;
    const width = img.width;
    const height = img.height;

    let minX = width, maxX = 0, minY = height, maxY = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const alpha = pixels[(y * width + x) * 4 + 3];
            if (alpha > 5) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (minX > maxX || minY > maxY) {
        return img;
    }

    const trimmedW = (maxX - minX) + 1;
    const trimmedH = (maxY - minY) + 1;

    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = trimmedW;
    trimmedCanvas.height = trimmedH;
    const trimmedCtx = trimmedCanvas.getContext('2d');

    trimmedCtx.drawImage(img, minX, minY, trimmedW, trimmedH, 0, 0, trimmedW, trimmedH);
    return trimmedCanvas;
};

// Helper mapping for Manufacturer logos
const getCarLogoPath = (carName) => {
    const name = (carName || '').toLowerCase();
    if (name.includes('ferrari')) return 'assets/logos/cars/Ferrari.png';
    if (name.includes('bmw')) return 'assets/logos/cars/BMW.png';
    if (name.includes('porsche')) return 'assets/logos/cars/Porsche.png';
    if (name.includes('aston martin')) return 'assets/logos/cars/Aston Martin.png';
    if (name.includes('corvette')) return 'assets/logos/cars/Corvette.png';
    if (name.includes('ford')) return 'assets/logos/cars/Ford.png';
    if (name.includes('lamborghini')) return 'assets/logos/cars/Lamborghini.png';
    if (name.includes('lexus')) return 'assets/logos/cars/Lexus.png';
    if (name.includes('mclaren')) return 'assets/logos/cars/McLaren.png';
    if (name.includes('mercedes') || name.includes('amg')) return 'assets/logos/cars/Mercedes-AMG.png';
    if (name.includes('toyota')) return 'assets/logos/cars/Toyota.png';
    if (name.includes('peugeot')) return 'assets/logos/cars/Peugeot.png';
    if (name.includes('cadillac')) return 'assets/logos/cars/Cadillac.png';
    if (name.includes('alpine')) return 'assets/logos/cars/Alpine.png';
    if (name.includes('glickenhaus')) return 'assets/logos/cars/Glickenhaus.png';
    if (name.includes('isotta') || name.includes('fraschini')) return 'assets/logos/cars/Isotta Fraschini.png';
    if (name.includes('vanwall')) return 'assets/logos/cars/Vanwall.png';
    if (name.includes('oreca')) return 'assets/logos/cars/Oreca.png';
    if (name.includes('ligier')) return 'assets/logos/cars/Ligier.png';
    if (name.includes('duqueine')) return 'assets/logos/cars/Duqueine.png';
    if (name.includes('ginetta')) return 'assets/logos/cars/Ginetta.png';
    if (name.includes('genesis')) return 'assets/logos/cars/Genesis.png';
    return 'assets/logos/cars/Default.png';
};

// Helper mapping for Category badges
const getCategoryLogoPath = (cat) => {
    const name = (cat || '').toUpperCase();
    if (name.includes('LMP3')) return 'assets/logos/categories/LMP3.jpg';
    if (name.includes('HY') || name.includes('HYPER')) return 'assets/logos/categories/HY.png';
    if (name.includes('LMP2')) return 'assets/logos/categories/LMP2.png';
    if (name.includes('GT3')) return 'assets/logos/categories/GT3.png';
    if (name.includes('GTE')) return 'assets/logos/categories/GTE.png';
    return null;
};

// Helper to resolve high-quality car PNG image path
const getCarImagePath = (carName, category) => {
    const name = (carName || '').toLowerCase();
    const cat = (category || '').toUpperCase();

    // Specific manufacturer mappings
    if (name.includes('valkyrie')) return 'assets/cars/valkyrie.png';
    if (name.includes('peugeot')) return 'assets/cars/PEUGEOT9X8.png';
    if (name.includes('alpine')) return 'assets/cars/ALPINE-HY.png';
    if (name.includes('cadillac')) return 'assets/cars/CADILLAC-HY.png';
    
    if (name.includes('aston martin') || name.includes('vantage') || name.includes('aston')) {
        return 'assets/cars/ASTON-GT3.png';
    }
    
    if (name.includes('bmw')) {
        if (cat.includes('HY') || name.includes('hybrid') || name.includes('v8') || name.includes('lmdh')) {
            return 'assets/cars/BMW-HY.png';
        }
        return 'assets/cars/BMW-GT3.png';
    }

    if (name.includes('ferrari')) {
        if (cat.includes('HY') || name.includes('499') || name.includes('499p')) {
            return 'assets/cars/FERRARI-HY.png';
        }
        return 'assets/cars/FERRARI-GT3.png';
    }

    if (name.includes('ginetta')) {
        return 'assets/cars/GINETTA-G61-LMP3.png';
    }

    if (name.includes('ligier')) {
        return 'assets/cars/LIGIER-JS-LMP3.png';
    }

    if (name.includes('mclaren')) {
        return 'assets/cars/MCLAREN-GT3.png';
    }

    if (name.includes('mercedes') || name.includes('amg')) {
        return 'assets/cars/MERCEDES-GT3.png';
    }

    if (name.includes('oreca') || cat.includes('LMP2') || cat.includes('P2')) {
        return 'assets/cars/ORECA-07-LMP2.png';
    }

    if (name.includes('porsche')) {
        if (cat.includes('HY') || name.includes('963')) {
            return 'assets/cars/PORSCHE-HY.png';
        }
        return 'assets/cars/PORSCHE-GT3.png';
    }

    // Category fallback if no specific manufacturer matched
    if (cat.includes('LMP3') || cat.includes('P3')) {
        return 'assets/cars/LIGIER-JS-LMP3.png';
    }
    if (cat.includes('LMP2') || cat.includes('P2')) {
        return 'assets/cars/ORECA-07-LMP2.png';
    }
    if (cat.includes('HY') || cat.includes('HYPER')) {
        return 'assets/cars/PORSCHE-HY.png';
    }

    // Default general fallback
    return 'assets/cars/PORSCHE-GT3.png';
};

// Helper to resolve pilot portrait PNG image path
const getPilotImagePath = (pilotName) => {
    const name = (pilotName || '').toLowerCase().trim();
    if (name.includes('aitor') && name.includes('moduga')) {
        return 'assets/Pilotos/Aitor-Moduga.png';
    }
    if (name.includes('miguel') && name.includes('valiente')) {
        return 'assets/Pilotos/Miguel-Valiente.png';
    }
    if (name.includes('alejandro') && (name.includes('bascu') || name.includes('salcedo'))) {
        return 'assets/Pilotos/Alejandro-Bascu-Salcedo.png';
    }
    return 'assets/Pilotos/General.png';
};

// Helper rounded rectangle
const drawRoundedRect = (ctx, x, y, width, height, radius, fill, stroke) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
};

// Static manifest of available circuit images matching files under public/assets/Circuitos/
const CIRCUIT_IMAGES_MANIFEST = {
    'bahrain': [
        'assets/Circuitos/bahrain/Bahrain.png',
        'assets/Circuitos/bahrain/Bahrain-1.png',
        'assets/Circuitos/bahrain/Bahrain-2.png',
        'assets/Circuitos/bahrain/Bahrain-3.png',
        'assets/Circuitos/bahrain/Bahrain-4.png'
    ],
    'circuit de la sarthe-le mans': [
        'assets/Circuitos/Circuit de la Sarthe-Le Mans/Le-mans.png',
        'assets/Circuitos/Circuit de la Sarthe-Le Mans/Le-mans-1.png',
        'assets/Circuitos/Circuit de la Sarthe-Le Mans/Le-mans-2.png',
        'assets/Circuitos/Circuit de la Sarthe-Le Mans/Le-mans-3.png',
        'assets/Circuitos/Circuit de la Sarthe-Le Mans/Le-mans-4.png'
    ],
    'cota': [
        'assets/Circuitos/COTA/COTA.png',
        'assets/Circuitos/COTA/COTA-1.png',
        'assets/Circuitos/COTA/COTA-2.png',
        'assets/Circuitos/COTA/COTA-3.png'
    ],
    'imola': [
        'assets/Circuitos/Autodromo Internazionale Enzo e Dino Ferrari/imola.png',
        'assets/Circuitos/Autodromo Internazionale Enzo e Dino Ferrari/imola-1.png',
        'assets/Circuitos/Autodromo Internazionale Enzo e Dino Ferrari/imola-2.png',
        'assets/Circuitos/Autodromo Internazionale Enzo e Dino Ferrari/Imola-3.png'
    ],
    'paul ricard': [
        'assets/Circuitos/Paul Ricard/PaulRicard_1.jpg',
        'assets/Circuitos/Paul Ricard/PaulRicard_2.jpg',
        'assets/Circuitos/Paul Ricard/PaulRicard_3.jpg',
        'assets/Circuitos/Paul Ricard/PaulRicard_5.jpg'
    ],
    'barcelona': [
        'assets/Circuitos/Barcelona/BARCELONA.webp',
        'assets/Circuitos/Barcelona/BARCELONA-2.webp',
        'assets/Circuitos/Barcelona/BARCELONA-3.webp',
        'assets/Circuitos/Barcelona/BARCELONA-4.webp'
    ]
};

// Helper to resolve random background circuit image from the manifest
const getRandomCircuitImagePath = (circuitName) => {
    if (!circuitName) return null;
    const normalized = circuitName.toLowerCase().trim();

    let matchedKey = null;
    if (normalized.includes('bahrain')) {
        matchedKey = 'bahrain';
    } else if (normalized.includes('sarthe') || normalized.includes('le mans') || normalized.includes('le-mans')) {
        matchedKey = 'circuit de la sarthe-le mans';
    } else if (normalized.includes('cota') || normalized.includes('americas')) {
        matchedKey = 'cota';
    } else if (normalized.includes('imola') || normalized.includes('enzo') || normalized.includes('ferrari')) {
        matchedKey = 'imola';
    } else if (normalized.includes('paul ricard') || normalized.includes('paulricard')) {
        matchedKey = 'paul ricard';
    } else if (normalized.includes('barcelona') || normalized.includes('catalunya')) {
        matchedKey = 'barcelona';
    }

    if (matchedKey && CIRCUIT_IMAGES_MANIFEST[matchedKey]) {
        const options = CIRCUIT_IMAGES_MANIFEST[matchedKey];
        const randomIndex = Math.floor(Math.random() * options.length);
        return options[randomIndex];
    }
    return null;
};

// Proportional background crop (simulating "object-fit: cover")
const drawImageCover = (ctx, img, x, y, w, h) => {
    const imgW = img.width;
    const imgH = img.height;
    const imgRatio = imgW / imgH;
    const targetRatio = w / h;

    let sx, sy, sWidth, sHeight;

    if (imgRatio > targetRatio) {
        sHeight = imgH;
        sWidth = imgH * targetRatio;
        sx = (imgW - sWidth) / 2;
        sy = 0;
    } else {
        sWidth = imgW;
        sHeight = imgW / targetRatio;
        sx = 0;
        sy = (imgH - sHeight) / 2;
    }

    ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
};

const drawTelemetryCard = async (canvas, data) => {
    const ctx = canvas.getContext('2d');

    // Ensure custom fonts are loaded before drawing on the canvas
    try {
        await Promise.all([
            document.fonts.load('12px "Antonio"'),
            document.fonts.load('12px "Heebo"')
        ]);
    } catch (e) {
        console.warn('Failed to load custom fonts for canvas telemetry card:', e);
    }

    // Enable high-quality image smoothing for scaling assets
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const { pilot, circuit, car, lapTime, category, improvement, previousTime, sectors, topSpeed, isTest, position, globalDelta } = data;

    const pilotImagePath = getPilotImagePath(pilot);
    const circuitImagePath = getRandomCircuitImagePath(circuit);
    const catLogoPath = getCategoryLogoPath(category);
    const carLogoPath = getCarLogoPath(car);
    const carImagePath = getCarImagePath(car, category);

    console.log(`MDT Canvas: Loading assets parallelly for telemetry card...`);

    const [pilotImage, circuitImg, wecLogo, studioLogo, lemansLogo, virtualLogo, mdtLogo, categoryBadge, carLogo, carCutoutImage] = await Promise.all([
        loadImg(pilotImagePath),
        circuitImagePath ? loadImg(circuitImagePath) : Promise.resolve(null),
        loadImg('assets/logos/Original/FIA-WEC-logo.png'),
        loadImg('assets/logos/Original/studio-397-logo.png'),
        loadImg('assets/logos/Original/24HA_LOGO.png'),
        loadImg('assets/logos/Original/LeMansVirtualSeries_logo.png'),
        loadImg('logo.png'), // MDT Team Logo
        catLogoPath ? loadImg(catLogoPath) : Promise.resolve(null), // Category Badge
        carLogoPath ? loadImg(carLogoPath) : Promise.resolve(null), // Car Logo
        carImagePath ? loadImg(carImagePath) : Promise.resolve(null) // Car Cutout Image
    ]);

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '--:--.---';
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(3);
        return `${mins}:${secs.padStart(6, '0')}`;
    };

    // Brand color: glowing neon cyan
    const brandColorHex = '#00d4ff';

    // Virtual viewport coordinates to support high-definition scaling
    const width = 800;
    const height = 1000;

    // =========================================================================
    // CONFIGURACIÓN DE POSICIONES Y TAMAÑOS (FÁCILMENTE AJUSTABLES)
    // =========================================================================
    // 1. Imagen del Piloto (Fondo 3D recortado a la derecha)
    const pilotMaxW = 380;          // Ancho máximo del piloto (reducido para no estorbar textos)
    const pilotMaxH = 680;          // Alto máximo del piloto
    const pilotXCenter = 590;       // Eje horizontal de alineación (derecha asimétrica)
    const pilotBottomY = 1000;      // Apoyado en la base inferior del póster
    const pilotOpacity = 0.95;      // Prácticamente opaco para destacar como cutout real de F1

    // 2. Imagen del Circuito en el Fondo (Monocromática azul metalizada)
    const circuitBackgroundBlur = 2;       // Desenfoque suave del circuito para realismo fotográfico
    const circuitBackgroundOpacity = 0.52; // Intensidad de la imagen de circuito
    // =========================================================================

    // 1. DIBUJAR FONDO BASE DE ALTO IMPACTO (MDT Racing Blue / Carbon Hybrid)
    // Rellenamos primero de azul MDT
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#003eb3');   // Azul cobalto oscuro premium
    bgGrad.addColorStop(0.4, '#0062ff'); // Azul eléctrico vibrante
    bgGrad.addColorStop(0.8, '#0084ff'); // Azul luminoso
    bgGrad.addColorStop(1, '#00c3ff');   // Cyan brillante en la base
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. RENDERIZADO DEL CIRCUITO CORRESPONDIENTE CON TINTADO POR TRANSPARENCIA
    // (This is highly robust across all browser/Capacitor webviews and completely avoids composite mode issues)
    if (circuitImg) {
        ctx.save();
        if (circuitBackgroundBlur > 0) {
            ctx.filter = `blur(${circuitBackgroundBlur}px)`;
        }
        ctx.globalAlpha = 0.28; // Translucent overlay to blend beautifully with the blue gradient background
        drawImageCover(ctx, circuitImg, 0, 0, width, height);
        ctx.restore();
    }

    // 3. CARBON FIBER STRIPES & DIAGONAL OVERLAYS (Textura deportiva)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 4;
    for (let i = -height; i < width; i += 24) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + height, height);
        ctx.stroke();
    }

    // Gradiente oscuro de lectura en la parte inferior para fundir con el footer y asegurar contraste total
    const bottomShadow = ctx.createLinearGradient(0, 0, 0, height);
    bottomShadow.addColorStop(0, 'rgba(0, 0, 0, 0.0)');
    bottomShadow.addColorStop(0.65, 'rgba(5, 5, 8, 0.35)');
    bottomShadow.addColorStop(0.85, 'rgba(5, 5, 8, 0.78)');
    bottomShadow.addColorStop(1, 'rgba(5, 5, 8, 0.95)');
    ctx.fillStyle = bottomShadow;
    ctx.fillRect(0, 0, width, height);

    // 4. HEADER OSCURO SUPERIOR (FIA WEC / MDT / STUDIO 397 LOGOS)
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, width, 140);
    
    // Slanted MDT Blue block in the header (FIA WEC branding side)
    ctx.fillStyle = '#0055ff'; // Azul MDT Premium
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(230, 0);
    ctx.lineTo(190, 140);
    ctx.lineTo(0, 140);
    ctx.closePath();
    ctx.fill();

    // White slanted accent border line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(230, 0);
    ctx.lineTo(190, 140);
    ctx.stroke();

    // Draw MDT logo inside the slanted block
    if (mdtLogo) {
        ctx.save();
        ctx.drawImage(mdtLogo, 15, 30, 80, 80);
        ctx.restore();
    }

    // Draw FIA WEC logo next to MDT logo in the slanted area
    if (wecLogo) {
        ctx.save();
        ctx.drawImage(wecLogo, 105, 42, 75, 40);
        ctx.restore();
    }

    // Draw Studio 397 & Le Mans Virtual Series logos on the right of the header
    if (virtualLogo) {
        ctx.save();
        ctx.drawImage(virtualLogo, 520, 42, 115, 56);
        ctx.restore();
    }
    if (lemansLogo) {
        ctx.save();
        ctx.drawImage(lemansLogo, 665, 32, 110, 76);
        ctx.restore();
    }

    // Header Text details
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Antonio", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('MDT FASTEST LAP AWARD', 225, 58);

    ctx.fillStyle = '#00d4ff';
    ctx.font = 'bold 15px "Antonio", sans-serif';
    const roundLabel = isTest ? 'DISCORD SYSTEM ACTIVE' : `ROUND - ${circuit.toUpperCase().split('-')[0].trim()}`;
    ctx.fillText(roundLabel, 225, 92);

    // Border line beneath header
    ctx.fillStyle = '#00d4ff';
    ctx.fillRect(0, 140, width, 4);

    // 4.9 Draw massive car manufacturer shield logo in the background behind the pilot (Leclerc/Ferrari style!)
    if (carLogo) {
        ctx.save();
        ctx.globalAlpha = 0.58; // Slightly blended in the background for a gorgeous overlay feel!
        
        // Large brand logo placed behind pilot's shoulder, overlapping the right side border
        const logoW = 380; // Increased size from 280 to 380 for dramatic brand presence!
        const logoH = 380;
        const lx = width - 260; // Shifted to crop beautifully on the right side border
        const ly = 290;         // Elevated vertical position to match the larger size
        
        ctx.drawImage(carLogo, lx, ly, logoW, logoH);
        ctx.restore();
    }

    // 5. COMPOSICIÓN DEL PILOTO EN EL FRENTE (Cutout 3D a la derecha con escalado proporcional y auto-trim de bordes transparentes)
    if (pilotImage) {
        ctx.save();
        
        // Soft drop shadow to integrate perfectly with the background just like F1 Max Verstappen poster
        ctx.shadowColor = 'rgba(0, 0, 0, 0.52)';
        ctx.shadowBlur = 24;
        ctx.globalAlpha = pilotOpacity;

        // Auto-trim transparent padding to ensure all pilots have identical visual scale and sizes
        const trimmedPilot = trimImage(pilotImage);

        // Proportional resolution scaling to avoid stretching/narrowing the pilot image
        const imgW = trimmedPilot.width;
        const imgH = trimmedPilot.height;
        const imgRatio = imgW / imgH;

        // Standardized visual dimensions for trimmed cutouts
        const targetMaxW = 360;
        const targetMaxH = 650;
        const maxRatio = targetMaxW / targetMaxH;

        let drawW = targetMaxW;
        let drawH = targetMaxH;

        if (imgRatio > maxRatio) {
            // Width is the limiting factor
            drawW = targetMaxW;
            drawH = targetMaxW / imgRatio;
        } else {
            // Height is the limiting factor
            drawH = targetMaxH;
            drawW = targetMaxH * imgRatio;
        }

        const px = pilotXCenter - (drawW / 2);
        const py = pilotBottomY - drawH;
        ctx.drawImage(trimmedPilot, px, py, drawW, drawH);
        
        ctx.restore();
    }

    // 6. COLUMNA IZQUIERDA: TELEMETRÍA Y TIEMPOS (Colores premium WEC/MDT de alto contraste)
    const pos = position || 1;
    const gap = globalDelta !== undefined ? globalDelta : 0;
    const isP1 = (pos === 1 || gap === 0);

    // Color definitions
    const COLOR_LILAC = '#df52ff';  // Absolute fastest WEC purple sector/lap
    const COLOR_ORANGE = '#ff6b2b'; // MDT Racing Orange
    const COLOR_RED = '#ff4d4d';    // Gap to leader in vibrant neon red

    // 6.1 Tiempo de Vuelta Rápida (Vibrant MDT Orange or Absolute Record Lilac)
    ctx.save();
    ctx.fillStyle = isP1 ? COLOR_LILAC : COLOR_ORANGE; 
    ctx.font = 'bold 94px "Antonio", sans-serif';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText(formatTime(lapTime), 60, 275);
    ctx.restore();

    // 6.2 Delta e Icono de Coche Oficial (en lugar de F1 rueda)
    let deltaText = '';
    if (isP1) {
        deltaText = 'RÉCORD ABSOLUTO';
    } else {
        deltaText = `+${gap.toFixed(3)}s (P${pos})`;
    }
    
    // Glowing lilac for absolute record, vibrant red for other positions (gap to leader)
    ctx.save();
    ctx.fillStyle = isP1 ? COLOR_LILAC : COLOR_RED; 
    ctx.font = 'bold 30px "Antonio", sans-serif';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillText(deltaText, 60, 342);
    ctx.restore();

    // Draw Car Manufacturer Logo dynamically next to the delta time and display the vehicle name right next to it!
    ctx.save();
    if (carLogo) {
        ctx.drawImage(carLogo, 290, 310, 42, 42);
    }
    
    ctx.fillStyle = '#ffffff'; // Pristine White for extreme readability
    ctx.font = 'bold 18px "Antonio", sans-serif';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    const carNameText = (car || 'MDT CAR').toUpperCase();
    ctx.fillText(carNameText, 345, 338); // 345 is perfect spacing from 290 + 42 = 332
    ctx.restore();

    // 6.3 Logo oficial de la categoría
    if (categoryBadge) {
        ctx.save();
        ctx.strokeStyle = '#ffffff'; // White border for high-contrast on blue
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 8;
        
        // Circular badge border for Category
        ctx.beginPath();
        ctx.arc(96, 460, 32, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(96, 460, 30, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(categoryBadge, 66, 430, 60, 60);
        ctx.restore();
    } else {
        // Fallback: Text box of class
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px "Antonio", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText((category || 'WEC').toUpperCase(), 60, 480);
        ctx.restore();
    }

    // 6.3.5 Imagen del Coche Cutout (al lado del logo de categoría en el hueco libre)
    if (carCutoutImage) {
        ctx.save();
        const carImgW = carCutoutImage.width;
        const carImgH = carCutoutImage.height;
        const carRatio = carImgW / carImgH;

        const maxCarW = 210;
        const maxCarH = 75;

        let drawCarW = maxCarW;
        let drawCarH = maxCarW / carRatio;

        if (drawCarH > maxCarH) {
            drawCarH = maxCarH;
            drawCarW = maxCarH * carRatio;
        }

        // Center vertically next to the category badge (y = 460)
        const cx = 155; 
        const cy = 460 - (drawCarH / 2);

        // Add soft premium drop shadow to give that F1 poster look
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 1.5;
        ctx.shadowOffsetY = 1.5;

        ctx.drawImage(carCutoutImage, cx, cy, drawCarW, drawCarH);
        ctx.restore();
    }

    // Circuit Name below category logo (Vibrant MDT Orange for spectacular high-contrast contrast)
    ctx.save();
    ctx.fillStyle = '#ff6b2b'; // Vibrant MDT Orange
    ctx.font = 'bold 36px "Antonio", sans-serif';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 8;
    const cleanCircuitTitle = isTest ? 'TEST TRACK' : circuit.split('-')[0].trim().toUpperCase();
    ctx.fillText(cleanCircuitTitle, 60, 545);
    ctx.restore();

    // 6.4 Telemetry Blocks (Sector Splits & Vmax horizontally apilados en cajas negras)
    // Box 1: Sectores (Fondo negro más denso para perfecto contraste)
    ctx.save();
    ctx.fillStyle = 'rgba(5, 5, 8, 0.75)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, 60, 570, 310, 38, 6, true, true);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#ffffff'; // White text
    ctx.font = 'bold 11px "Antonio", sans-serif';
    ctx.textAlign = 'left';
    const s1Str = sectors?.s1 ? `${sectors.s1.toFixed(3)}s` : '--.---s';
    const s2Str = sectors?.s2 ? `${sectors.s2.toFixed(3)}s` : '--.---s';
    const s3Str = sectors?.s3 ? `${sectors.s3.toFixed(3)}s` : '--.---s';
    ctx.fillText(`S1: ${s1Str}   |   S2: ${s2Str}   |   S3: ${s3Str}`, 72, 594);
    ctx.restore();

    // Box 2: V-Max
    ctx.save();
    ctx.fillStyle = 'rgba(5, 5, 8, 0.75)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, 60, 616, 310, 32, 6, true, true);
    ctx.restore();
    
    ctx.save();
    ctx.fillStyle = '#ffffff'; // White text
    ctx.font = 'bold 11px "Antonio", sans-serif';
    ctx.textAlign = 'left';
    const speedStr = topSpeed && parseFloat(topSpeed) > 0 ? `${topSpeed} KM/H` : '---.- KM/H';
    ctx.fillText(`VELOCIDAD MÁXIMA (V-MAX):  ${speedStr}`, 72, 636);
    ctx.restore();

    // 6.5 Stacked text: FASTEST LAP (Contrast layout: Orange + White)
    ctx.save();
    ctx.fillStyle = '#ff6b2b'; // Vibrant MDT Orange for FASTEST
    ctx.font = 'italic bold 90px "Antonio", sans-serif';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText('FASTEST', 60, 745);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#ffffff'; // Pristine White for LAP
    ctx.font = 'italic bold 90px "Antonio", sans-serif';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText('LAP', 60, 815);
    ctx.restore();

    // 6.6 Driver Name apilado al pie
    const nameParts = (pilot || 'AITOR MODUGA').toUpperCase().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    ctx.save();
    ctx.fillStyle = '#ff6b2b'; // Vibrant MDT Orange for driver first name
    ctx.font = 'bold 36px "Antonio", sans-serif';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 8;
    ctx.fillText(firstName, 60, 885);
    ctx.restore();

    // Last name in white with a bold black shadow overlay for WEC podium style
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px "Antonio", sans-serif';
    ctx.textAlign = 'left';
    ctx.shadowColor = '#050508';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 1.5;
    ctx.shadowOffsetY = 1.5;
    ctx.fillText(lastName, 60, 945);
    ctx.restore();

    // 7. OUTER BORDER (Outline framing the F1 Fastest Lap style card)
    ctx.strokeStyle = '#050508';
    ctx.lineWidth = 14;
    ctx.strokeRect(0, 0, width, height);

    // Red/Orange inner borderline accent (Cyan neon for blue theme!)
    ctx.strokeStyle = brandColorHex;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(7, 7, width - 14, height - 14);
};

export const sendDiscordNotification = async (webhookUrl, data) => {
    const { pilot, circuit, car, category, improvement, isTest } = data;
    console.log(`MDT Discord Service: [START] Generando tarjeta WEC 4K en JPEG para ${pilot} en ${circuit}...`);

    // Create off-screen canvas (3200 x 4000 for ultra-high-definition 4K WEC vertical poster card)
    const canvas = document.createElement('canvas');
    canvas.width = 3200;
    canvas.height = 4000;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.scale(4, 4);

    try {
        // Draw the WEC-style telemetry poster card graphics asynchronously
        await drawTelemetryCard(canvas, data);

        // Convert canvas to JPEG Blob with high-quality compression (drastically reduces file weight from 4MB to ~600KB)
        const blob = await new Promise((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
        });

        if (!blob) {
            throw new Error("Failed to generate image blob from vertical WEC canvas");
        }

        // Brand Colors
        const COLOR_MDT_ORANGE = 16739115;  // 0xff6b2b
        const COLOR_MDT_GOLD = 15247410;    // 0xe8a832
        const COLOR_MDT_CYAN = 54527;       // 0x00d4ff

        // Create FormData
        const formData = new FormData();
        formData.append('files[0]', blob, 'telemetry_card.jpg');

        // Create Embed Payload pointing to the attached WEC-style poster card
        const payload = {
            embeds: [
                {
                    title: isTest ? "📡 MDT RACING CONSOLE • SISTEMA ONLINE" : `🏆 ¡NUEVO RÉCORD DE VUELTA DE MDT!`,
                    description: isTest
                        ? `El bot de telemetría de **MDT Motorsport** se ha vinculado con éxito a este canal de Discord.`
                        : `🚀 **${pilot}** ha registrado una mejora récord en la clase **${category || 'WEC'}** en el circuito de **${circuit}**.`,
                    color: isTest ? COLOR_MDT_CYAN : (improvement > 0 ? COLOR_MDT_ORANGE : COLOR_MDT_GOLD),
                    image: {
                        url: 'attachment://telemetry_card.jpg'
                    },
                    footer: {
                        text: `MDT Racing Console • Telemetry Watcher v1.0.6`
                    },
                    timestamp: new Date().toISOString()
                }
            ]
        };

        formData.append('payload_json', JSON.stringify(payload));

        const response = await fetch(webhookUrl, {
            method: 'POST',
            body: formData // Let the browser set Content-Type with boundary!
        });

        console.log(`MDT Discord Service: [SUCCESS] Mensaje de telemetría enviado con éxito. Status: ${response.status} ${response.statusText}`);
        return response.ok;
    } catch (err) {
        console.error("Error generating or sending WEC-style Discord telemetry poster:", err);

        // Fallback: Send a basic text alert if canvas fails (robustness)
        try {
            const fallbackEmbed = {
                title: isTest ? "📡 MDT CONEXIÓN ONLINE" : `🏆 NUEVO RÉCORD - ${pilot}`,
                description: `Ocurrió un error al generar la tarjeta visual, retransmitiendo en texto básico: \n${pilot} en ${circuit} (${car || ''}).`,
                color: 0xff6b2b
            };
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [fallbackEmbed] })
            });
            return response.ok;
        } catch (fallbackErr) {
            console.error("Critical: Discord webhook fallback failed too:", fallbackErr);
            return false;
        }
    }
};

export const exportTelemetryCard = async (data) => {
    console.log(`MDT Export: [START] Generando tarjeta WEC 4K en JPEG para exportación local...`);

    // Create off-screen canvas (3200 x 4000 for ultra-high-definition 4K WEC vertical poster card)
    const canvas = document.createElement('canvas');
    canvas.width = 3200;
    canvas.height = 4000;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.scale(4, 4);

    try {
        // Draw the WEC-style telemetry poster card graphics asynchronously
        await drawTelemetryCard(canvas, data);

        // Convert canvas to JPEG Data URL with high-quality compression
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

        // Trigger browser download
        const link = document.createElement('a');
        const pilotNameClean = (data.pilot || data.name || 'Piloto').replace(/\s+/g, '_');
        const circuitNameClean = (data.circuit || 'Circuito').replace(/\s+/g, '_');
        link.download = `MDT_Telemetry_${pilotNameClean}_${circuitNameClean}.jpg`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log(`MDT Export: [SUCCESS] Descarga de tarjeta de telemetría iniciada con éxito.`);
        return true;
    } catch (err) {
        console.error("Error generating or exporting telemetry poster card:", err);
        return false;
    }
};

