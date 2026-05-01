/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Custom "Racing/Carbon" palette
                'racing-black': '#0c0c0c',
                'racing-carbon': '#18181b', // light black / dark gray for cards
                'racing-white': '#f5f5f5',
                'racing-blue': '#0070f3',
                'racing-orange': '#ff5722',
                'racing-success': '#10b981', // green for installed
            },
            backgroundImage: {
                'carbon-pattern': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%23222' fill-opacity='0.4' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E\")",
            }
        },
    },
    plugins: [],
}
