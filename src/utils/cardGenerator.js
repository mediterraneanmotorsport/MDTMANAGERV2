/**
 * MDT Record Card Generator
 * Generates a high-quality PNG image for race results.
 */

export const generateRecordCard = async (data) => {
    const { pilot, circuit, car, lapTime, category } = data;

    const getCarLogo = (carName) => {
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
        if (name.includes('oreca')) return 'assets/logos/cars/Oreca.png';
        return 'assets/logos/cars/Default.png';
    };

    const getCategoryLogo = (catName) => {
        const name = (catName || '').toUpperCase();
        if (name.includes('HYP') || name === 'HY') return 'assets/logos/categories/HY.png';
        if (name.includes('LMP2')) return 'assets/logos/categories/LMP2.png';
        if (name.includes('GT3')) return 'assets/logos/categories/GT3.png';
        return null;
    };

    const loadImage = (src) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
        });
    };

    const formatTime = (seconds) => {
        if (!seconds) return '--:--.---';
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(3);
        return `${mins}:${secs.padStart(6, '0')}`;
    };

    // Load all necessary images
    const [teamLogo, carLogo, catLogo] = await Promise.all([
        loadImage('logo.png'),
        loadImage(getCarLogo(car)),
        loadImage(getCategoryLogo(category))
    ]);

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');

    // 1. Background - Deep Gradient
    const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
    gradient.addColorStop(0, '#050505');
    gradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 630);

    // 2. Add some "Racing" texture
    ctx.strokeStyle = 'rgba(0, 112, 243, 0.05)';
    ctx.lineWidth = 1;
    for(let i=0; i<1500; i+=30) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i - 400, 630);
        ctx.stroke();
    }

    // 3. Accent Bars
    ctx.fillStyle = '#0070F3';
    ctx.fillRect(0, 0, 15, 630);
    ctx.fillStyle = '#FFA500';
    ctx.fillRect(15, 0, 5, 630);

    // 4. DRAW LOGOS PROPORTIONALLY
    const drawImageProportional = (img, x, y, maxW, maxH, align = 'left') => {
        if (!img) return;
        const ratio = Math.min(maxW / img.width, maxH / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        const finalX = align === 'right' ? x - w : x;
        ctx.drawImage(img, finalX, y, w, h);
    };

    // Team Logo (Top Right)
    drawImageProportional(teamLogo, 1140, 40, 400, 160, 'right');

    // Car Brand Logo (Beside Pilot)
    drawImageProportional(carLogo, 60, 115, 80, 80);

    // Category Logo (Bottom Right)
    drawImageProportional(catLogo, 1140, 520, 150, 80, 'right');

    // 5. TEXTS
    ctx.fillStyle = 'white';
    
    // Header
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#666';
    ctx.fillText('MDT MOTORSPORT • RACE TELEMETRY', 60, 80);

    // Pilot Name
    ctx.font = 'black 90px Arial';
    ctx.fillStyle = 'white';
    const pilotX = carLogo ? 160 : 60;
    ctx.fillText(pilot.toUpperCase(), pilotX, 200);

    // Circuit & Car Info
    ctx.font = 'bold 35px Arial';
    ctx.fillStyle = '#0070F3';
    ctx.fillText(`${circuit.toUpperCase()}  •  ${car.toUpperCase()}`, 60, 270);

    // The Time (The HERO)
    ctx.font = 'italic black 200px Arial';
    ctx.fillStyle = 'white';
    ctx.shadowBlur = 40;
    ctx.shadowColor = 'rgba(0, 112, 243, 0.3)';
    ctx.fillText(formatTime(lapTime), 50, 510);
    ctx.shadowBlur = 0;

    // MDT Watermark
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.font = 'bold 250px Arial';
    ctx.fillText('MDT', 650, 600);

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/png');
    });
};
