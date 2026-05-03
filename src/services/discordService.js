/**
 * MDT Discord Service
 * Handles communication with Discord Webhooks for team notifications.
 */

export const sendDiscordNotification = async (webhookUrl, data) => {
    if (!webhookUrl) return;

    const { pilot, circuit, car, lapTime, category, improvement, isTest } = data;

    const formatTime = (seconds) => {
        if (!seconds) return '--:--.---';
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(3);
        return `${mins}:${secs.padStart(6, '0')}`;
    };

    const embed = {
        author: {
            name: isTest ? "MDT SYSTEM CHECK" : "MDT MOTORSPORT • RACE ENGINEER",
        },
        title: isTest ? "✅ CONEXIÓN CON DISCORD ESTABLECIDA" : `🏆 ¡NUEVO RÉCORD EN ${(circuit || '').toUpperCase()}!`,
        description: isTest
            ? `La consola de **MDT Motorsport** se ha vinculado correctamente a este canal. Las notificaciones de telemetría están activas.`
            : `🚀 **${pilot}** ha triturado el cronómetro en el asfalto de **${circuit}**.`,
        color: isTest ? 0x22C55E : 0x0070F3,
        fields: isTest ? [
            { name: "📡 ESTADO", value: "ONLINE", inline: true },
            { name: "🖥️ ORIGEN", value: "CONSOLA LOCAL", inline: true }
        ] : [
            { name: "⏱️ TIEMPO", value: `**${formatTime(lapTime)}**`, inline: true },
            { name: "🚗 COCHE", value: car || '---', inline: true },
        ],
        footer: {
            text: `MDT Racing Console • ${category || ''} CLASS • ${new Date().toLocaleDateString()}`,
        }
    };

    if (!isTest && improvement > 0) {
        embed.fields.push({
            name: "📊 MEJORA",
            value: `📉 **-${improvement.toFixed(3)}s** respecto al anterior`,
            inline: true
        });
        embed.color = 0xFFA500;
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });
        return response.ok;
    } catch (err) {
        console.error("Error sending Discord notification:", err);
        return false;
    }
};
