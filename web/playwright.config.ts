import {defineConfig, devices} from '@playwright/test'
export default defineConfig({
  testDir: './tests/mobile',
  use: {...devices['Pixel 7'], browserName: 'chromium', launchOptions: {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}, baseURL: 'http://127.0.0.1:18766', headless: true},
  webServer: {command: 'node ../scripts/serve-mobile-web.mjs', url: 'http://127.0.0.1:18766', reuseExistingServer: false},
  reporter: 'list',
})
