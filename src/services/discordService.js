/**
 * MDT Discord Service
 * Handles communication with Discord Webhooks for team notifications.
 */

import { generateRecordCard } from '../utils/cardGenerator';

export const sendDiscordNotification = async (webhookUrl, data) => {
    if (!webhookUrl) return;

    const { pilot, circuit, car, lapTime, category, improvement, isTest } = data;

    const formatTime = (seconds) => {
        if (!seconds) return '--:--.---';
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(3);
        return `${mins}:${secs.padStart(6, '0')}`;
    };

    // 1. GENERATE DYNAMIC IMAGE (Solo si no es test, o podemos dejarlo para probar la generación)
    const cardBlob = await generateRecordCard(data);

    const embed = {
        author: {
            name: isTest ? "MDT SYSTEM CHECK" : "MDT MOTORSPORT • RACE ENGINEER",
            icon_url: "https://raw.githubusercontent.com/FortAwesome/Font-Awesome/master/svgs/solid/robot.svg"
        },
        title: isTest ? "✅ CONEXIÓN CON DISCORD ESTABLECIDA" : `🏆 ¡NUEVO RÉCORD EN ${circuit.toUpperCase()}!`,
        description: isTest 
            ? `La consola de **MDT Motorsport** se ha vinculado correctamente a este canal. Las notificaciones de telemetría están activas.`
            : `🚀 **${pilot}** ha triturado el cronómetro en el asfalto de **${circuit}**.`,
        color: isTest ? 0x22C55E : 0x0070F3, // Green for test, Blue for record
        fields: isTest ? [
            { name: "📡 ESTADO", value: "ONLINE", inline: true },
            { name: "🖥️ ORIGEN", value: "CONSOLA LOCAL", inline: true }
        ] : [
            { 
                name: "⏱️ TIEMPO", 
                value: `**${formatTime(lapTime)}**`, 
                inline: true 
            }
        ],
        image: {
            url: "attachment://record-card.png"
        },
        footer: {
            text: `MDT Racing Console • ${category} CLASS • ${new Date().toLocaleDateString()}`,
        }
    };

    if (!isTest && improvement > 0) {
        embed.fields.push({
            name: "📊 PROGRESO",
            value: `📉 ¡Mejora de **-${improvement.toFixed(3)}s**!`,
            inline: true
        });
        embed.color = 0xFFA500;
    }

    // Prepare Multipart Form Data
    const formData = new FormData();
    formData.append('file', cardBlob, 'record-card.png');
    formData.append('payload_json', JSON.stringify({ embeds: [embed] }));

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            body: formData
        });
        return response.ok;
    } catch (err) {
        console.error("Error sending Discord notification:", err);
        return false;
    }
};
