import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Cove',
  description: 'A beautiful WebUI for OpenClaw',
  base: '/cove/',
  
  vite: {
    server: {
      allowedHosts: ['cove-docs.maudeco.de', 'localhost'],
    },
  },
  
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/favicon-32.png' }],
  ],

  themeConfig: {
    logo: '/logo.png',
    
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'Canvas', link: '/canvas/' },
      { text: 'GitHub', link: 'https://github.com/MaudeCode/cove' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Features', link: '/guide/features' },
            { text: 'Deployment', link: '/guide/deployment' },
          ],
        },
      ],
      '/canvas/': [
        {
          text: 'Canvas',
          items: [
            { text: 'Setup', link: '/canvas/' },
            { text: 'Agent Reference', link: '/canvas/agent-reference' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/MaudeCode/cove' },
      { icon: 'discord', link: 'https://discord.com/invite/clawd' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025-present MaudeCode',
    },

    search: {
      provider: 'local',
    },
  },
})
