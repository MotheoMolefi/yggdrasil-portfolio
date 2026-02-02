# 🌳 Yggdrasil Portfolio

An immersive 3D portfolio website inspired by Yggdrasil, the Norse world tree. Navigate through a mystical tree to explore projects in an interactive 3D environment.

## ✨ Features

- **3D Interactive Tree**: Fully rendered Yggdrasil tree with procedurally generated branches
- **Project Nodes**: Each project is represented as a glowing orb attached to the tree
- **Smooth Navigation**: Orbit controls for intuitive camera movement and exploration
- **Modern UI**: Beautiful overlay panels with project details
- **Responsive Design**: Works across different screen sizes
- **Future AI Integration**: Ready for Ratatoskr AI assistant (OpenAI or Claude)

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository or navigate to the project directory:
```bash
cd portfolio_site
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and visit:
```
http://localhost:3000
```

## 🎮 Controls

- **Rotate**: Click and drag to orbit around the tree
- **Zoom**: Scroll to zoom in and out
- **Select Project**: Click on any glowing orb to view project details
- **Auto-Rotate**: The tree slowly rotates automatically

## 🛠️ Technology Stack

- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Three.js** - 3D graphics
- **React Three Fiber** - React renderer for Three.js
- **@react-three/drei** - Useful helpers for R3F
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Zustand** - State management

## 📁 Project Structure

```
portfolio_site/
├── src/
│   ├── components/
│   │   ├── YggdrasilTree.tsx      # Main 3D tree component
│   │   ├── ProjectNode.tsx        # Individual project orbs
│   │   ├── Scene.tsx              # 3D scene setup
│   │   ├── ProjectPanel.tsx       # Project details sidebar
│   │   ├── Header.tsx             # Top navigation
│   │   ├── Instructions.tsx       # Help panel
│   │   └── RatatoskrPlaceholder.tsx # AI assistant placeholder
│   ├── data/
│   │   └── projects.ts            # Your project data
│   ├── types.ts                   # TypeScript types
│   ├── store.ts                   # Global state
│   ├── App.tsx                    # Main app component
│   ├── main.tsx                   # Entry point
│   └── index.css                  # Global styles
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 🎨 Customization

### Adding Your Projects

Edit `src/data/projects.ts` to add your own projects:

```typescript
{
  id: 'unique-id',
  title: 'Your Project Name',
  description: 'Brief description of your project',
  technologies: ['React', 'Node.js', 'etc'],
  category: 'web', // or 'mobile', 'ai', 'data', 'other'
  position: [x, y, z], // 3D position on tree
  color: '#hexcolor',
  link: 'https://your-project.com',
  github: 'https://github.com/you/project',
}
```

### Customizing Colors

Edit `tailwind.config.js` to change the color scheme:

```javascript
colors: {
  'yggdrasil': {
    'dark': '#0a0e1a',      // Background
    'bark': '#3d2817',      // Tree bark
    'leaf': '#4a7c59',      // Leaves/accent
    'gold': '#d4af37',      // Highlights
    'rune': '#8b9dc3',      // Secondary accent
  }
}
```

## 🤖 Future: Ratatoskr AI Integration

The project is structured to easily integrate an LLM-powered assistant:

1. Choose your provider (OpenAI or Claude)
2. Copy `.env.example` to `.env` and add your API key
3. Implement the chat interface in `RatatoskrPlaceholder.tsx`
4. Connect to your chosen API endpoint

### Example Integration Points:

- **OpenAI**: Use GPT-4 for natural conversation
- **Claude**: Use Claude 3 for detailed, thoughtful responses
- Train on your resume/portfolio for accurate answers
- Implement context-aware project recommendations

## 📦 Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory, ready to deploy to any static hosting service (Vercel, Netlify, GitHub Pages, etc.).

## 🌟 Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Netlify
```bash
npm run build
# Then drag the dist folder to Netlify's web interface
```

### GitHub Pages
Add to `vite.config.ts`:
```typescript
export default defineConfig({
  base: '/your-repo-name/',
  // ... rest of config
})
```

## 📝 License

This project is open source and available under the MIT License.

## 🎯 Performance Tips

- The tree generates procedurally, so you can adjust complexity in `YggdrasilTree.tsx`
- Reduce particle count if experiencing lag (in the `points` component)
- Adjust shadow quality in `Scene.tsx` for better performance

## 🐛 Troubleshooting

**Tree not rendering?**
- Check browser console for WebGL errors
- Ensure your browser supports WebGL 2.0

**Performance issues?**
- Reduce `maxDepth` in tree generation
- Lower particle count
- Disable shadows in Scene.tsx

**Projects not appearing?**
- Verify project positions are within view
- Check console for errors in projects.ts

## 🤝 Contributing

Feel free to fork and customize for your own portfolio! If you make cool improvements, consider sharing them.

---

Built with ⚡ by [Your Name] | Powered by Norse Mythology 🌳

