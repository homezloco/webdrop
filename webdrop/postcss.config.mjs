// Use object-form plugins for PostCSS so environments like Vitest/Vite load correctly
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
