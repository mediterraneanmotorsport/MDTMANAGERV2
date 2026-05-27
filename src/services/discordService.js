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
        img.onload = () => resolve(img);
        img.onerror = () => {
            console.warn(`MDT Telemetry Card: Failed to load image asset from ${src}`);
            resolve(null);
        };
        img.src = src;
    });
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
    
    if (name.includes('alpine')) return 'assets/cars/alpine-a424.png';
    if (name.includes('valkyrie')) return 'assets/cars/aston-martin-valkyrie.png';
    if (name.includes('aston martin') || name.includes('vantage')) return 'assets/cars/aston-martin-vantage-gt3.png';
    if (name.includes('bmw') && (name.includes('hybrid') || name.includes('v8'))) return 'assets/cars/bmw-m-hybrid-v8.png';
    if (name.includes('bmw') && name.includes('m4')) return 'assets/cars/bmw-m4-gt3.png';
    if (name.includes('corvette') && name.includes('c8')) return 'assets/cars/corvette-c8r.webp';
    if (name.includes('corvette') && (name.includes('z06') || name.includes('gt3'))) return 'assets/cars/corvette-z06-gt3r.png';
    if (name.includes('ferrari') && name.includes('296')) return 'assets/cars/ferrari-296-gt3.png';
    if (name.includes('ferrari') && name.includes('499')) return 'assets/cars/ferrari-499p.png';
    if (name.includes('ford') || name.includes('mustang')) return 'assets/cars/ford-mustang-gt3.png';
    if (name.includes('lamborghini') || name.includes('huracan')) return 'assets/cars/lamborghini-huracan-gt3.png';
    if (name.includes('lexus')) return 'assets/cars/lexus-rcf-gt3.png';
    if (name.includes('oreca')) return 'assets/cars/oreca-07.png';
    if (name.includes('ginetta')) return 'assets/cars/ginetta.png';
    if (name.includes('porsche') && name.includes('911')) return 'assets/cars/porsche-911-gt3r-992.png';
    if (name.includes('porsche') && name.includes('963')) return 'assets/cars/porsche-963.png';
    
    // Category Prototype fallback
    if (cat.includes('P2') || cat.includes('P3') || cat.includes('LMP')) {
        return 'assets/cars/oreca-07.png'; // LMP Prototype fallback (looks extremely like LMP3 Ginetta!)
    }
    
    // Default fallback GT3
    return 'assets/cars/porsche-911-gt3r-992.png';
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

const drawTelemetryCard = async (canvas, data) => {
    const ctx = canvas.getContext('2d');
    const { pilot, circuit, car, lapTime, category, improvement, previousTime, sectors, topSpeed, isTest } = data;

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '--:--.---';
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(3);
        return `${mins}:${secs.padStart(6, '0')}`;
    };

    const brandColorHex = isTest ? '#00d4ff' : (improvement > 0 ? '#ff6b2b' : '#e8a832');

    // 1. Background Gradient (Deep nighttime race track gradient)
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#030306');
    grad.addColorStop(0.4, '#080812');
    grad.addColorStop(0.8, '#0f0f22');
    grad.addColorStop(1, '#050508');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Carbon Fiber Stripes (Diagonales sutiles)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.01)';
    ctx.lineWidth = 3;
    for (let i = -canvas.height; i < canvas.width; i += 18) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + canvas.height, canvas.height);
        ctx.stroke();
    }

    // 3. Glowing Stadium Night Beams (Glow effect like Bapco 8H Bahrain)
    const beam1 = ctx.createRadialGradient(200, -50, 50, 200, -50, 450);
    beam1.addColorStop(0, isTest ? 'rgba(0, 212, 255, 0.04)' : 'rgba(255, 107, 43, 0.03)');
    beam1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = beam1;
    ctx.fillRect(0, 0, canvas.width, 600);

    const beam2 = ctx.createRadialGradient(600, -50, 50, 600, -50, 500);
    beam2.addColorStop(0, 'rgba(255, 255, 255, 0.025)');
    beam2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = beam2;
    ctx.fillRect(0, 0, canvas.width, 650);

    // 4. Glowing Brand top line (Border strip)
    ctx.fillStyle = brandColorHex;
    ctx.fillRect(0, 0, canvas.width, 5);

    // 5. Header Section (Top Left: MDT Logo, Top Right: WEC Header Box)
    const mdtLogo = await loadImg('logo.png');
    if (mdtLogo) {
        ctx.drawImage(mdtLogo, 45, 30, 75, 75);
    }

    // WEC Header Box
    ctx.fillStyle = 'rgba(16, 16, 26, 0.8)';
    ctx.strokeStyle = isTest ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, 145, 35, 610, 65, 6, true, true);

    // Header Content
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = 'bold 9px "Orbitron", "Rajdhani", sans-serif';
    ctx.fillText(isTest ? 'MDT SETUP MANAGER • LIVE WEBHOOK TEST' : 'MDT RACING TELEMETRY Watcher • MULTIPLAYER', 165, 58);

    const circuitNameStr = isTest ? 'DISCORD SYSTEM ACTIVE' : (circuit || 'Paul Ricard').toUpperCase();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "Orbitron", "Rajdhani", sans-serif';
    ctx.fillText(circuitNameStr.split('-')[0].trim(), 165, 83);

    // Outlined Season year badge
    ctx.strokeStyle = brandColorHex;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(690, 52, 45, 28);
    ctx.fillStyle = brandColorHex;
    ctx.font = 'bold 12px "Orbitron", sans-serif';
    ctx.fillText('2026', 696, 71);

    // 6. Massive Watermarked Circuit Layout Name (Very Faint Background)
    const cleanCircuit = (circuit || 'Paul Ricard').split('-')[0].trim().toUpperCase();
    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
    ctx.font = '900 italic 82px "Orbitron", sans-serif';
    ctx.fillText(cleanCircuit, canvas.width - 45, 180);
    ctx.restore();

    if (isTest) {
        // --- TEST CARD INTERIOR ---
        // Slanted Badge
        ctx.fillStyle = '#0c0e1a';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.beginPath();
        ctx.moveTo(45 + 15, 160);
        ctx.lineTo(540, 160);
        ctx.lineTo(540 - 15, 160 + 55);
        ctx.lineTo(45, 160 + 55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Slanted right orange block
        ctx.fillStyle = '#00d4ff';
        ctx.beginPath();
        ctx.moveTo(430 + 15, 165);
        ctx.lineTo(525, 165);
        ctx.lineTo(525 - 15, 165 + 45);
        ctx.lineTo(430, 165 + 45);
        ctx.closePath();
        ctx.fill();

        // Text inside slanted orange block
        ctx.fillStyle = '#050508';
        ctx.font = 'bold 16px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('#ONLINE', 472, 194);

        // Left text inside chevron
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px "Orbitron", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('MDT SYSTEM TELEMETRY', 75, 195);

        // Huge Title: SYSTEM ONLINE (Aesthetics matching HYPERPOLE)
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'black italic bold 74px "Orbitron", sans-serif';
        ctx.shadowColor = '#00d4ff';
        ctx.shadowBlur = 18;
        ctx.fillText('SYSTEM ONLINE', 400, 310);
        ctx.restore();

        // Subtitle indicator
        ctx.fillStyle = 'rgba(0, 212, 255, 0.7)';
        ctx.font = 'bold 11px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('> VÍNCULO DE CONSOLA ACTIVO', 400, 360);

        // Draw Stylized Glowing CPU Icon in Center
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00d4ff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(400, 425, 45, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px "Orbitron", sans-serif';
        ctx.fillText('📡', 400, 434);
        ctx.restore();

        // 7. Lower Telemetry Glass Dashboard
        ctx.fillStyle = 'rgba(10, 10, 16, 0.65)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        drawRoundedRect(ctx, 45, 500, 710, 350, 12, true, true);

        // Grid contents
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🟢 VÍNCULO CON DISCORD COMPLETADO', 400, 560);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '500 15px "Inter", sans-serif';
        ctx.fillText('Las alertas de telemetría automática y records del equipo están habilitadas.', 400, 610);
        ctx.fillText('Cuando un piloto oficial registre una vuelta rápida, se generará una tarjeta visual.', 400, 640);

        // Info boxes
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        drawRoundedRect(ctx, 80, 680, 640, 120, 8, true, true);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = 'bold 11px "Orbitron", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('CONFIGURACIÓN DEL SISTEMA:', 110, 715);
        ctx.fillText('CANAL PRINCIPAL:', 110, 745);
        ctx.fillText('COMPILACIÓN Y MOTOR:', 110, 775);

        ctx.fillStyle = '#00d4ff';
        ctx.font = 'bold 12px "Orbitron", sans-serif';
        ctx.fillText('MDT TELEMETRY ENGINE v1.0.6 (ELECTRON HOST)', 330, 715);
        ctx.fillText('#TELEMETRIA-RACING (WEBHOOK)', 330, 745);
        ctx.fillText('HTML5 CANVAS RENDERER • ACTIVE WATCHER', 330, 775);

    } else {
        // --- REAL TELEMETRY CARD INTERIOR (WEC POSTER STYLE) ---

        // 6. Slanted Chevron (Badge de Piloto y Fabricante)
        ctx.fillStyle = '#0c0e1a';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(45 + 15, 160);
        ctx.lineTo(540, 160);
        ctx.lineTo(540 - 15, 160 + 55);
        ctx.lineTo(45, 160 + 55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw Car Manufacturer Logo inside slanted chevron
        const carLogoPath = getCarLogoPath(car);
        const manufacturerLogo = await loadImg(carLogoPath);
        if (manufacturerLogo) {
            ctx.drawImage(manufacturerLogo, 70, 168, 38, 38);
        }

        // Slanted Orange badge for category
        ctx.fillStyle = '#ff6b2b';
        ctx.beginPath();
        ctx.moveTo(410 + 15, 165);
        ctx.lineTo(525, 165);
        ctx.lineTo(525 - 15, 165 + 45);
        ctx.lineTo(410, 165 + 45);
        ctx.closePath();
        ctx.fill();

        // Text inside slanted orange block
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText((category || 'WEC').toUpperCase(), 468, 194);

        // Team Name inside slanted block
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px "Orbitron", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('MDT MOTORSPORT', manufacturerLogo ? 118 : 75, 195);

        // Huge Title: LAP RECORD / FASTEST LAP (Aesthetics matching HYPERPOLE)
        const massiveTitleText = improvement > 0 ? 'LAP RECORD' : 'FASTEST LAP';
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'black italic bold 74px "Orbitron", sans-serif';
        ctx.shadowColor = brandColorHex;
        ctx.shadowBlur = 18;
        ctx.fillText(massiveTitleText, 400, 310);
        ctx.restore();

        // Subtitle indicator
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = 'bold 11px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`> CLASS: ${category || 'WEC'}`, 400, 360);

        // 7. Dynamic Car Image Render (Glow and pop-out overlay behind glass panel, aspect ratio preserved!)
        const carImagePath = getCarImagePath(car, category);
        const carImage = await loadImg(carImagePath);
        if (carImage) {
            ctx.save();
            ctx.shadowColor = brandColorHex;
            ctx.shadowBlur = 22;
            
            // Calculate proportional dimensions to preserve original aspect ratio
            const maxW = 540;
            const maxH = 250;
            const imgW = carImage.width;
            const imgH = carImage.height;
            
            let targetW = maxW;
            let targetH = maxW * (imgH / imgW);
            
            if (targetH > maxH) {
                targetH = maxH;
                targetW = maxH * (imgW / imgH);
            }
            
            // Center the car horizontally, and align its bottom at y=575 (75px under dashboard glass)
            const cx = 400 - (targetW / 2);
            const cy = 575 - targetH;
            
            ctx.drawImage(carImage, cx, cy, targetW, targetH);
            ctx.restore();
        }

        // 8. Middle-Center: Large Glowing Category Logo / Watermark (Drawn ON TOP of the car cockpit for perfect WEC overlay branding!)
        const catLogoPath = getCategoryLogoPath(category);
        const categoryBadge = await loadImg(catLogoPath);
        if (categoryBadge) {
            ctx.save();
            ctx.strokeStyle = brandColorHex;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = brandColorHex;
            ctx.shadowBlur = 16;
            ctx.beginPath();
            // Y shifted slightly up (to y=370) to sit dynamically on top of the car canopy/cockpit
            ctx.arc(400, 370, 48, 0, Math.PI * 2);
            ctx.stroke();
            
            // Draw badge inside circle
            ctx.beginPath();
            ctx.arc(400, 370, 45, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(categoryBadge, 355, 325, 90, 90);
            ctx.restore();
        }

        // 9. Lower Telemetry Glass Dashboard
        ctx.fillStyle = 'rgba(10, 10, 16, 0.72)'; // Slightly darker glass for perfect text readability over the car under-glass
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        drawRoundedRect(ctx, 45, 500, 710, 350, 12, true, true);

        // 9.1 Timing Block (Left Column)
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        drawRoundedRect(ctx, 75, 535, 320, 130, 8, true, true);

        // Accent bottom line in timing box
        ctx.fillStyle = brandColorHex;
        ctx.fillRect(75, 662, 320, 3);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = 'bold 9px "Orbitron", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('TIEMPO DE VUELTA RÁPIDA', 95, 565);

        // Huge glowing time
        ctx.save();
        ctx.fillStyle = brandColorHex;
        ctx.font = 'bold 46px "Orbitron", sans-serif';
        ctx.shadowColor = brandColorHex;
        ctx.shadowBlur = 12;
        ctx.fillText(formatTime(lapTime), 95, 622);
        ctx.restore();

        // Delta inside timing block
        if (improvement > 0) {
            ctx.fillStyle = '#ff6b2b';
            ctx.font = 'bold 11px "Orbitron", sans-serif';
            ctx.fillText(`📉 MEJORA: -${improvement.toFixed(3)}s`, 95, 648);
            
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.fillText(`Anterior: ${formatTime(previousTime)}`, 240, 648);
        } else {
            ctx.fillStyle = '#e8a832';
            ctx.font = 'bold 10px "Orbitron", sans-serif';
            ctx.fillText('🥇 PRIMER REGISTRO ABSOLUTO', 95, 648);
        }

        // 9.2 Sector Splits (Right Column - Stacked modern vertical bars)
        const secLabels = ['SECTOR 1', 'SECTOR 2', 'SECTOR 3'];
        const secValues = [sectors?.s1, sectors?.s2, sectors?.s3];

        for (let i = 0; i < 3; i++) {
            const sy = 535 + (i * 42);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            drawRoundedRect(ctx, 420, sy, 305, 36, 4, true, true);

            // Colored sector dot
            ctx.fillStyle = brandColorHex;
            ctx.beginPath();
            ctx.arc(440, sy + 18, 4, 0, Math.PI * 2);
            ctx.fill();

            // Sector Label
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.font = 'bold 10px "Orbitron", sans-serif';
            ctx.fillText(secLabels[i], 455, sy + 22);

            // Sector Value
            const val = secValues[i];
            const valStr = (val && val > 0) ? `${val.toFixed(3)}s` : '--.---s';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 13px "Orbitron", sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(valStr, 705, sy + 22);
            ctx.textAlign = 'left'; // Reset
        }

        // 9.3 Divider Line
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(75, 695, 650, 1);

        // 9.4 Bottom Details
        // Car
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = 'bold 9px "Orbitron", sans-serif';
        ctx.fillText('COCHE Y CLASE DE VEHÍCULO', 75, 725);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px "Inter", sans-serif';
        ctx.fillText(car || '---', 75, 755);

        // Top Speed
        if (topSpeed && parseFloat(topSpeed) > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.font = 'bold 9px "Orbitron", sans-serif';
            ctx.fillText('VELOCIDAD MÁXIMA', 420, 725);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 22px "Orbitron", sans-serif';
            ctx.fillText(`${topSpeed} km/h`, 420, 755);
        }

        // Setup Name
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = 'bold 9px "Orbitron", sans-serif';
        ctx.fillText('CONFIGURACIÓN / SETUP', 75, 795);

        ctx.fillStyle = '#00d4ff';
        ctx.font = 'bold 13px "Orbitron", sans-serif';
        ctx.fillText(data.currentSetup || 'AJUSTE PERSONALIZADO MDT', 75, 822);
    }

    // 10. Massive Footer Driver Name Bar (Chevron Slanted Style at Bottom)
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 900, canvas.width, 100);

    // Glowing Orange border above driver bar
    ctx.fillStyle = brandColorHex;
    ctx.fillRect(0, 900, canvas.width, 4);

    // Driver Name
    const cleanPilotName = (pilot || 'AITOR MODUGA').toUpperCase();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Orbitron", sans-serif';
    ctx.fillText(cleanPilotName, canvas.width / 2, 962);

    // Stopwatch glow icon in the bottom right corner
    ctx.save();
    ctx.strokeStyle = brandColorHex;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = brandColorHex;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(730, 950, 16, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.fillStyle = brandColorHex;
    ctx.beginPath();
    ctx.arc(730, 950, 4, 0, Math.PI * 2);
    ctx.fill();
    // Needle
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(730, 950);
    ctx.lineTo(736, 942);
    ctx.stroke();
    ctx.restore();
};

export const sendDiscordNotification = async (webhookUrl, data) => {
    if (!webhookUrl) return;

    const { pilot, circuit, car, category, improvement, isTest } = data;

    // Create off-screen canvas (800 x 1000 WEC vertical poster ratio)
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1000;

    try {
        // Draw the WEC-style telemetry poster card graphics asynchronously
        await drawTelemetryCard(canvas, data);

        // Convert canvas to PNG Blob
        const blob = await new Promise((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/png');
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
        formData.append('files[0]', blob, 'telemetry_card.png');

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
                        url: 'attachment://telemetry_card.png'
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
